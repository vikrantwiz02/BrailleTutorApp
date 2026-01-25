// Global Voice Command Service for Accessibility
import { voiceService } from './voiceService';
import { aiTutorService } from './aiTutorService';

export type VoiceCommandType = 
  | 'navigate' 
  | 'lesson' 
  | 'print' 
  | 'speech' 
  | 'ask' 
  | 'settings'
  | 'device'
  | 'notification'
  | 'help'
  | 'unknown';

export interface VoiceCommand {
  type: VoiceCommandType;
  action: string;
  args: string[];
  confidence: number;
  originalText: string;
}

export interface VoiceCommandHandler {
  onNavigate?: (screen: string) => void;
  onLessonAction?: (action: 'next' | 'previous' | 'repeat' | 'hint' | 'start' | 'complete' | 'practice' | 'challenge') => void;
  onSpeechAction?: (action: 'stop' | 'pause' | 'resume' | 'louder' | 'softer' | 'faster' | 'slower') => void;
  onAskTutor?: (question: string) => void;
  onSettingsAction?: (setting: string, value?: string) => void;
  onDeviceAction?: (action: 'connect' | 'disconnect' | 'scan' | 'status') => void;
  onNotificationAction?: (action: 'read' | 'clear' | 'open') => void;
  onHelpRequested?: () => void;
  onUnknownCommand?: (text: string) => void;
}

class VoiceCommandService {
  private handlers: VoiceCommandHandler = {};
  private isListening: boolean = false;
  private isEnabled: boolean = true;
  private currentContext: string = 'home';
  private removeListener: (() => void) | null = null;
  private isInitialized: boolean = false;

  // Voice command patterns for better recognition
  private commandPatterns = {
    help: [
      { pattern: /^help$/i, action: 'help' },
      { pattern: /^help me$/i, action: 'help' },
      { pattern: /(?:what|show|tell me)\s+(?:the\s+)?(?:voice\s+)?commands?/i, action: 'help' },
      { pattern: /(?:how|what)\s+can\s+(?:i|you)\s+(?:say|do)/i, action: 'help' },
    ],
    navigation: [
      { pattern: /(?:go to|open|show|navigate to)\s+(\w+)/i, action: 'navigate' },
      { pattern: /^(home|lessons?|progress|settings|device|connect)$/i, action: 'navigate' },
    ],
    lesson: [
      { pattern: /(?:next|continue|forward)/i, action: 'next' },
      { pattern: /(?:previous|back|go back)/i, action: 'previous' },
      { pattern: /(?:repeat|again|say again|replay)/i, action: 'repeat' },
      { pattern: /(?:give me a\s+)?hint/i, action: 'hint' },
      { pattern: /(?:start|begin)\s+(?:lesson|learning)/i, action: 'start' },
      { pattern: /(?:complete|finish|done)/i, action: 'complete' },
      { pattern: /(?:practice|quick practice)/i, action: 'practice' },
      { pattern: /(?:challenge|test me|quiz)/i, action: 'challenge' },
    ],
    speech: [
      { pattern: /(?:stop|quiet|silence|shut up)/i, action: 'stop' },
      { pattern: /(?:pause|wait)/i, action: 'pause' },
      { pattern: /(?:resume|continue speaking)/i, action: 'resume' },
      { pattern: /(?:louder|volume up|speak louder)/i, action: 'louder' },
      { pattern: /(?:softer|volume down|speak softer|quieter)/i, action: 'softer' },
      { pattern: /(?:faster|speed up|speak faster)/i, action: 'faster' },
      { pattern: /(?:slower|slow down|speak slower)/i, action: 'slower' },
    ],
    device: [
      { pattern: /(?:connect|pair)\s+(?:device|braille)/i, action: 'connect' },
      { pattern: /(?:disconnect)\s+(?:device|braille)/i, action: 'disconnect' },
      { pattern: /(?:scan|search|find)\s+(?:device|braille)/i, action: 'scan' },
      { pattern: /(?:device|connection)\s+(?:status|info)/i, action: 'status' },
    ],
    notification: [
      { pattern: /(?:read|check)\s+(?:notification|alert)/i, action: 'read' },
      { pattern: /(?:clear|dismiss)\s+(?:notification|alert)/i, action: 'clear' },
      { pattern: /(?:open|show)\s+(?:notification|alert)/i, action: 'open' },
    ],
    question: [
      { pattern: /(?:what is|explain|how do|tell me about|describe)\s+(.+)/i, action: 'ask' },
      { pattern: /(?:ask|question)\s+(.+)/i, action: 'ask' },
    ],
  };

