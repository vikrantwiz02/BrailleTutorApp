// Voice Service - Text-to-Speech and Speech-to-Text
import * as Speech from 'expo-speech';
import { NativeModules, Platform } from 'react-native';
import { CONFIG } from '../config';

// Voice recognition import (lazy loaded)
let Voice: any = null;

// We'll check availability when actually trying to use it,
// not at module load time (which can fail prematurely)

// Premium/natural voice identifiers for different platforms and languages
// These are high-quality neural/enhanced voices that sound more human
const PREFERRED_VOICES = {
  ios: {
    'en-US': [
      'com.apple.voice.premium.en-US.Zoe',
      'com.apple.voice.premium.en-US.Ava',
      'com.apple.ttsbundle.siri_female_en-US_compact',
      'com.apple.voice.enhanced.en-US.Samantha',
      'Samantha',
    ],
    'hi-IN': [
      'com.apple.voice.premium.hi-IN.Rishi',
      'com.apple.voice.enhanced.hi-IN.Lekha',
      'Lekha',
    ],
    'es-ES': [
      'com.apple.voice.premium.es-ES.Monica',
      'com.apple.voice.enhanced.es-ES.Monica',
      'Monica',
    ],
  },
  android: {
    'en-US': [
      'en-us-x-iob-network',
      'en-us-x-iog-network',
      'en-us-x-sfg-network',
      'en-US-language',
    ],
    'hi-IN': [
      'hi-in-x-hia-network',
      'hi-in-x-hid-network',
      'hi-IN-language',
    ],
    'es-ES': [
      'es-es-x-eea-network',
      'es-es-x-eed-network',
      'es-ES-language',
    ],
  },
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

// Language mapping
const LANGUAGE_MAP: Record<string, string> = {
  'English': 'en-US',
  'Hindi': 'hi-IN',
  'Spanish': 'es-ES',
  'en-US': 'en-US',
  'hi-IN': 'hi-IN',
  'es-ES': 'es-ES',
};

// Store reference to get current language from Redux
let languageGetter: (() => string) | null = null;

class VoiceService {
  private isListening: boolean = false;
  private eventListeners: VoiceEventCallback[] = [];
  private currentSettings: VoiceSettings;
  private isVoiceInitialized: boolean = false;
  private _voiceEnabled: boolean = true;
  private _autoAnnounce: boolean = true;
  private voiceRecognitionAvailable: boolean = false;
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
    // Don't initialize voice here - wait until first speak() call
    // so we have the correct language from Redux
  }

  // Set language getter function (called from App.tsx with Redux store)
  setLanguageGetter(getter: () => string): void {
    languageGetter = getter;
  }

  // Get current language from Redux or fallback
  private getCurrentLanguage(): string {
    if (languageGetter) {
      const lang = languageGetter();
      const mapped = LANGUAGE_MAP[lang] || lang || 'en-US';
      console.log(`Language from Redux: ${lang} -> ${mapped}`);
      return mapped;
    }
    console.log(`No language getter, using default: ${this.currentSettings.language}`);
    return this.currentSettings.language;
  }

  // Initialize and select the best available voice for a language
  private async initializeBestVoice(language: string = 'en-US'): Promise<void> {
    try {
      this.availableVoices = await Speech.getAvailableVoicesAsync();
      
      if (this.availableVoices.length === 0) {
        console.log('No voices available yet, will retry on first speak');
        return;
      }

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const preferredList = PREFERRED_VOICES[platform][language] || PREFERRED_VOICES[platform]['en-US'];

      // Try to find a premium/enhanced voice for the language
      for (const preferred of preferredList) {
        const found = this.availableVoices.find(v => 
          v.identifier?.toLowerCase().includes(preferred.toLowerCase()) ||
          v.name?.toLowerCase().includes(preferred.toLowerCase())
        );
        if (found) {
          this.selectedVoice = found.identifier;
          console.log(`Selected voice for ${language}: ${found.name || found.identifier}`);
          this.voiceInitialized = true;
          return;
        }
      }

      // Fallback: Find any voice matching the language
      const langPrefix = language.split('-')[0].toLowerCase();
      const langVoice = this.availableVoices.find(v => {
        const voiceLang = v.language?.toLowerCase() || '';
        return voiceLang.startsWith(langPrefix);
      });

      if (langVoice) {
        this.selectedVoice = langVoice.identifier;
        console.log(`Selected fallback voice for ${language}: ${langVoice.name || langVoice.identifier}`);
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
    return this.voiceRecognitionAvailable;
  }

  // Initialize voice recognition
  async initializeVoiceRecognition(): Promise<{ success: boolean; error: string | null }> {
    if (this.isVoiceInitialized) {
      return { success: this.voiceRecognitionAvailable, error: null };
    }

    try {
      // Try native Android voice recognition first
      if (Platform.OS === 'android') {
        const VoiceRecognitionModule = NativeModules.VoiceRecognition;
        if (VoiceRecognitionModule) {
          const available = await VoiceRecognitionModule.isAvailable();
          if (available) {
            console.log('Native voice recognition available!');
            Voice = VoiceRecognitionModule;
            
            // Set up event listeners for native module
            const { DeviceEventEmitter } = require('react-native');
            
            DeviceEventEmitter.addListener('onSpeechStart', () => {
              this.onSpeechStart();
            });
            
            DeviceEventEmitter.addListener('onSpeechEnd', () => {
              this.onSpeechEnd();
            });
            
            DeviceEventEmitter.addListener('onSpeechResults', (event: any) => {
              this.onSpeechResults(event);
            });
            
            DeviceEventEmitter.addListener('onSpeechPartialResults', (event: any) => {
              this.onSpeechPartialResults(event);
            });
            
            DeviceEventEmitter.addListener('onSpeechError', (event: any) => {
              this.onSpeechError(event);
            });
            
            console.log('Native voice event listeners registered');
            
            this.isVoiceInitialized = true;
            this.voiceRecognitionAvailable = true;
            return { success: true, error: null };
          }
        }
      }

      // Fallback: Try to load @react-native-voice/voice module
      if (!Voice) {
        console.log('Attempting to load @react-native-voice/voice module...');
        const VoiceModule = await import('@react-native-voice/voice');
        Voice = VoiceModule.default;

        // Verify Voice module is valid
        if (!Voice) {
          throw new Error('Voice module loaded but is undefined');
        }

        console.log('Voice module loaded successfully!');

        // Set up event handlers
        Voice.onSpeechStart = this.onSpeechStart.bind(this);
        Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
        Voice.onSpeechResults = this.onSpeechResults.bind(this);
        Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
        Voice.onSpeechError = this.onSpeechError.bind(this);
        
        console.log('Voice event handlers registered');
      }

      this.isVoiceInitialized = true;
      this.voiceRecognitionAvailable = true;
      console.log('Voice recognition is now available!');
      return { success: true, error: null };
    } catch (err) {
      const errorMessage = (err as Error).message;
      console.error('Failed to initialize voice recognition:', errorMessage);
      // Mark as initialized to avoid retry attempts
      this.isVoiceInitialized = true;
      this.voiceRecognitionAvailable = false;
      Voice = null;
      return { 
        success: false, 
        error: `Voice recognition not available. This feature requires microphone permissions.` 
      };
    }
  }

  // Text-to-Speech: Speak text
  async speak(text: string, options?: Partial<VoiceSettings>): Promise<void> {
    // Check if voice is enabled
    if (!this._voiceEnabled) {
      return;
    }

    // Get current language from Redux every time
    const currentLang = this.getCurrentLanguage();
    console.log(`Speaking in language: ${currentLang}`);
    
    // Always reinitialize voice if language changed OR not yet initialized
    if (!this.voiceInitialized || currentLang !== this.currentSettings.language) {
      console.log(`Initializing voice for ${currentLang} (was: ${this.currentSettings.language})`);
      this.currentSettings.language = currentLang;
      this.voiceInitialized = false;
      await this.initializeBestVoice(currentLang);
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
        error: 'Voice recognition not available. Please ensure microphone permissions are granted.'
      };
    }

    if (this.isListening) {
      return { success: true, error: null };
    }

    try {
      // Get current language
      const currentLang = this.getCurrentLanguage();
      console.log(`Starting voice recognition in language: ${currentLang}`);
      
      // Check if using native module or @react-native-voice/voice
      if (Voice.startListening && typeof Voice.startListening === 'function') {
        // Native Android module
        await Voice.startListening(currentLang);
      } else if (Voice.start && typeof Voice.start === 'function') {
        // @react-native-voice/voice module
        await Voice.start(currentLang);
      } else {
        throw new Error('No valid start method found on Voice module');
      }
      
      this.isListening = true;
      return { success: true, error: null };
    } catch (err) {
      console.error('Start listening error:', err);
      this.isListening = false;
      return { 
        success: false, 
        error: `Voice recognition failed: ${(err as Error).message}. Please ensure microphone permissions are granted.` 
      };
    }
  }

  // Stop listening
  async stopListening(): Promise<void> {
    if (!this.isListening || !Voice) return;

    try {
      // Check if using native module or @react-native-voice/voice
      if (Voice.stopListening && typeof Voice.stopListening === 'function') {
        // Native Android module
        await Voice.stopListening();
      } else if (Voice.stop && typeof Voice.stop === 'function') {
        // @react-native-voice/voice module
        await Voice.stop();
      }
      this.isListening = false;
    } catch (err) {
      console.error('Stop listening error:', err);
    }
  }

  // Cancel listening
  async cancelListening(): Promise<void> {
    if (!Voice) return;

    try {
      // Check if using native module or @react-native-voice/voice
      if (Voice.cancelListening && typeof Voice.cancelListening === 'function') {
        // Native Android module
        await Voice.cancelListening();
      } else if (Voice.cancel && typeof Voice.cancel === 'function') {
        // @react-native-voice/voice module
        await Voice.cancel();
      }
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
  async updateSettings(settings: Partial<VoiceSettings>): Promise<void> {
    const oldLanguage = this.currentSettings.language;
    this.currentSettings = { ...this.currentSettings, ...settings };
    
    // If language changed, reinitialize voice for new language
    if (settings.language && settings.language !== oldLanguage) {
      this.voiceInitialized = false;
      await this.initializeBestVoice(settings.language);
      console.log(`Voice updated for language: ${settings.language}`);
    }
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
