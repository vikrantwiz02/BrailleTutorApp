// Conversational AI Service - Fully Interactive Voice Assistant
// This service provides a human-like conversational experience throughout the app

import { GoogleGenerativeAI } from '@google/generative-ai';
import { isGeminiConfigured } from '../config/gemini';
import { voiceService } from './voiceService';
import { store } from '../store';

// Get API key from environment
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

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
interface ConversationMessage {
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
type NavigationHandler = (screen: string, params?: Record<string, any>) => void;
type LessonActionHandler = (action: string, params?: Record<string, any>) => void;

class ConversationalAIService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private chat: any = null;
  private conversationHistory: ConversationMessage[] = [];
  private appContext: AppContext;
  private isInitialized: boolean = false;
  private navigationHandler: NavigationHandler | null = null;
  private lessonActionHandler: LessonActionHandler | null = null;
  private isProcessing: boolean = false;
  private onStateChangeCallback: ((state: any) => void) | null = null;

  // System prompt for the AI
  private systemPrompt = `You are a friendly, encouraging Braille tutor assistant named "Braille Buddy". You help visually impaired users learn Braille through voice interaction.

Your personality:
- Warm, patient, and encouraging like a caring teacher
- Speak naturally and conversationally, not robotically
- Use simple, clear language
- Celebrate achievements and provide gentle corrections
- Be concise but informative

Your capabilities:
1. NAVIGATION: Guide users through the app
   - Commands: "go to home", "open lessons", "show progress", "settings", "connect device"
   
2. LESSON TEACHING: Actively teach Braille lessons
   - Start lessons: "start lesson", "begin learning", "teach me"
   - Control: "next", "previous", "repeat", "give me a hint"
   - Practice: "quick practice", "challenge me", "quiz"
   
3. STATUS: Tell users about their progress
   - "what lesson am I on", "how many lessons completed", "my progress"
   - "what's my streak", "how am I doing"
   
4. TEACHING CONTENT: Explain Braille concepts
   - Describe dot patterns naturally: "The letter A is just dot 1 - the top left dot"
   - Provide mnemonics and tips
   - Answer questions about Braille

5. CONVERSATION: General helpful responses
   - Greetings, encouragement, clarifications
   - Help commands: "help", "what can you do", "how do I..."

RESPONSE FORMAT:
You must respond in JSON format:
{
  "type": "navigate|lesson_action|teach|answer|control|status|help|conversation",
  "action": "specific action if applicable",
  "params": { "additional parameters" },
  "response": "Your spoken response to the user",
  "shouldSpeak": true
}

IMPORTANT RULES:
- Always be encouraging and positive
- If unsure, ask for clarification
- Keep responses concise for speech (under 50 words usually)
- Use natural pauses (commas, periods) for better speech
- Never use technical jargon
- Remember the conversation context`;

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

    if (!isGeminiConfigured()) {
      return { success: false, error: 'AI not configured. Please set up Gemini API key.' };
    }

