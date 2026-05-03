// ─── Voice Assistant Core ─────────────────────────────────────────────────────
// The single orchestrator that owns the full voice pipeline:
//
//   STT text ──► NLU (online → offline fallback)
//              ──► Intent action build + undo capture
//              ──► Confirmation gating (destructive actions)
//              ──► Action execution
//              ──► TTS spoken response
//              ──► Conversation history
//
// The React component (VoiceAssistant.tsx) only calls:
//   core.setHandlers(...)
//   core.updateContext(...)
//   core.processInput(text)   → Promise<string>   (spoken response)
//   core.getMode()            → AssistantMode
//   core.getHistory()         → ConversationEntry[]
//   core.setOnModeChange(cb)

import { classifyOffline } from './offlineNLU';
import { classifyOnline, askTutorOnline, isOnlineNLUAvailable } from './onlineNLU';
import { buildAction, executeAction } from './intentActions';
import { voiceService } from '../voiceService';
import Fuse from 'fuse.js';
import { brailleKnowledgeBase, KnowledgeEntry } from '../../data/knowledgeBase';
import type {
  AssistantMode,
  AssistantContext,
  AssistantHandlers,
  ConversationEntry,
  VoiceAction,
  NLUResult,
} from './types';

// ── Undo stack ────────────────────────────────────────────────────────────────

interface UndoRecord {
  action: VoiceAction;
  fn: (() => Promise<void>) | null;
  timestamp: number;
}

// ── Confirmation state ────────────────────────────────────────────────────────

interface PendingConfirmation {
  action: VoiceAction;
  prompt: string;
  expiresAt: number;
}

// ── Core class ────────────────────────────────────────────────────────────────

class VoiceAssistantCore {
  private mode: AssistantMode = 'idle';
  private context: AssistantContext = {
    currentScreen: 'Home',
    currentLesson: null,
    completedLessonsCount: 0,
    streak: 0,
    deviceConnected: false,
    isOnline: isOnlineNLUAvailable(),
  };
  private fuse: Fuse<KnowledgeEntry> | null = null;
  private handlers: AssistantHandlers = {
    onNavigate: () => {},
    onLessonAction: () => {},
  };
  private history: ConversationEntry[] = [];
  private undoStack: UndoRecord[] = [];
  private pendingConfirm: PendingConfirmation | null = null;
  private onModeChangeCb: ((mode: AssistantMode) => void) | null = null;
  private isProcessing = false;

  // Maximum turns to keep in memory
  private readonly MAX_HISTORY = 40;
  // Confirmation expires after 30 seconds
  private readonly CONFIRM_TTL_MS = 30_000;

  // ── Configuration ─────────────────────────────────────────────────────────

