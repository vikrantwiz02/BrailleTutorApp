// App Configuration
export * from './supabase';
export * from './gemini';

// Environment
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// App Settings
export const APP_CONFIG = {
  // App Info
  name: 'Braille Tutor',
  version: '1.0.0',
  
  // API Limits
  geminiRateLimit: 60, // requests per minute
  geminiDailyLimit: 1500, // requests per day
  
  // BLE Settings
  ble: {
    scanTimeout: 10000, // 10 seconds
    connectionTimeout: 30000, // 30 seconds
    serviceUUID: '0000ffe0-0000-1000-8000-00805f9b34fb', // Common BLE UART service
    characteristicUUID: '0000ffe1-0000-1000-8000-00805f9b34fb', // TX characteristic
    rxCharacteristicUUID: '0000ffe2-0000-1000-8000-00805f9b34fb', // RX characteristic
  },
  
  // Voice Settings
  voice: {
    defaultLanguage: 'en-US',
    speechRate: 0.9,
    pitch: 1.0,
  },
  
  // Lesson Settings
  lessons: {
    totalLessons: 260,
    levelsCount: 4,
  },
  
  // Cache Settings
  cache: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    staleWhileRevalidate: true,
  },
};

// Legacy CONFIG export for backwards compatibility
export const CONFIG = {
  BLE: {
    SERVICE_UUID: APP_CONFIG.ble.serviceUUID,
    CHARACTERISTICS: {
      TX: APP_CONFIG.ble.characteristicUUID,
      RX: APP_CONFIG.ble.rxCharacteristicUUID,
      STATUS: '0000ffe3-0000-1000-8000-00805f9b34fb',
      PRINT: APP_CONFIG.ble.characteristicUUID,
      COMMAND: '0000ffe4-0000-1000-8000-00805f9b34fb',
    },
  },
  VOICE: {
    DEFAULT_LANGUAGE: APP_CONFIG.voice.defaultLanguage,
    DEFAULT_RATE: APP_CONFIG.voice.speechRate,
    DEFAULT_PITCH: APP_CONFIG.voice.pitch,
  },
};

export default APP_CONFIG;