    try {
      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 500,
        },
      });

      // Start a new chat with system context
      this.chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: this.systemPrompt }],
          },
          {
            role: 'model',
            parts: [{ text: JSON.stringify({
              type: 'conversation',
              response: "Hello! I'm Braille Buddy, your friendly Braille tutor. I'm here to help you learn Braille step by step. Just talk to me naturally - ask questions, tell me to teach you, or navigate the app. How can I help you today?",
              shouldSpeak: true
            })}],
          },
        ],
      });

      this.isInitialized = true;
      console.log('Conversational AI initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize conversational AI:', error);
      return { success: false, error: (error as Error).message };
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
        response: "Just a moment, I'm still thinking about your last request.",
        shouldSpeak: true,
      };
    }

    this.isProcessing = true;
    this.notifyStateChange({ isProcessing: true });

    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userText,
        timestamp: new Date(),
      });

      // Build context message
      const contextMessage = this.buildContextMessage(userText);

      // Send to AI
      const result = await this.chat.sendMessage(contextMessage);
      const responseText = result.response.text();

      // Parse AI response
      let aiResponse: AICommandResult;
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // If parsing fails, treat as conversation
        aiResponse = {
          type: 'conversation',
          response: responseText.replace(/```json|```/g, '').trim(),
          shouldSpeak: true,
        };
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: aiResponse.response,
        timestamp: new Date(),
      });

      // Execute commands based on type
      await this.executeCommand(aiResponse);

      this.isProcessing = false;
      this.notifyStateChange({ isProcessing: false });

      return aiResponse;
    } catch (error) {
      console.error('Error processing user input:', error);
      this.isProcessing = false;
      this.notifyStateChange({ isProcessing: false });

      return {
        type: 'conversation',
        response: "I'm sorry, I had trouble understanding that. Could you please repeat?",
        shouldSpeak: true,
      };
    }
  }

  // Build context message for AI
  private buildContextMessage(userText: string): string {
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

    return `
CURRENT APP STATE:
- Screen: ${this.appContext.currentScreen}
- Current Lesson: ${this.appContext.currentLesson ? `${this.appContext.currentLesson.title} (Step ${this.appContext.currentLesson.stepNumber}/${this.appContext.currentLesson.totalSteps})` : 'None'}
- Lessons Completed: ${this.appContext.userProgress.totalLessonsCompleted}/260
- Progress: ${this.appContext.userProgress.overallProgress}%
- Streak: ${this.appContext.userProgress.currentStreak} days
- Device Connected: ${this.appContext.deviceConnected ? 'Yes' : 'No'}

USER SAYS: "${userText}"

Respond with appropriate action in JSON format.`;
  }

  // Execute command from AI response
  private async executeCommand(result: AICommandResult): Promise<void> {
    switch (result.type) {
      case 'navigate':
        if (this.navigationHandler && result.action) {
          this.navigationHandler(result.action, result.params);
        }
        break;

      case 'lesson_action':
        if (this.lessonActionHandler && result.action) {
          this.lessonActionHandler(result.action, result.params);
        }
        break;

      case 'teach':
        // The response contains the teaching content
        // It will be spoken by the caller
        break;

      case 'control':
        // Handle app controls like volume, speed
        if (result.action === 'stop_speaking') {
          await voiceService.stopSpeaking();
        }
        break;

      default:
        // conversation, status, help, answer - just speak the response
        break;
    }

    // Speak the response if needed
    if (result.shouldSpeak && result.response) {
      await voiceService.speak(result.response);
    }
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

  // Quick command for common actions (doesn't need AI)
  async handleQuickCommand(command: string): Promise<AICommandResult | null> {
    const lowerCommand = command.toLowerCase().trim();

    // Navigation shortcuts
    if (lowerCommand.includes('go to home') || lowerCommand === 'home') {
      return {
        type: 'navigate',
        action: 'Home',
        response: 'Going to home screen.',
        shouldSpeak: true,
      };
    }

    if (lowerCommand.includes('go to lessons') || lowerCommand === 'lessons') {
      return {
        type: 'navigate',
        action: 'Lessons',
        response: 'Opening lessons.',
        shouldSpeak: true,
      };
    }

    if (lowerCommand.includes('go to progress') || lowerCommand === 'progress') {
      return {
        type: 'navigate',
        action: 'Progress',
        response: 'Showing your progress.',
        shouldSpeak: true,
      };
    }

    if (lowerCommand.includes('go to settings') || lowerCommand === 'settings') {
      return {
        type: 'navigate',
        action: 'Settings',
        response: 'Opening settings.',
        shouldSpeak: true,
      };
    }

    if (lowerCommand.includes('connect device') || lowerCommand.includes('go to device')) {
      return {
        type: 'navigate',
        action: 'Device',
        response: 'Opening device connection.',
        shouldSpeak: true,
      };
    }

    // Lesson control shortcuts
    if (lowerCommand === 'next' || lowerCommand === 'continue') {
      return {
        type: 'lesson_action',
        action: 'next',
        response: '',
        shouldSpeak: false,
      };
    }

    if (lowerCommand === 'previous' || lowerCommand === 'back') {
      return {
        type: 'lesson_action',
        action: 'previous',
        response: '',
        shouldSpeak: false,
      };
    }

    if (lowerCommand === 'repeat' || lowerCommand === 'again') {
      return {
        type: 'lesson_action',
        action: 'repeat',
        response: 'Let me repeat that.',
        shouldSpeak: true,
      };
    }

    if (lowerCommand.includes('stop') || lowerCommand.includes('quiet')) {
      await voiceService.stopSpeaking();
      return {
        type: 'control',
        action: 'stop_speaking',
        response: '',
        shouldSpeak: false,
      };
    }

    // Not a quick command, needs AI processing
    return null;
  }

  // Get conversation history
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  // Clear conversation history
  clearHistory(): void {
    this.conversationHistory = [];
    // Reinitialize chat with fresh context
    if (this.model) {
      this.chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: this.systemPrompt }],
          },
          {
            role: 'model',
            parts: [{ text: JSON.stringify({
              type: 'conversation',
              response: "Conversation cleared. How can I help you?",
              shouldSpeak: true
            })}],
          },
        ],
      });
    }
  }

  // Check if processing
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

export const conversationalAIService = new ConversationalAIService();
export default conversationalAIService;
