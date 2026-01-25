// AI Tutor Service using Google Gemini
import { geminiModel, BRAILLE_TUTOR_SYSTEM_PROMPT, isGeminiConfigured } from '../config/gemini';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { getLessonContent, BRAILLE_PATTERNS } from '../data';
import type { ChatMessage } from '../types/database';

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface TutorContext {
  currentLesson?: string;
  currentLessonTitle?: string;
  currentStep?: number;
  totalSteps?: number;
  userLevel?: string;
  recentTopics?: string[];
}

class AITutorService {
  private conversationHistory: TutorMessage[] = [];
  private sessionId: string;
  private rateLimitCounter: number = 0;
  private rateLimitResetTime: number = 0;

  constructor() {
    this.sessionId = `session-${Date.now()}`;
  }

  // Build detailed lesson context for AI
  private buildLessonContext(context?: TutorContext): string {
    if (!context?.currentLesson) {
      return '\n\nUser is not currently in a lesson.';
    }

    const lessonContent = getLessonContent(context.currentLesson);
    const currentStep = context.currentStep || 1;
    const stepContent = lessonContent.steps[currentStep - 1];

    let lessonContext = `\n\nCURRENT LESSON CONTEXT:
- Lesson ID: ${context.currentLesson}
- Lesson Title: ${context.currentLessonTitle || lessonContent.lessonId}
- User Level: ${context.userLevel || 'Beginner'}
- Current Step: ${currentStep} of ${lessonContent.steps.length}
- Lesson Objectives: ${lessonContent.objectives.join(', ')}`;

    if (stepContent) {
      lessonContext += `\n\nCURRENT STEP DETAILS:
- Step Type: ${stepContent.type}
- Step Title: ${stepContent.title}
- Step Content: ${stepContent.content}`;

      if (stepContent.letter) {
        const pattern = BRAILLE_PATTERNS[stepContent.letter.toUpperCase()];
        lessonContext += `\n- Teaching Letter: "${stepContent.letter}" = dots ${pattern?.join(',') || 'unknown'}`;
      }

      if (stepContent.braillePattern) {
        lessonContext += `\n- Braille Pattern: dots ${stepContent.braillePattern.join(',')}`;
      }
    }

    // Add Quick Practice items if available
    if (lessonContent.quickPractice && lessonContent.quickPractice.length > 0) {
      const practiceItems = lessonContent.quickPractice.slice(0, 3).map(p => p.prompt).join(', ');
      lessonContext += `\n- Quick Practice Items: ${practiceItems}`;
    }

    return lessonContext;
  }

  // Start a new conversation session
  startNewSession(): string {
    this.sessionId = `session-${Date.now()}`;
    this.conversationHistory = [];
    return this.sessionId;
  }

  // Check rate limit (60 requests per minute for free tier)
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    if (now > this.rateLimitResetTime) {
      this.rateLimitCounter = 0;
      this.rateLimitResetTime = now + 60000; // Reset in 1 minute
    }
    
    if (this.rateLimitCounter >= 55) { // Leave buffer
      return false;
    }
    
