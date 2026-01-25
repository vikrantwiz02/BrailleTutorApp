import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase, isSupabaseConfigured } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  voiceEnabled: boolean;
  voiceSpeed: number;
  audioVolume: number;
  autoAnnounce: boolean; // Auto screen announcements for accessibility
  language: string;
  notificationsEnabled: boolean;
  darkMode: boolean;
  hapticFeedback: boolean;
  highContrastMode: boolean;
  largeText: boolean;
  loading: boolean;
}

const initialState: SettingsState = {
  voiceEnabled: true,
  voiceSpeed: 1.0,
  audioVolume: 0.8,
  autoAnnounce: true,
  language: 'English',
  notificationsEnabled: true,
  darkMode: true,
  hapticFeedback: true,
  highContrastMode: false,
  largeText: false,
  loading: false,
};

const SETTINGS_STORAGE_KEY = '@braille_tutor_settings';

// Load settings from storage
export const loadSettings = createAsyncThunk(
  'settings/load',
  async (userId?: string) => {
    try {
      // Try local storage first
      const localSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (localSettings) {
        return JSON.parse(localSettings);
      }

      // If Supabase is configured and user is logged in, try to load from there
      if (userId && isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (!error && data) {
          const settings = {
            voiceEnabled: data.voice_enabled ?? true,
            voiceSpeed: data.voice_speed ?? 1.0,
            audioVolume: data.audio_volume ?? 0.8,
            autoAnnounce: data.auto_announce ?? true,
            language: data.language ?? 'English',
            notificationsEnabled: data.notifications_enabled ?? true,
            darkMode: data.dark_mode ?? true,
            hapticFeedback: data.haptic_feedback ?? true,
            highContrastMode: data.high_contrast ?? false,
            largeText: data.large_text ?? false,
          };
          // Cache locally
          await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
          return settings;
        }
      }
      
      return null;
    } catch (error) {
      console.log('Error loading settings:', error);
      return null;
    }
  }
);

// Save settings to storage
export const saveSettings = createAsyncThunk(
  'settings/save',
  async ({ settings, userId }: { settings: Partial<SettingsState>; userId?: string }) => {
    try {
      // Get current settings
      const localData = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      const currentSettings = localData ? JSON.parse(localData) : initialState;
      const updatedSettings = { ...currentSettings, ...settings };
      
      // Save locally
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));

      // Save to Supabase if configured
      if (userId && isSupabaseConfigured()) {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            voice_enabled: updatedSettings.voiceEnabled,
            voice_speed: updatedSettings.voiceSpeed,
            audio_volume: updatedSettings.audioVolume,
            auto_announce: updatedSettings.autoAnnounce,
            language: updatedSettings.language,
            notifications_enabled: updatedSettings.notificationsEnabled,
            dark_mode: updatedSettings.darkMode,
            haptic_feedback: updatedSettings.hapticFeedback,
            high_contrast: updatedSettings.highContrastMode,
            large_text: updatedSettings.largeText,
            updated_at: new Date().toISOString(),
          });
      }

      return updatedSettings;
    } catch (error) {
      console.log('Error saving settings:', error);
      throw error;
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSetting: (state, action: PayloadAction<Partial<SettingsState>>) => {
      return { ...state, ...action.payload };
    },
    resetSettings: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          return { ...state, ...action.payload, loading: false };
        }
      })
      .addCase(loadSettings.rejected, (state) => {
        state.loading = false;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        return { ...state, ...action.payload };
      });
  },
});

export const { updateSetting, resetSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
