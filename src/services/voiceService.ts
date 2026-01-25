// Voice Service - Text-to-Speech and Speech-to-Text
import * as Speech from 'expo-speech';
import { NativeModules, Platform } from 'react-native';
import { CONFIG } from '../config';

// Voice recognition import (lazy loaded)
let Voice: any = null;

// Check if running in Expo Go by checking if native Voice module exists
// In Expo Go, native modules like Voice won't be linked
const checkNativeVoiceAvailable = (): boolean => {
  try {
    // Check if the native Voice module is available
    const { Voice: NativeVoice } = NativeModules;
    return !!NativeVoice;
  } catch {
    return false;
  }
};

const nativeVoiceAvailable = checkNativeVoiceAvailable();

// Premium/natural voice identifiers for different platforms
// These are high-quality neural/enhanced voices that sound more human
const PREFERRED_VOICES = {
  ios: [
    // Siri voices (most natural)
    'com.apple.voice.premium.en-US.Zoe',
    'com.apple.voice.premium.en-US.Ava',
    'com.apple.voice.premium.en-IN.Rishi',
    'com.apple.ttsbundle.siri_female_en-US_compact',
    'com.apple.ttsbundle.siri_male_en-US_compact',
    'com.apple.ttsbundle.Samantha-premium',
    'com.apple.ttsbundle.Samantha-compact',
    // Enhanced voices
    'com.apple.voice.enhanced.en-US.Samantha',
    'com.apple.voice.enhanced.en-US.Alex',
    // Standard quality voices
    'Samantha',
    'Karen',
    'Daniel',
  ],
  android: [
    // Google Neural2 voices (most natural)
    'en-us-x-iob-network',
    'en-us-x-iog-network',
    'en-us-x-sfg-network',
    'en-us-x-tpd-network',
    // Google high quality voices
    'en-us-x-sfg-local',
    'en-us-x-iob-local',
    'en-US-language',
    // Samsung voices
    'Samsung',
    // Default Google voice
    'en-us',
  ],
};

export interface VoiceSettings {
  language: string;
  pitch: number;
  rate: number;
  volume: number;
  voice?: string; // Selected voice identifier
}

export interface SpeechResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

type VoiceEventCallback = (event: string, data: any) => void;

class VoiceService {
  private isListening: boolean = false;
  private eventListeners: VoiceEventCallback[] = [];
  private currentSettings: VoiceSettings;
  private isVoiceInitialized: boolean = false;
  private _voiceEnabled: boolean = true;
  private _autoAnnounce: boolean = true;
  private voiceRecognitionAvailable: boolean = nativeVoiceAvailable;
  private selectedVoice: string | null = null;
  private availableVoices: Speech.Voice[] = [];
  private voiceInitialized: boolean = false;

  constructor() {
    this.currentSettings = {
      language: CONFIG.VOICE.DEFAULT_LANGUAGE,
      // Slightly lower pitch for more natural sound
      pitch: 0.95,
      // Slightly slower rate for clarity and natural flow
      rate: 0.85,
      volume: 1.0,
    };
    // Initialize voice selection
    this.initializeBestVoice();
  }

  // Initialize and select the best available voice
  private async initializeBestVoice(): Promise<void> {
    if (this.voiceInitialized) return;
    
    try {
      this.availableVoices = await Speech.getAvailableVoicesAsync();
      
      if (this.availableVoices.length === 0) {
        console.log('No voices available yet, will retry on first speak');
        return;
      }

      const preferredList = Platform.OS === 'ios' 
        ? PREFERRED_VOICES.ios 
        : PREFERRED_VOICES.android;

      // Try to find a premium/enhanced voice
      for (const preferred of preferredList) {
        const found = this.availableVoices.find(v => 
          v.identifier?.toLowerCase().includes(preferred.toLowerCase()) ||
          v.name?.toLowerCase().includes(preferred.toLowerCase())
        );
        if (found) {
          this.selectedVoice = found.identifier;
          console.log(`Selected voice: ${found.name || found.identifier}`);
          this.voiceInitialized = true;
          return;
        }
      }

      // Fallback: Find any English voice with good quality
      const englishVoice = this.availableVoices.find(v => {
        const lang = v.language?.toLowerCase() || '';
        const name = v.name?.toLowerCase() || '';
        const quality = v.quality || '';
        return (
          lang.startsWith('en') && 
          (quality === 'Enhanced' || quality === 'Default' || name.includes('enhanced') || name.includes('premium'))
        );
      });

      if (englishVoice) {
        this.selectedVoice = englishVoice.identifier;
        console.log(`Selected fallback voice: ${englishVoice.name || englishVoice.identifier}`);
      } else {
        // Last resort: first English voice
        const anyEnglish = this.availableVoices.find(v => 
          v.language?.toLowerCase().startsWith('en')
        );
        if (anyEnglish) {
          this.selectedVoice = anyEnglish.identifier;
          console.log(`Selected basic voice: ${anyEnglish.name || anyEnglish.identifier}`);
        }
      }

      this.voiceInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize voice selection:', error);
    }
  }

