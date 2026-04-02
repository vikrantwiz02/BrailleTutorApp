// Conversational AI Service - Fully Interactive Voice Assistant
// This service provides a localized conversational experience throughout the app

import Fuse from 'fuse.js';
import { brailleKnowledgeBase, KnowledgeEntry } from '../data/knowledgeBase';
import { voiceService } from './voiceService';
import { store } from '../store';

// App state interface for AI context
export interface AppContext {
  currentScreen: string;
  currentLesson?: {
    id: string;
    title: string;
    level: number;
    stepNumber: number;
    totalSteps: number;
    content?: string;
  };
  userProgress: {
    totalLessonsCompleted: number;
    currentStreak: number;
    lastLesson?: string;
    overallProgress: number;
  };
  deviceConnected: boolean;
  isListening: boolean;
}

// Conversation message
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Command result from AI
export interface AICommandResult {
  type: 'navigate' | 'lesson_action' | 'teach' | 'answer' | 'control' | 'status' | 'help' | 'conversation';
  action?: string;
  params?: Record<string, any>;
  response: string;
  shouldSpeak: boolean;
}

// Navigation handler type
export type NavigationHandler = (screen: string, params?: Record<string, any>) => void;
export type LessonActionHandler = (action: string, params?: Record<string, any>) => void;

class ConversationalAIService {
  private fuse: Fuse<KnowledgeEntry> | null = null;
  private conversationHistory: ConversationMessage[] = [];
  private appContext: AppContext;
  private isInitialized: boolean = false;
  private navigationHandler: NavigationHandler | null = null;
  private lessonActionHandler: LessonActionHandler | null = null;
  private isProcessing: boolean = false;
  private onStateChangeCallback: ((state: any) => void) | null = null;

  constructor() {
    this.appContext = {
      currentScreen: 'home',
      userProgress: {
        totalLessonsCompleted: 0,
        currentStreak: 0,
        overallProgress: 0,
      },
      deviceConnected: false,
      isListening: false,
    };
  }

  // Initialize the AI service
  async initialize(): Promise<{ success: boolean; error?: string }> {
    if (this.isInitialized) {
      return { success: true };
    }

    try {
      this.fuse = new Fuse(brailleKnowledgeBase, {
        keys: ['query', 'aliases'],
        threshold: 0.45,
        includeScore: true,
      });

      this.isInitialized = true;
      console.log('Local AI Engine initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize local AI engine:', error);
      return { success: false, error: 'Local Engine initialization failed.' };
    }
  }

  // Set navigation handler
  setNavigationHandler(handler: NavigationHandler): void {
    this.navigationHandler = handler;
  }

  // Set lesson action handler
  setLessonActionHandler(handler: LessonActionHandler): void {
    this.lessonActionHandler = handler;
  }

  // Set state change callback
  setOnStateChange(callback: (state: any) => void): void {
    this.onStateChangeCallback = callback;
  }

  // Update app context
  updateContext(context: Partial<AppContext>): void {
    this.appContext = { ...this.appContext, ...context };
  }

  // Get current context
  getContext(): AppContext {
    return this.appContext;
  }

  // Process user voice input
  async processUserInput(userText: string): Promise<AICommandResult> {
    if (this.isProcessing) {
      return {
        type: 'conversation',
        response: "Just a moment, I'm still processing your last request.",
        shouldSpeak: true,
      };
    }

    this.isProcessing = true;
    this.notifyStateChange({ isProcessing: true });

    try {
      const trimmedText = userText.trim();
      if (!trimmedText) {
        return {
          type: 'conversation',
          response: 'I did not catch that. Please say that again.',
          shouldSpeak: true,
        };
      }

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: trimmedText,
        timestamp: new Date(),
      });

      // Handle app actions locally for fast and deterministic behavior.
      const localIntent = this.parseLocalIntent(trimmedText);
      if (localIntent) {
        this.conversationHistory.push({
          role: 'assistant',
          content: localIntent.response,
          timestamp: new Date(),
        });
        await this.executeCommand(localIntent);
        return localIntent;
      }

      // Local NLP query matching
      let responseText = "I'm sorry, I don't know the answer to that just yet. To navigate, just say home or lessons.";
      
