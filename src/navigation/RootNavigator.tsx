import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { initializeAuth } from '../store/slices/authSlice';
import { voiceService } from '../services';
import { VoiceAssistant } from '../components/VoiceAssistant';

// Auth Screens
import { SplashScreen } from '../screens/Auth/SplashScreen';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';

// Main App Screens
import MainTabNavigator from './MainTabNavigator';
import { LessonDetailScreen } from '../screens/Lessons/LessonDetailScreen';
import { ActiveLessonScreen } from '../screens/Lessons/ActiveLessonScreen';
import { NotificationsScreen } from '../screens/Notifications/NotificationsScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  Main: { screen: string };
  LessonDetail: { lessonId: string; mode?: 'lesson' | 'quickPractice' | 'challenge' };
  ActiveLesson: { lessonId: string; mode?: 'lesson' | 'quickPractice' | 'challenge' };
  Notifications: undefined;
  Device: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, initialized, loading } = useSelector((state: RootState) => state.auth);
  const settings = useSelector((state: RootState) => state.settings);
  const [isLoading, setIsLoading] = React.useState(true);

  // Initialize auth on app start
  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Sync voice settings with voiceService whenever settings change
  useEffect(() => {
    voiceService.setVoiceEnabled(settings.voiceEnabled);
    voiceService.setAutoAnnounce(settings.autoAnnounce);
  }, [settings.voiceEnabled, settings.autoAnnounce]);

  // Show splash screen while loading
  useEffect(() => {
    if (initialized) {
      // Add a small delay for smooth transition
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [initialized]);

  if (isLoading || !initialized) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <View style={styles.container}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {!isAuthenticated ? (
            // Auth Stack
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            // Main App Stack
            <>
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              <Stack.Screen name="LessonDetail" component={LessonDetailScreen} />
              <Stack.Screen 
                name="ActiveLesson" 
                component={ActiveLessonScreen}
                options={{ gestureEnabled: false }} // Prevent swipe back during lesson
              />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
            </>
          )}
        </Stack.Navigator>
        
        {/* Global Voice Assistant - must be inside NavigationContainer */}
        {isAuthenticated && <VoiceAssistant />}
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default RootNavigator;