  // Get currently selected voice info
  getSelectedVoice(): { name: string; identifier: string } | null {
    if (!this.selectedVoice) return null;
    const voice = this.availableVoices.find(v => v.identifier === this.selectedVoice);
    return voice ? { name: voice.name || 'Unknown', identifier: voice.identifier } : null;
  }

  // Enable/disable voice features
  setVoiceEnabled(enabled: boolean): void {
    this._voiceEnabled = enabled;
    if (!enabled) {
      this.stopSpeaking();
    }
  }

  // Enable/disable auto-announcements
  setAutoAnnounce(enabled: boolean): void {
    this._autoAnnounce = enabled;
  }

  // Check if voice is enabled
  isVoiceEnabled(): boolean {
    return this._voiceEnabled;
  }

  // Check if auto-announce is enabled
  isAutoAnnounceEnabled(): boolean {
    return this._autoAnnounce;
  }

  // Check if voice recognition is available (requires development build)
  isVoiceRecognitionAvailable(): boolean {
    return this.voiceRecognitionAvailable && nativeVoiceAvailable;
  }

  // Initialize voice recognition
  async initializeVoiceRecognition(): Promise<{ success: boolean; error: string | null }> {
    if (this.isVoiceInitialized) {
      return { success: this.voiceRecognitionAvailable, error: null };
    }

    // Skip initialization if native Voice module is not available
    if (!nativeVoiceAvailable) {
      console.log('Voice recognition: Native module not available (requires development build)');
      this.isVoiceInitialized = true;
      this.voiceRecognitionAvailable = false;
      return {
        success: false,
        error: 'Voice recognition not available. Create a development build for voice input features.'
      };
    }

    try {
      // Only attempt to load Voice module if not already tried
      if (!Voice) {
        const VoiceModule = await import('@react-native-voice/voice');
        Voice = VoiceModule.default;

        // Verify Voice module is valid before setting handlers
        if (!Voice) {
          throw new Error('Voice module loaded but is undefined');
        }

        // Set up event handlers - check they exist before setting
        if (typeof Voice.onSpeechStart === 'undefined') {
          throw new Error('Voice module missing required event handlers');
        }

        Voice.onSpeechStart = this.onSpeechStart.bind(this);
        Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
        Voice.onSpeechResults = this.onSpeechResults.bind(this);
        Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
        Voice.onSpeechError = this.onSpeechError.bind(this);
      }

      this.isVoiceInitialized = true;
      this.voiceRecognitionAvailable = true;
      return { success: true, error: null };
    } catch (err) {
      console.warn('Voice recognition not available:', (err as Error).message);
      // Mark as initialized to avoid retry attempts
      this.isVoiceInitialized = true;
      this.voiceRecognitionAvailable = false;
      Voice = null;
      return { 
        success: false, 
        error: 'Voice recognition not available - create a development build to enable voice features.' 
      };
    }
  }

