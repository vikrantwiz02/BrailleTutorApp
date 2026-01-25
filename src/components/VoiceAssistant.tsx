// VoiceAssistant - Global floating voice assistant component
// Provides continuous listening, visual feedback, and conversation display

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSelector } from 'react-redux';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { voiceService } from '../services/voiceService';
import { conversationalAIService, AICommandResult } from '../services/conversationalAIService';
import { RootState } from '../store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VoiceAssistantProps {
  isVisible?: boolean;
}

const EDU_COLORS = {
  primaryBlue: '#3B82F6',
  deepBlue: '#2563EB',
  softPurple: '#8B5CF6',
  richPurple: '#7C3AED',
  vibrantGreen: '#10B981',
  emeraldGreen: '#059669',
  warmOrange: '#F59E0B',
  sunsetOrange: '#F97316',
  deepSlate: '#0F172A',
  slateGray: '#1E293B',
  cardDark: '#1A1A2E',
  accent: '#06B6D4',
};

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ isVisible = true }) => {
  const navigation = useNavigation<any>();
  const currentRouteName = useNavigationState(state => {
    if (!state || !state.routes) return 'Home';
    const route = state.routes[state.index];
    if (route.state && route.state.routes) {
      const nestedRoute = route.state.routes[route.state.index as number];
      return nestedRoute?.name || route.name;
    }
    return route.name;
  });

  const settings = useSelector((state: RootState) => state.settings);
  const { current: currentLesson } = useSelector((state: RootState) => state.lessons);

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const transcriptOpacity = useRef(new Animated.Value(0)).current;

  // Initialize conversational AI and set up handlers
  useEffect(() => {
    const initializeAssistant = async () => {
      const result = await conversationalAIService.initialize();
      if (result.success) {
        // Set up navigation handler
        conversationalAIService.setNavigationHandler((screen, params) => {
          handleNavigation(screen, params);
        });

        // Set up lesson action handler
        conversationalAIService.setLessonActionHandler((action, params) => {
          handleLessonAction(action, params);
        });

        // Set state change callback
        conversationalAIService.setOnStateChange((state) => {
          if (state.isProcessing !== undefined) {
            setIsProcessing(state.isProcessing);
          }
        });

        // Greet user on first launch
        if (!hasGreeted && settings.autoAnnounce) {
          setTimeout(async () => {
            await conversationalAIService.greetUser();
            setHasGreeted(true);
          }, 1500);
        }
      }
    };

    initializeAssistant();
  }, []);

  // Update context when screen changes
  useEffect(() => {
    // Parse level number from string (e.g., "Beginner" -> 1)
    const levelMap: Record<string, number> = {
      'Beginner': 1,
      'Intermediate': 2,
      'Advanced': 3,
      'Expert': 4,
    };
    
    conversationalAIService.updateContext({
      currentScreen: currentRouteName,
      currentLesson: currentLesson ? {
        id: currentLesson.id,
        title: currentLesson.title,
        level: levelMap[currentLesson.level] || 1,
        stepNumber: 1,
        totalSteps: 5, // Default, will be updated by ActiveLessonScreen
      } : undefined,
    });
  }, [currentRouteName, currentLesson]);

  // Handle navigation commands
  const handleNavigation = (screen: string, params?: Record<string, any>) => {
    const screenMap: Record<string, string> = {
      'Home': 'Home',
      'home': 'Home',
      'Lessons': 'Lessons',
      'lessons': 'Lessons',
      'Progress': 'Progress',
      'progress': 'Progress',
      'Settings': 'Settings',
      'settings': 'Settings',
      'Device': 'Device',
      'device': 'Device',
    };

    const targetScreen = screenMap[screen];
    if (targetScreen) {
      try {
        // Navigate to main tabs first, then to specific screen
        navigation.navigate('MainTabs', { screen: targetScreen });
      } catch (error) {
        console.log('Navigation error:', error);
        // Try direct navigation
        navigation.navigate(targetScreen);
      }
    }
  };

  // Handle lesson action commands
  const handleLessonAction = (action: string, params?: Record<string, any>) => {
    // Emit event that screens can listen to
    // This will be picked up by ActiveLessonScreen
    if (global.lessonActionHandler) {
      global.lessonActionHandler(action, params);
    }
  };

  // Pulse animation for listening state
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // Handle voice result
  const handleVoiceResult = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setTranscript(text);
    setShowTranscript(true);
    Animated.timing(transcriptOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // First try quick commands (no AI needed)
    const quickResult = await conversationalAIService.handleQuickCommand(text);
    
    if (quickResult) {
      if (quickResult.type === 'navigate' && quickResult.action) {
        handleNavigation(quickResult.action);
      }
      if (quickResult.shouldSpeak && quickResult.response) {
        setLastResponse(quickResult.response);
      }
    } else {
      // Process with AI
      const result = await conversationalAIService.processUserInput(text);
      if (result.response) {
        setLastResponse(result.response);
      }
    }

    // Hide transcript after a delay
    setTimeout(() => {
      Animated.timing(transcriptOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowTranscript(false);
        setTranscript('');
      });
    }, 3000);
  }, []);

  // Set up voice event listeners
  useEffect(() => {
    const removeListener = voiceService.addEventListener((event, data) => {
      if (event === 'voiceResult' && data.isFinal) {
        handleVoiceResult(data.text);
        setIsListening(false);
      } else if (event === 'voicePartialResult') {
        setTranscript(data.text);
      } else if (event === 'voiceError') {
        setIsListening(false);
        console.log('Voice error:', data.error);
      } else if (event === 'voiceEnd') {
        setIsListening(false);
      }
    });

    return () => removeListener();
  }, [handleVoiceResult]);

  // Toggle listening
  const toggleListening = async () => {
    if (isListening) {
      await voiceService.stopListening();
      setIsListening(false);
    } else {
      setTranscript('');
      setLastResponse('');
      const result = await voiceService.startListening();
      if (result.success) {
        setIsListening(true);
        setShowTranscript(true);
        Animated.timing(transcriptOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
        
        // Announce that we're listening
        AccessibilityInfo.announceForAccessibility('Listening');
      } else {
        // Voice not available - provide feedback
        await voiceService.speak("Voice input isn't available right now. Please try again after creating a development build.");
      }
    }
  };

  // Toggle expanded view
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  if (!isVisible || !settings.voiceEnabled) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Transcript/Response Display */}
      {showTranscript && (
        <Animated.View 
          style={[
            styles.transcriptContainer,
            { opacity: transcriptOpacity }
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.transcriptBlur}>
            <View style={styles.transcriptContent}>
              {transcript ? (
                <>
                  <Ionicons name="mic" size={16} color={EDU_COLORS.primaryBlue} />
                  <Text style={styles.transcriptText}>{transcript}</Text>
                </>
              ) : lastResponse ? (
                <>
                  <Ionicons name="chatbubble" size={16} color={EDU_COLORS.vibrantGreen} />
                  <Text style={styles.responseText}>{lastResponse}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="mic" size={16} color={EDU_COLORS.warmOrange} />
                  <Text style={styles.listeningText}>Listening...</Text>
                </>
              )}
            </View>
          </BlurView>
        </Animated.View>
      )}

      {/* Main Voice Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={toggleListening}
          onLongPress={toggleExpanded}
          activeOpacity={0.8}
          accessibilityLabel={isListening ? 'Stop listening' : 'Start voice assistant'}
          accessibilityRole="button"
          accessibilityState={{ selected: isListening }}
        >
          <Animated.View 
            style={[
              styles.voiceButton,
              isListening && styles.voiceButtonActive,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <LinearGradient
              colors={
                isListening 
                  ? [EDU_COLORS.sunsetOrange, EDU_COLORS.warmOrange]
                  : isProcessing
                    ? [EDU_COLORS.softPurple, EDU_COLORS.richPurple]
                    : [EDU_COLORS.primaryBlue, EDU_COLORS.deepBlue]
              }
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons 
                name={isListening ? 'mic' : isProcessing ? 'ellipsis-horizontal' : 'mic-outline'} 
                size={28} 
                color="#FFFFFF" 
              />
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>

        {/* Listening indicator ripple */}
        {isListening && (
          <>
            <Animated.View 
              style={[
                styles.ripple,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.3],
                    outputRange: [0.6, 0],
                  }),
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.ripple,
                styles.rippleSecond,
                {
                  transform: [{ scale: Animated.multiply(pulseAnim, 1.2) }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.3],
                    outputRange: [0.4, 0],
                  }),
                }
              ]} 
            />
          </>
        )}
      </View>

      {/* Help hint on first use */}
      {!hasGreeted && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Tap to talk</Text>
        </View>
      )}
    </View>
  );
};

// Global lesson action handler reference
declare global {
  var lessonActionHandler: ((action: string, params?: Record<string, any>) => void) | undefined;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: EDU_COLORS.primaryBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  voiceButtonActive: {
    shadowColor: EDU_COLORS.sunsetOrange,
  },
  buttonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: EDU_COLORS.sunsetOrange,
  },
  rippleSecond: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  transcriptContainer: {
    position: 'absolute',
    bottom: 80,
    right: 0,
    maxWidth: SCREEN_WIDTH - 60,
    marginBottom: 10,
  },
  transcriptBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  transcriptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  transcriptText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  responseText: {
    color: EDU_COLORS.vibrantGreen,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  listeningText: {
    color: EDU_COLORS.warmOrange,
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default VoiceAssistant;