  // Initialize voice command listening
  async initialize(): Promise<{ success: boolean; error: string | null }> {
    try {
      const result = await voiceService.initializeVoiceRecognition();
      if (!result.success) {
        return result;
      }

      // Set up voice result listener
      this.removeListener = voiceService.addEventListener((event, data) => {
        if (event === 'voiceResult' && data.isFinal) {
          this.processCommand(data.text);
        }
      });

      return { success: true, error: null };
    } catch (error) {
      console.error('Voice command init error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Set command handlers
  setHandlers(handlers: VoiceCommandHandler): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // Set current context (affects command interpretation)
  setContext(context: string): void {
    this.currentContext = context;
  }

  // Enable/disable voice commands
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Start listening for commands
  async startListening(): Promise<void> {
    if (!this.isEnabled) return;
    
    try {
      await voiceService.startListening();
      this.isListening = true;
      
      // Provide audio feedback
      await voiceService.speak("I'm listening", { rate: 1.2 });
    } catch (error) {
      console.error('Start listening error:', error);
    }
  }

  // Stop listening
  async stopListening(): Promise<void> {
    try {
      await voiceService.stopListening();
      this.isListening = false;
    } catch (error) {
      console.error('Stop listening error:', error);
    }
  }

  // Toggle listening state
  async toggleListening(): Promise<boolean> {
    if (this.isListening) {
      await this.stopListening();
    } else {
      await this.startListening();
    }
    return this.isListening;
  }

  // Process voice command
  private async processCommand(text: string): Promise<void> {
    if (!this.isEnabled || !text) return;

    console.log('[VoiceCommand] Processing:', text);
    const command = this.parseCommand(text);
    console.log('[VoiceCommand] Parsed:', command);

    await this.executeCommand(command);
  }

  // Parse text into a command
  private parseCommand(text: string): VoiceCommand {
    const lowerText = text.toLowerCase().trim();

    // Check help commands FIRST (highest priority)
    for (const { pattern } of this.commandPatterns.help) {
      if (pattern.test(lowerText)) {
        return {
          type: 'help',
          action: 'help',
          args: [],
          confidence: 1.0,
          originalText: text,
        };
      }
    }

    // Check navigation commands
    for (const { pattern, action } of this.commandPatterns.navigation) {
      const match = lowerText.match(pattern);
      if (match) {
        const screen = match[1] || action;
        return {
          type: 'navigate',
          action: this.normalizeScreen(screen),
          args: [screen],
          confidence: 0.9,
          originalText: text,
        };
      }
    }

    // Check lesson commands (context-aware)
    for (const { pattern, action } of this.commandPatterns.lesson) {
      if (pattern.test(lowerText)) {
        return {
          type: 'lesson',
          action,
          args: [],
          confidence: 0.9,
          originalText: text,
        };
      }
    }

    // Check speech commands
    for (const { pattern, action } of this.commandPatterns.speech) {
      if (pattern.test(lowerText)) {
        return {
          type: 'speech',
          action,
          args: [],
          confidence: 0.95,
          originalText: text,
        };
      }
    }

    // Check device commands
    for (const { pattern, action } of this.commandPatterns.device) {
      if (pattern.test(lowerText)) {
        return {
          type: 'device',
          action,
          args: [],
          confidence: 0.9,
          originalText: text,
        };
      }
    }

    // Check notification commands
    for (const { pattern, action } of this.commandPatterns.notification) {
      if (pattern.test(lowerText)) {
        return {
          type: 'notification',
          action,
          args: [],
          confidence: 0.9,
          originalText: text,
        };
      }
    }

    // Check question commands (ask AI tutor)
    for (const { pattern } of this.commandPatterns.question) {
      const match = lowerText.match(pattern);
      if (match) {
        return {
          type: 'ask',
          action: 'question',
          args: [match[1] || text],
          confidence: 0.85,
          originalText: text,
        };
      }
    }

    // Unknown command - might be a question to AI
    return {
      type: 'unknown',
      action: 'unknown',
      args: [text],
      confidence: 0.5,
      originalText: text,
    };
  }

  // Normalize screen names
  private normalizeScreen(screen: string): string {
    const screenMap: Record<string, string> = {
      'home': 'Home',
      'lesson': 'Lessons',
      'lessons': 'Lessons',
      'progress': 'Progress',
      'settings': 'Settings',
      'device': 'Device',
      'connect': 'Device',
    };
    return screenMap[screen.toLowerCase()] || screen;
  }

  // Execute a parsed command
  private async executeCommand(command: VoiceCommand): Promise<void> {
    try {
      switch (command.type) {
        case 'help':
          // Always handle help - read available commands
          await this.readAvailableCommands();
          if (this.handlers.onHelpRequested) {
            this.handlers.onHelpRequested();
          }
          break;

        case 'navigate':
          if (this.handlers.onNavigate) {
            await voiceService.speak(`Going to ${command.action}`);
            this.handlers.onNavigate(command.action);
          }
          break;

        case 'lesson':
          if (this.handlers.onLessonAction) {
            this.handlers.onLessonAction(command.action as any);
          }
          break;

        case 'speech':
          await this.handleSpeechCommand(command.action);
          break;

        case 'device':
          if (this.handlers.onDeviceAction) {
            await voiceService.speak(`${command.action}ing device`);
            this.handlers.onDeviceAction(command.action as any);
          }
          break;

        case 'notification':
          if (this.handlers.onNotificationAction) {
            this.handlers.onNotificationAction(command.action as any);
          }
          break;

        case 'ask':
          if (this.handlers.onAskTutor) {
            this.handlers.onAskTutor(command.args[0]);
          } else {
            // Default: send to AI tutor
            await this.askAITutor(command.args[0]);
          }
          break;

        case 'unknown':
          // Try to help the user
          if (this.handlers.onUnknownCommand) {
            this.handlers.onUnknownCommand(command.originalText);
          } else {
            // Send to AI as a question
            await this.askAITutor(command.originalText);
          }
          break;
      }
    } catch (error) {
      console.error('Command execution error:', error);
      await voiceService.speak("Sorry, I couldn't do that. Please try again.");
    }
  }

  // Handle speech control commands
  private async handleSpeechCommand(action: string): Promise<void> {
    const settings = voiceService.getSettings();

    switch (action) {
      case 'stop':
        await voiceService.stopSpeaking();
        break;
      case 'pause':
        await voiceService.pauseSpeaking();
        break;
      case 'resume':
        await voiceService.resumeSpeaking();
        break;
      case 'louder':
        voiceService.updateSettings({ volume: Math.min(1.0, settings.volume + 0.2) });
        await voiceService.speak('Volume increased');
        break;
      case 'softer':
        voiceService.updateSettings({ volume: Math.max(0.2, settings.volume - 0.2) });
        await voiceService.speak('Volume decreased');
        break;
      case 'faster':
        voiceService.updateSettings({ rate: Math.min(1.5, settings.rate + 0.25) });
        await voiceService.speak('Speaking faster');
        break;
      case 'slower':
        voiceService.updateSettings({ rate: Math.max(0.5, settings.rate - 0.25) });
        await voiceService.speak('Speaking slower');
        break;
    }
  }

  // Ask AI tutor
  private async askAITutor(question: string): Promise<void> {
    try {
      await voiceService.speak('Let me think about that.');
      
      const response = await aiTutorService.sendMessage(question, 'voice-user', {
        currentLesson: this.currentContext,
      });
      
      await voiceService.speak(response.response);
    } catch (error) {
      console.error('AI tutor error:', error);
      await voiceService.speak("I'm sorry, I couldn't answer that right now.");
    }
  }

  // Provide audio guidance for current screen
  async announceScreen(screenName: string, details?: string): Promise<void> {
    let announcement = `You are on the ${screenName} screen.`;
    if (details) {
      announcement += ` ${details}`;
    }
    announcement += ' Say "help" for available commands.';
    await voiceService.speak(announcement);
  }

  // Read available commands for current context
  async readAvailableCommands(): Promise<void> {
    let commands = 'Available voice commands: ';
    
    switch (this.currentContext) {
      case 'home':
        commands += 'Go to lessons, Go to progress, Go to settings, Connect device, Read notifications.';
        break;
      case 'lessons':
        commands += 'Start lesson, Go home, Go to progress.';
        break;
      case 'lessonDetail':
        commands += 'Start lesson, Quick practice, Challenge, Go back.';
        break;
      case 'activeLesson':
        commands += 'Next, Previous, Repeat, Hint, Practice, Challenge, Complete, Exit.';
        break;
      case 'device':
        commands += 'Connect, Disconnect, Scan for devices, Device status.';
        break;
      case 'settings':
        commands += 'Go home, Go to lessons, Voice commands help.';
        break;
      default:
        commands += 'Go to home, Go to lessons, Go to settings, Help.';
    }
    
    commands += ' You can also ask me any question about Braille.';
    await voiceService.speak(commands);
  }

  // Cleanup
  cleanup(): void {
    if (this.removeListener) {
      this.removeListener();
    }
    this.handlers = {};
  }
}

export const voiceCommandService = new VoiceCommandService();
export default voiceCommandService;
