// ─── Voice Assistant Types ──────────────────────────────────────────────────
// Shared types for the NLU pipeline, intent actions, and UI state.

// All intent identifiers the assistant understands
export type IntentType =
  // Navigation
  | 'navigate'
  // Lesson controls
  | 'lesson.next'
  | 'lesson.previous'
  | 'lesson.repeat'
  | 'lesson.hint'
  | 'lesson.start'
  | 'lesson.complete'
  | 'lesson.practice'
  | 'lesson.challenge'
  | 'lesson.exit'
  // Speech controls
  | 'speech.stop'
  | 'speech.pause'
  | 'speech.resume'
  | 'speech.faster'
  | 'speech.slower'
  | 'speech.louder'
  | 'speech.softer'
  // Device (BLE)
  | 'device.connect'
  | 'device.disconnect'
  | 'device.scan'
  | 'device.status'
  | 'device.print'
  // Settings
  | 'settings.language'
  | 'settings.voice_on'
  | 'settings.voice_off'
  | 'settings.announce_on'
  | 'settings.announce_off'
  // Status queries
  | 'status.progress'
  | 'status.screen'
  | 'status.lesson'
  // Notifications
  | 'notifications.read'
  | 'notifications.clear'
  // Meta
  | 'help'
  | 'undo'
  | 'confirm'
  | 'cancel'
  | 'greet'
  // Free-form AI tutor query
  | 'tutor.ask'
  // Could not classify
  | 'unknown';

// Entities extracted from speech
export interface NLUEntity {
  screen?: string;        // For navigate intent
  language?: string;      // For settings.language
  printText?: string;     // For device.print
  lessonQuery?: string;   // For lesson.start (partial name / level)
  question?: string;      // For tutor.ask
}

// Result from either offline or online NLU
export interface NLUResult {
  intent: IntentType;
  confidence: number;       // 0–1
  entities: NLUEntity;
  originalText: string;
  source: 'offline' | 'online';
  suggestedResponse?: string; // Pre-generated response from online NLU
}

// A fully resolved, actionable command
export interface VoiceAction {
  id: string;
  label: string;
  intent: IntentType;
  entities: NLUEntity;
  requiresConfirmation: boolean;
  undoable: boolean;
  undoFn?: () => Promise<void>;
}

// Visual state for the UI component
export type AssistantMode =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'confirming'
  | 'error';

// A single turn in the conversation
export interface ConversationEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  intent?: IntentType;
}

// Callbacks the UI must provide to the core
export interface AssistantHandlers {
  onNavigate: (screen: string, params?: Record<string, any>) => void;
  onLessonAction: (action: string) => void;
}

// Context the core needs from the app at any point
export interface AssistantContext {
  currentScreen: string;
  currentLesson: {
    id: string;
    title: string;
    stepNumber: number;
    totalSteps: number;
  } | null;
  completedLessonsCount: number;
  streak: number;
  deviceConnected: boolean;
  isOnline: boolean;
}