  // Text-to-Speech: Speak text
  async speak(text: string, options?: Partial<VoiceSettings>): Promise<void> {
    // Check if voice is enabled
    if (!this._voiceEnabled) {
      return;
    }

    // Ensure best voice is selected
    if (!this.voiceInitialized) {
      await this.initializeBestVoice();
    }

    // Stop any current speech
    await this.stopSpeaking();

    const settings = { ...this.currentSettings, ...options };

    // Process text for more natural speech:
    // - Add slight pauses at punctuation
    // - Break long sentences
    const processedText = this.processTextForNaturalSpeech(text);

    return new Promise((resolve, reject) => {
      try {
        const speechOptions: Speech.SpeechOptions = {
          language: settings.language,
          pitch: settings.pitch,
          rate: settings.rate,
          volume: settings.volume,
          onDone: () => {
            this.emitEvent('speechComplete', { text });
            resolve();
          },
          onError: (error) => {
            this.emitEvent('speechError', { error });
            reject(error);
          },
          onStart: () => {
            this.emitEvent('speechStart', { text });
          },
        };

        // Use selected voice if available (for more natural sound)
        if (this.selectedVoice) {
          speechOptions.voice = this.selectedVoice;
        }

        Speech.speak(processedText, speechOptions);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Process text for more natural-sounding speech
  private processTextForNaturalSpeech(text: string): string {
    let processed = text;
    
    // Add slight pauses after periods (using SSML-like approach)
    // Most TTS engines interpret multiple spaces as natural pauses
    processed = processed.replace(/\. /g, '.  ');
    
    // Add pause after commas
    processed = processed.replace(/, /g, ',  ');
    
    // Add pause before "and" for more natural lists
    processed = processed.replace(/ and /gi, '  and ');
    
    // Remove excessive spaces
    processed = processed.replace(/\s{3,}/g, '  ');
    
    // Handle common abbreviations that sound robotic
    processed = processed.replace(/\bDr\./gi, 'Doctor');
    processed = processed.replace(/\bMr\./gi, 'Mister');
    processed = processed.replace(/\bMrs\./gi, 'Misses');
    processed = processed.replace(/\bMs\./gi, 'Miss');
    
    return processed.trim();
  }

  // Speak with interrupt capability
  async speakInterruptible(text: string, options?: Partial<VoiceSettings>): Promise<void> {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }
    return this.speak(text, options);
  }

  // Stop speaking
  async stopSpeaking(): Promise<void> {
    try {
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) {
        await Speech.stop();
      }
    } catch (err) {
      console.error('Stop speaking error:', err);
    }
  }

  // Pause speaking
  async pauseSpeaking(): Promise<void> {
    try {
      await Speech.pause();
    } catch (err) {
      console.error('Pause speaking error:', err);
    }
  }

  // Resume speaking
  async resumeSpeaking(): Promise<void> {
    try {
      await Speech.resume();
    } catch (err) {
      console.error('Resume speaking error:', err);
    }
  }

  // Check if currently speaking
  async isSpeaking(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch {
      return false;
    }
  }

  // Get available voices (useful for settings)
  async getAvailableVoices(): Promise<Speech.Voice[]> {
    try {
      this.availableVoices = await Speech.getAvailableVoicesAsync();
      return this.availableVoices;
    } catch {
      return [];
    }
  }

  // Get available English voices for UI selection
  async getEnglishVoices(): Promise<{ name: string; identifier: string; quality: string }[]> {
    const voices = await this.getAvailableVoices();
    return voices
      .filter(v => v.language?.toLowerCase().startsWith('en'))
      .map(v => ({
        name: v.name || v.identifier,
        identifier: v.identifier,
        quality: v.quality || 'Default',
      }))
      .sort((a, b) => {
        // Prefer enhanced/premium voices
        if (a.quality === 'Enhanced' && b.quality !== 'Enhanced') return -1;
        if (b.quality === 'Enhanced' && a.quality !== 'Enhanced') return 1;
        return a.name.localeCompare(b.name);
      });
  }

  // Set a specific voice
  setVoice(voiceIdentifier: string): void {
    this.selectedVoice = voiceIdentifier;
    console.log(`Voice changed to: ${voiceIdentifier}`);
  }

  // Speech-to-Text: Start listening
  async startListening(): Promise<{ success: boolean; error: string | null }> {
    if (!this.isVoiceInitialized) {
      const init = await this.initializeVoiceRecognition();
      if (!init.success) {
        return init;
      }
    }

    // Check if Voice module is available
    if (!Voice) {
      return {
        success: false,
        error: 'Voice recognition not available. Create a development build to enable voice features.'
      };
    }

    if (this.isListening) {
      return { success: true, error: null };
    }

    try {
      await Voice.start(this.currentSettings.language);
      this.isListening = true;
      return { success: true, error: null };
    } catch (err) {
      console.error('Start listening error:', err);
      return { 
        success: false, 
        error: `Failed to start listening: ${(err as Error).message}` 
      };
    }
  }

  // Stop listening
  async stopListening(): Promise<void> {
    if (!this.isListening || !Voice) return;

    try {
      await Voice.stop();
      this.isListening = false;
    } catch (err) {
      console.error('Stop listening error:', err);
    }
  }

  // Cancel listening
  async cancelListening(): Promise<void> {
    if (!Voice) return;

    try {
      await Voice.cancel();
      this.isListening = false;
    } catch (err) {
      console.error('Cancel listening error:', err);
    }
  }

  // Check if currently listening
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  // Update voice settings
  updateSettings(settings: Partial<VoiceSettings>): void {
    this.currentSettings = { ...this.currentSettings, ...settings };
  }

  // Get current settings
  getSettings(): VoiceSettings {
    return { ...this.currentSettings };
  }

  // Add event listener
  addEventListener(callback: VoiceEventCallback): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
    };
  }

