import React, { useEffect, useState } from 'react';
import { StatusBar, LogBox, View, Text, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store, persistor } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { COLORS } from './src/theme';
import ErrorBoundary from './src/components/ErrorBoundary';
import { offlineSyncService, bleDeviceService, voiceCommandService, voiceService } from './src/services';
import translationService from './src/services/translationService';

// Ignore specific warnings in development only
if (__DEV__) {
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
    'Require cycle',
  ]);
}

// Loading component for PersistGate
const LoadingView = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background.primary }}>
    <ActivityIndicator size="large" color={COLORS.primary.main} />
    <Text style={{ color: COLORS.text.secondary, marginTop: 16 }}>Loading...</Text>
  </View>
);

export default function App() {
  const [servicesReady, setServicesReady] = useState(false);

  useEffect(() => {
    // Set up language getter for voice service to access Redux language
    voiceService.setLanguageGetter(() => {
      const state = store.getState();
      return state.settings?.language || 'English';
    });

    // Request all permissions on Android
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ];
          
          // Add POST_NOTIFICATIONS for Android 13+
          if (Platform.Version >= 33) {
            permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
          }
          
          const granted = await PermissionsAndroid.requestMultiple(permissions);
          console.log('Permissions granted:', granted);
        } catch (err) {
          console.warn('Permission request error:', err);
        }
      }
    };

    // Initialize app-level services
    const initializeServices = async () => {
      try {
        // Request permissions first
        await requestPermissions();
        
        // Initialize translation service with current language
        const currentLanguage = store.getState().settings?.language || 'English';
        translationService.setLanguage(currentLanguage);
        console.log('Translation service initialized with language:', currentLanguage);
        
        // Initialize offline sync for network monitoring
        await offlineSyncService.initialize();
        
        // Initialize BLE (will fail gracefully on simulator)
        try {
          await bleDeviceService.initialize();
          console.log('BLE service initialized');
        } catch (bleError) {
          // BLE not available (simulator or unsupported device)
          console.log('BLE not available:', bleError);
        }
        
        // Initialize voice command service
        try {
          await voiceCommandService.initialize();
          console.log('Voice command service initialized');
        } catch (voiceError) {
          console.log('Voice command service init warning:', voiceError);
        }
        
        console.log('Braille Tutor App Initialized');
      } catch (error) {
        console.error('Service initialization error:', error);
      } finally {
        setServicesReady(true);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      offlineSyncService.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <PersistGate loading={<LoadingView />} persistor={persistor}>
            <SafeAreaProvider>
              <StatusBar
                barStyle="light-content"
                backgroundColor="transparent"
                translucent={true}
              />
              <RootNavigator />
            </SafeAreaProvider>
          </PersistGate>
        </Provider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