    this.rateLimitCounter++;
    return true;
  }

  // Send message to AI Tutor
  async sendMessage(
    userMessage: string,
    userId: string,
    context?: TutorContext
  ): Promise<{ response: string; error: string | null }> {
    // Check rate limit
    if (!this.checkRateLimit()) {
      return {
        response: "I'm receiving too many requests right now. Please wait a moment and try again.",
        error: 'Rate limit exceeded',
      };
    }

    // If Gemini not configured, use fallback responses
    if (!isGeminiConfigured()) {
      return this.getFallbackResponse(userMessage, context);
    }

    try {
      // Build detailed lesson context
      const contextInfo = this.buildLessonContext(context);

      // Build conversation history for context
      const historyContext = this.conversationHistory
        .slice(-6) // Last 6 messages
        .map(m => `${m.role === 'user' ? 'User' : 'BrailleBot'}: ${m.content}`)
        .join('\n');

      const fullPrompt = `${BRAILLE_TUTOR_SYSTEM_PROMPT}${contextInfo}

Previous conversation:
${historyContext}

User: ${userMessage}

BrailleBot:`;

      // Call Gemini API
      const result = await geminiModel.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      // Store in conversation history
      const userMsg: TutorMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };

      const assistantMsg: TutorMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: text,
        timestamp: new Date(),
      };

      this.conversationHistory.push(userMsg, assistantMsg);

      // Save to database if configured
      if (isSupabaseConfigured() && userId) {
        await this.saveChatMessages(userId, [userMsg, assistantMsg]);
      }

      return { response: text, error: null };
    } catch (err) {
      console.error('Gemini API error:', err);
      return this.getFallbackResponse(userMessage, context);
    }
  }

  // Get contextual help for a specific Braille topic
  async getTopicHelp(topic: string, userId: string): Promise<string> {
    const prompt = `Briefly explain this Braille concept: ${topic}. Keep it under 3 sentences and suitable for voice output.`;
    const result = await this.sendMessage(prompt, userId);
    return result.response;
  }

  // Get hint for current lesson
  async getLessonHint(
    lessonTitle: string,
    stepNumber: number,
    userId: string,
    lessonId?: string
  ): Promise<string> {
    const prompt = `I'm on step ${stepNumber} of the lesson "${lessonTitle}". Can you give me a quick hint to help me progress?`;
    const result = await this.sendMessage(prompt, userId, {
      currentLesson: lessonId || lessonTitle,
      currentLessonTitle: lessonTitle,
      currentStep: stepNumber,
    });
    return result.response;
  }

  // Provide encouragement after completing a lesson
  async celebrateCompletion(
    lessonTitle: string,
    score: number,
    userId: string,
    lessonId?: string
  ): Promise<string> {
    const prompt = `I just completed the lesson "${lessonTitle}" with a score of ${score}%. Please celebrate my achievement briefly!`;
    const result = await this.sendMessage(prompt, userId, {
      currentLesson: lessonId,
      currentLessonTitle: lessonTitle,
    });
    return result.response;
  }

  // Explain a Braille pattern
  async explainPattern(pattern: string, userId: string): Promise<string> {
    const prompt = `Explain this Braille pattern to me: ${pattern}. What letter/symbol does it represent and how do I remember it?`;
    const result = await this.sendMessage(prompt, userId);
    return result.response;
  }

  // Get conversation history
  getConversationHistory(): TutorMessage[] {
    return [...this.conversationHistory];
  }

  // Clear conversation history
  clearHistory(): void {
    this.conversationHistory = [];
  }

  // Save chat messages to database
  private async saveChatMessages(userId: string, messages: TutorMessage[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.log('[AITutor] Supabase not configured, skipping chat save');
      return;
    }

    if (!userId) {
      console.error('[AITutor] No userId provided for saving chat');
      return;
    }

    console.log('[AITutor] Saving chat messages for user:', userId);

    try {
      const chatMessages = messages.map(m => ({
        user_id: userId,
        session_id: this.sessionId,
        role: m.role,
        content: m.content,
        created_at: m.timestamp.toISOString(),
      }));

      const { data, error } = await supabase.from('chat_history').insert(chatMessages as any).select();
      
      if (error) {
        console.error('[AITutor] Failed to save chat history:', error);
      } else {
        console.log('[AITutor] Chat saved successfully:', data?.length, 'messages');
      }
    } catch (err) {
      console.error('[AITutor] Exception saving chat history:', err);
    }
  }

  // Load chat history from database
  async loadChatHistory(userId: string, sessionId?: string): Promise<TutorMessage[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      let query = supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error || !data) return [];

      const chatData = data as { id: string; role: string; content: string; created_at: string }[];
      const messages: TutorMessage[] = chatData.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
      }));

      this.conversationHistory = messages;
      return messages;
    } catch {
      return [];
    }
  }

  // Fallback responses when Gemini is not available
  private getFallbackResponse(
    userMessage: string,
    context?: TutorContext
  ): { response: string; error: string | null } {
    const lowerMessage = userMessage.toLowerCase();

    // Common questions and responses
    const responses: Record<string, string> = {
      hello: "Hello! I'm BrailleBot, your Braille learning assistant. How can I help you today?",
      hi: "Hi there! Ready to learn some Braille? Ask me anything!",
      help: "I can help you learn Braille! Try asking about specific letters, contractions, or say 'explain the Braille cell' to get started.",
      'braille cell': "The Braille cell has 6 dots arranged in 2 columns of 3. Dots are numbered 1-2-3 down the left and 4-5-6 down the right. Different combinations represent different letters and symbols.",
      'letter a': "The letter 'A' is just dot 1 - the top-left dot of the cell. It's the simplest letter to learn!",
      'letter b': "The letter 'B' is dots 1 and 2 - the two left-side dots stacked vertically.",
      numbers: "In Braille, numbers use the same patterns as letters A-J, but with a number sign (dots 3-4-5-6) placed before them.",
      contractions: "Contractions are shortened forms of common words. For example, 'the' can be written as just dots 2-3-4-6 instead of spelling out T-H-E.",
      stuck: "Don't worry! Take your time to feel each dot carefully. Try running your finger over the pattern slowly from left to right.",
      thanks: "You're welcome! Keep practicing - you're doing great!",
      thank: "You're welcome! Keep practicing - you're doing great!",
    };

    // Find matching response
    for (const [key, response] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        return { response, error: null };
      }
    }

    // Context-aware default response
    if (context?.currentLesson) {
      return {
        response: `You're doing great with "${context.currentLesson}"! Keep practicing step ${context.currentStep || 1}. Feel free to ask me if you need help with any specific patterns.`,
        error: null,
      };
    }

    // Generic default
    return {
      response: "I'm here to help you learn Braille! You can ask me about letters, numbers, contractions, or say 'help' for more options.",
      error: null,
    };
  }
}

export const aiTutorService = new AITutorService();
export default aiTutorService;