      if (this.fuse) {
        const results = this.fuse.search(trimmedText);
        // Ensure a decent confidence map
        if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.5) {
          responseText = results[0].item.response;
        }
      }

      // Format engine response
      const aiResponse: AICommandResult = {
        type: 'conversation',
        response: responseText,
        shouldSpeak: true,
      };

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: aiResponse.response,
        timestamp: new Date(),
      });

      // Execute commands based on type
      await this.executeCommand(aiResponse);
      return aiResponse;
    } catch (error) {
      console.error('Error processing user input:', error);
      return {
        type: 'conversation',
        response: "I'm sorry, I had trouble understanding that. Could you please repeat?",
        shouldSpeak: true,
      };
    } finally {
      this.isProcessing = false;
      this.notifyStateChange({ isProcessing: false });
    }
  }

  // Keep context extraction available for potential future local advanced parsing
  private getContextMessage(): Partial<AppContext> {
    const state = store.getState();
    const lessons = state.lessons;
    const device = state.device;
    const progress = state.analytics;

    // Update context from store
    this.appContext.deviceConnected = device.connected;
    this.appContext.userProgress = {
      totalLessonsCompleted: lessons.completed?.length || 0,
      currentStreak: progress.stats?.currentStreak || 0,
      lastLesson: lessons.current?.title,
      overallProgress: Math.round(((lessons.completed?.length || 0) / 260) * 100),
    };
    
    return this.appContext;
  }

  // Execute command from AI response
  private async executeCommand(result: AICommandResult): Promise<void> {
    switch (result.type) {
      case 'navigate':
        if (this.navigationHandler) {
          const screen = this.normalizeNavigationAction(result.action, result.params);
          if (screen) {
            this.navigationHandler(screen, result.params);
          }
        }
        break;

      case 'lesson_action':
        if (this.lessonActionHandler) {
          const lessonAction = this.normalizeLessonAction(result.action);
          if (lessonAction) {
            this.lessonActionHandler(lessonAction, result.params);
          }
        }
        break;

      case 'control':
        if (result.action) {
          const controlAction = result.action.toLowerCase();
          if (controlAction === 'stop_speaking' || controlAction === 'stop' || controlAction === 'quiet') {
            await voiceService.stopSpeaking();
          }
          if (controlAction === 'pause_speaking' || controlAction === 'pause') {
            await voiceService.pauseSpeaking();
          }
          if (controlAction === 'resume_speaking' || controlAction === 'resume') {
            await voiceService.resumeSpeaking();
          }
        }
        break;

      default:
        break;
    }

    // Speak the response if needed
    if (result.shouldSpeak && result.response) {
      await voiceService.speak(result.response);
    }
  }

  private parseLocalIntent(command: string): AICommandResult | null {
    const lowerCommand = command.toLowerCase().trim();

    if (/^(help|what can you do|show commands|voice commands)$/.test(lowerCommand)) {
      return {
        type: 'help',
        action: 'help',
        response: 'You can ask me to navigate, control lessons, check progress, connect devices, or answer Braille questions.',
        shouldSpeak: true,
      };
    }

    if (/(go to|open|show|take me to).*(home|lessons|progress|settings|device|notifications)/.test(lowerCommand)) {
      if (lowerCommand.includes('notifications')) {
        return { type: 'navigate', action: 'Notifications', response: 'Opening notifications.', shouldSpeak: true };
      }
      if (lowerCommand.includes('home')) {
        return { type: 'navigate', action: 'Home', response: 'Going to home.', shouldSpeak: true };
      }
      if (lowerCommand.includes('lesson')) {
        return { type: 'navigate', action: 'Lessons', response: 'Opening lessons.', shouldSpeak: true };
      }
      if (lowerCommand.includes('progress')) {
        return { type: 'navigate', action: 'Progress', response: 'Opening progress.', shouldSpeak: true };
      }
      if (lowerCommand.includes('setting')) {
        return { type: 'navigate', action: 'Settings', response: 'Opening settings.', shouldSpeak: true };
      }
      if (lowerCommand.includes('device') || lowerCommand.includes('connect')) {
        return { type: 'navigate', action: 'Device', response: 'Opening device screen.', shouldSpeak: true };
      }
    }

    if (/^(next|continue|previous|back|repeat|again|hint|practice|challenge|complete|finish|exit|quit)$/.test(lowerCommand)) {
      const actionMap: Record<string, string> = {
        next: 'next',
        continue: 'next',
        previous: 'previous',
        back: 'previous',
        repeat: 'repeat',
        again: 'repeat',
        hint: 'hint',
        practice: 'practice',
        challenge: 'challenge',
        complete: 'complete',
        finish: 'complete',
        exit: 'exit',
        quit: 'exit',
      };
      const mapped = actionMap[lowerCommand] || lowerCommand;
      return {
        type: 'lesson_action',
        action: mapped,
        response: mapped === 'next' || mapped === 'previous' ? '' : `Okay, ${mapped}.`,
        shouldSpeak: mapped !== 'next' && mapped !== 'previous',
      };
    }

    if (/^(stop|quiet|pause|resume)$/.test(lowerCommand)) {
      const actionMap: Record<string, string> = {
        stop: 'stop_speaking',
        quiet: 'stop_speaking',
        pause: 'pause_speaking',
        resume: 'resume_speaking',
      };
      return {
        type: 'control',
        action: actionMap[lowerCommand],
        response: lowerCommand === 'stop' || lowerCommand === 'quiet' ? '' : `Okay, ${lowerCommand}.`,
        shouldSpeak: lowerCommand !== 'stop' && lowerCommand !== 'quiet',
      };
    }

    if (/(my progress|how many lessons|streak|what lesson am i on|where am i)/.test(lowerCommand)) {
      const { userProgress, currentLesson } = this.appContext;
      const lessonInfo = currentLesson
        ? `You are on ${currentLesson.title}, step ${currentLesson.stepNumber} of ${currentLesson.totalSteps}.`
        : 'You are not inside an active lesson right now.';

      return {
        type: 'status',
        action: 'progress',
        response: `${lessonInfo} You have completed ${userProgress.totalLessonsCompleted} lessons with a ${userProgress.currentStreak} day streak.`,
        shouldSpeak: true,
      };
    }

    return null;
  }

  private normalizeNavigationAction(action?: string, params?: Record<string, any>): string | null {
    const raw = (action || params?.screen || '').toString().trim().toLowerCase();
    const navMap: Record<string, string> = {
      home: 'Home',
      lessons: 'Lessons',
      lesson: 'Lessons',
      progress: 'Progress',
      settings: 'Settings',
      device: 'Device',
      notifications: 'Notifications',
      notification: 'Notifications',
      main: 'Home',
    };
    return navMap[raw] || null;
  }

  private normalizeLessonAction(action?: string): string | null {
    if (!action) return null;

    const actionMap: Record<string, string> = {
      next: 'next',
      continue: 'next',
      previous: 'previous',
      back: 'previous',
      repeat: 'repeat',
      again: 'repeat',
      hint: 'hint',
      help: 'hint',
      practice: 'practice',
      challenge: 'challenge',
      complete: 'complete',
      finish: 'complete',
      exit: 'exit',
      quit: 'exit',
      start: 'start',
      teach: 'teach',
      status: 'status',
    };

    return actionMap[action.toLowerCase()] || action;
  }

  // Notify state change
  private notifyStateChange(state: any): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(state);
    }
  }

  // Greet user on app start
  async greetUser(): Promise<void> {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 17) {
      greeting = 'Good afternoon';
    } else {
      greeting = 'Good evening';
    }

    const state = store.getState();
    const lessonsCompleted = state.lessons.completed?.length || 0;
    const streak = state.analytics.stats?.currentStreak || 0;

    let message = `${greeting}! Welcome back to Braille Buddy. `;
    
    if (lessonsCompleted === 0) {
      message += "I'm excited to start your Braille learning journey! Just say 'start learning' or 'go to lessons' whenever you're ready.";
    } else if (streak > 1) {
      message += `Great job keeping your ${streak} day streak! You've completed ${lessonsCompleted} lessons. Ready to continue learning?`;
    } else {
      message += `You've completed ${lessonsCompleted} lessons so far. What would you like to do today?`;
    }

    await voiceService.speak(message);
  }

  // Quick command for common actions
  async handleQuickCommand(command: string): Promise<AICommandResult | null> {
    const lowerCommand = command.toLowerCase().trim();

    if (/(go to|open|show|take me to).*(home)|^home$/.test(lowerCommand)) {
      return { type: 'navigate', action: 'Home', response: 'Going to home screen.', shouldSpeak: true };
    }
    if (/(go to|open|show|take me to).*(lessons)|^lessons$/.test(lowerCommand)) {
      return { type: 'navigate', action: 'Lessons', response: 'Opening lessons.', shouldSpeak: true };
    }
    if (/(go to|open|show|take me to).*(progress)|^progress$/.test(lowerCommand)) {
      return { type: 'navigate', action: 'Progress', response: 'Showing your progress.', shouldSpeak: true };
    }
    if (/(go to|open|show|take me to).*(settings)|^settings$/.test(lowerCommand)) {
      return { type: 'navigate', action: 'Settings', response: 'Opening settings.', shouldSpeak: true };
    }
    if (/(connect|pair).*(device|braille)|((go to|open|show).*(device))|^device$/.test(lowerCommand)) {
      return { type: 'navigate', action: 'Device', response: 'Opening device connection.', shouldSpeak: true };
    }
    if (/(open|show|read).*(notifications?)|^notifications?$/.test(lowerCommand)) {
      return { type: 'navigate', action: 'Notifications', response: 'Opening notifications.', shouldSpeak: true };
    }

    if (lowerCommand === 'next' || lowerCommand === 'continue' || lowerCommand === 'go next') return { type: 'lesson_action', action: 'next', response: '', shouldSpeak: false };
    if (lowerCommand === 'previous' || lowerCommand === 'back' || lowerCommand === 'go back') return { type: 'lesson_action', action: 'previous', response: '', shouldSpeak: false };
    if (lowerCommand === 'repeat' || lowerCommand === 'again' || lowerCommand === 'say that again') return { type: 'lesson_action', action: 'repeat', response: 'Let me repeat that.', shouldSpeak: true };
    if (lowerCommand === 'hint' || lowerCommand === 'give me a hint') return { type: 'lesson_action', action: 'hint', response: 'Here is a hint.', shouldSpeak: true };
    
    if (lowerCommand.includes('stop') || lowerCommand.includes('quiet')) {
      await voiceService.stopSpeaking();
      return { type: 'control', action: 'stop_speaking', response: '', shouldSpeak: false };
    }

    return null;
  }

  // Get conversation history
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  // Clear conversation history
  clearHistory(): void {
    this.conversationHistory = [
      { role: 'user', content: 'Cleared', timestamp: new Date() }
    ];
  }

  // Check if processing
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

export const conversationalAIService = new ConversationalAIService();
export default conversationalAIService;