  // Remove event listener
  removeEventListener(callback: VoiceEventCallback): void {
    this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
  }

  // Speak Braille pattern description
  async speakBraillePattern(dots: number[], letter: string): Promise<void> {
    const dotDescription = dots.length === 0 
      ? 'empty cell' 
      : `dots ${dots.join(' ')}`;
    
    const text = `The letter ${letter} is ${dotDescription}`;
    return this.speak(text);
  }

  // Speak lesson content
  async speakLessonContent(content: string): Promise<void> {
    // Clean content for better speech
    const cleanedContent = content
      .replace(/\n/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return this.speak(cleanedContent);
  }

  // Speak with emphasis (slower for important content)
  async speakWithEmphasis(text: string): Promise<void> {
    return this.speak(text, { rate: this.currentSettings.rate * 0.8 });
  }

  // Voice command processing
  processVoiceCommand(text: string): { 
    command: string | null; 
    args: string[] 
  } {
    const lowerText = text.toLowerCase().trim();
    
    // Navigation commands
    if (lowerText.includes('go to') || lowerText.includes('open')) {
      if (lowerText.includes('home')) return { command: 'navigate', args: ['home'] };
      if (lowerText.includes('lesson')) return { command: 'navigate', args: ['lessons'] };
      if (lowerText.includes('progress')) return { command: 'navigate', args: ['progress'] };
      if (lowerText.includes('settings')) return { command: 'navigate', args: ['settings'] };
      if (lowerText.includes('device')) return { command: 'navigate', args: ['device'] };
    }

    // Lesson commands
    if (lowerText.includes('next') || lowerText.includes('continue')) {
      return { command: 'lesson', args: ['next'] };
    }
    if (lowerText.includes('previous') || lowerText.includes('back')) {
      return { command: 'lesson', args: ['previous'] };
    }
    if (lowerText.includes('repeat') || lowerText.includes('again')) {
      return { command: 'lesson', args: ['repeat'] };
    }
    if (lowerText.includes('hint') || lowerText.includes('help')) {
      return { command: 'lesson', args: ['hint'] };
    }

    // Print commands
    if (lowerText.includes('print')) {
      return { command: 'print', args: [text] };
    }

    // Stop/pause commands
    if (lowerText.includes('stop') || lowerText.includes('quiet')) {
      return { command: 'speech', args: ['stop'] };
    }
    if (lowerText.includes('pause')) {
      return { command: 'speech', args: ['pause'] };
    }
    if (lowerText.includes('resume') || lowerText.includes('continue')) {
      return { command: 'speech', args: ['resume'] };
    }

    // AI Tutor commands
    if (lowerText.includes('ask') || lowerText.includes('what is') || 
        lowerText.includes('explain') || lowerText.includes('how')) {
      return { command: 'ask', args: [text] };
    }

    return { command: null, args: [] };
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.stopSpeaking();
    await this.cancelListening();
    
    if (Voice) {
      Voice.destroy().then(Voice.removeAllListeners);
    }
    
    this.isVoiceInitialized = false;
    this.eventListeners = [];
  }

  // Private methods
  private onSpeechStart(): void {
    this.emitEvent('voiceStart', {});
  }

  private onSpeechEnd(): void {
    this.isListening = false;
    this.emitEvent('voiceEnd', {});
  }

  private onSpeechResults(event: any): void {
    const results = event.value || [];
    if (results.length > 0) {
      this.emitEvent('voiceResult', {
        text: results[0],
        confidence: 1.0,
        isFinal: true,
        allResults: results,
      } as SpeechResult);
    }
  }

  private onSpeechPartialResults(event: any): void {
    const results = event.value || [];
    if (results.length > 0) {
      this.emitEvent('voicePartialResult', {
        text: results[0],
        confidence: 0.5,
        isFinal: false,
      } as SpeechResult);
    }
  }

  private onSpeechError(event: any): void {
    this.isListening = false;
    this.emitEvent('voiceError', { error: event.error });
  }

  private emitEvent(event: string, data: any): void {
    for (const callback of this.eventListeners) {
      try {
        callback(event, data);
      } catch (err) {
        console.error('Event listener error:', err);
      }
    }
  }
}

export const voiceService = new VoiceService();
export default voiceService;