  setHandlers(handlers: Partial<AssistantHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  updateContext(partial: Partial<AssistantContext>): void {
    this.context = { ...this.context, ...partial };
  }

  setOnModeChange(cb: (mode: AssistantMode) => void): void {
    this.onModeChangeCb = cb;
  }

  getMode(): AssistantMode { return this.mode; }
  getHistory(): ConversationEntry[] { return [...this.history]; }
  isOnline(): boolean { return isOnlineNLUAvailable(); }

  // ── Main entry point ──────────────────────────────────────────────────────

  async processInput(rawText: string): Promise<string> {
    if (!rawText.trim()) return '';
    if (this.isProcessing) return "Just a moment, I'm still processing your last request.";

    this.isProcessing = true;
    this.setMode('processing');

    try {
      const response = await this._process(rawText.trim());
      return response;
    } finally {
      this.isProcessing = false;
      // Mode transitions to 'idle' or 'speaking' are handled inside _process
    }
  }

  // ── Internal pipeline ─────────────────────────────────────────────────────

  private async _process(text: string): Promise<string> {
    this._addHistory('user', text);

    // ── 1. Check pending confirmation ────────────────────────────────────────
    if (this.pendingConfirm) {
      if (Date.now() > this.pendingConfirm.expiresAt) {
        this.pendingConfirm = null;
        return await this._speak("Your previous action timed out. What would you like to do?");
      }

      const lower = text.toLowerCase().trim();
      const isYes = /^(yes|confirm|do it|go ahead|okay|ok|sure|yep|yup|affirmative|proceed)$/i.test(lower);
      const isNo  = /^(no|cancel|stop|never mind|forget it|abort|nope|negative)$/i.test(lower);

      if (isYes) {
        const confirmed = this.pendingConfirm.action;
        this.pendingConfirm = null;
        return await this._runAction(confirmed);
      }
      if (isNo) {
        this.pendingConfirm = null;
        return await this._speak("Okay, cancelled.");
      }
      // User said something else — treat as new input, clear pending
      this.pendingConfirm = null;
    }

    // ── 2. Check undo ────────────────────────────────────────────────────────
    const isUndo = /^(undo|revert|take back|reverse|undo that|go back on that)$/i.test(text);
    if (isUndo) {
      return await this._handleUndo();
    }

    // ── 3. NLU classification — offline first, online upgrade ───────────────
    let nlu: NLUResult = classifyOffline(text, this.context.currentScreen);

    // Run online classification in parallel; use it if it wins confidence
    if (isOnlineNLUAvailable()) {
      const onlineNlu = await classifyOnline(text, this.context.currentScreen);
      if (onlineNlu && onlineNlu.confidence > nlu.confidence) {
        nlu = onlineNlu;
      }
    }

    // ── 4. Special handling for tutor.ask ────────────────────────────────────
    if (nlu.intent === 'tutor.ask') {
      return await this._handleTutorQuery(nlu.entities.question || text);
    }

    // ── 5. Build action ───────────────────────────────────────────────────────
    const action = buildAction(nlu, this.context);

    // ── 6. Confirmation gate ──────────────────────────────────────────────────
    if (action.requiresConfirmation) {
      const prompt = `Are you sure you want to ${action.label.toLowerCase()}? Say yes or no.`;
      this.pendingConfirm = {
        action,
        prompt,
        expiresAt: Date.now() + this.CONFIRM_TTL_MS,
      };
      this.setMode('confirming');
      return await this._speak(prompt);
    }

    // ── 7. Execute ────────────────────────────────────────────────────────────
    return await this._runAction(action);
  }

  private async _runAction(action: VoiceAction): Promise<string> {
    try {
      const response = await executeAction(action, this.context, this.handlers);

      // Store in undo stack if undoable and has an undo fn
      if (action.undoable && action.undoFn) {
        this.undoStack.push({ action, fn: action.undoFn, timestamp: Date.now() });
        // Keep stack lean
        if (this.undoStack.length > 10) this.undoStack.shift();
      }

      return await this._speak(response);
    } catch (err) {
      console.error('[VoiceCore] Action error:', err);
      return await this._speak("Sorry, I ran into a problem with that. Please try again.");
    }
  }

  private async _handleUndo(): Promise<string> {
    if (this.undoStack.length === 0) {
      return await this._speak("There is nothing to undo right now.");
    }
    const record = this.undoStack.pop()!;
    if (!record.fn) {
      return await this._speak("That action cannot be undone.");
    }
    try {
      await record.fn();
      return await this._speak(`Undone: ${record.action.label}.`);
    } catch {
      return await this._speak("I couldn't undo that. Sorry.");
    }
  }

  private async _handleTutorQuery(question: string): Promise<string> {
    // Try Gemini first for richer answers
    if (isOnlineNLUAvailable()) {
      try {
        const answer = await askTutorOnline(question);
        if (answer) return await this._speak(answer);
      } catch {
        // Fall through to offline knowledge base
      }
    }

    // Offline fallback: fuzzy search local knowledge base
    if (!this.fuse) {
      this.fuse = new Fuse(brailleKnowledgeBase, {
        keys: ['query', 'aliases'],
        threshold: 0.45,
        includeScore: true,
      });
    }

    try {
      const results = this.fuse.search(question);
      if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.5) {
        return await this._speak(results[0].item.response);
      }
      return await this._speak("I don't know the answer to that just yet. I am continuously learning more about Braille!");
    } catch {
      return await this._speak("I am having trouble accessing my knowledge base right now.");
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async _speak(text: string): Promise<string> {
    this._addHistory('assistant', text);
    if (text) {
      this.setMode('speaking');
      try {
        await voiceService.speak(text);
      } catch {
        // TTS failure is non-fatal
      }
    }
    this.setMode('idle');
    return text;
  }

  private _addHistory(role: 'user' | 'assistant', text: string): void {
    if (!text) return;
    this.history.push({ role, text, timestamp: Date.now() });
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }
  }

  private setMode(mode: AssistantMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onModeChangeCb?.(mode);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  clearHistory(): void {
    this.history = [];
  }

  reset(): void {
    this.history = [];
    this.undoStack = [];
    this.pendingConfirm = null;
    this.setMode('idle');
  }
}

export const voiceAssistantCore = new VoiceAssistantCore();
export default voiceAssistantCore;
export type { AssistantMode, AssistantContext, AssistantHandlers, ConversationEntry };
