// ─── Voice Assistant UI ───────────────────────────────────────────────────────
// Production-ready floating voice assistant.
//
// Features:
//   • Floating mic button (bottom-right)
//   • Animated waveform bars while listening
//   • Pulse ring while processing
//   • ONLINE / OFFLINE mode badge
//   • Fade-in transcript + spoken response card
//   • Long-press to expand conversation history panel
//   • Full accessibility (VoiceOver / TalkBack)

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Platform, AccessibilityInfo, ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSelector } from 'react-redux';
import { useNavigation, useNavigationState } from '@react-navigation/native';

import { voiceService } from '../services/voiceService';
import { voiceAssistantCore } from '../services/voice/voiceAssistantCore';
import { store } from '../store';
import type { RootState } from '../store';
import type { AssistantMode, ConversationEntry } from '../services/voice/types';

const { width: SW } = Dimensions.get('window');

// ── Colour tokens ─────────────────────────────────────────────────────────────

const C = {
  blue:     '#3B82F6',
  blueDark: '#1D4ED8',
  orange:   '#F97316',
  orangeHi: '#FB923C',
  purple:   '#8B5CF6',
  purpleDk: '#6D28D9',
  green:    '#10B981',
  greenDk:  '#059669',
  slate:    '#0F172A',
  slateMid: '#1E293B',
  white:    '#FFFFFF',
  dim:      'rgba(255,255,255,0.55)',
  cardBg:   'rgba(15,23,42,0.92)',
};

const WAVEFORM_BARS = 5;

// ── Gradient sets per mode ────────────────────────────────────────────────────

function modeGradient(mode: AssistantMode): [string, string] {
  switch (mode) {
    case 'listening':   return [C.orange,   C.orangeHi];
    case 'processing':  return [C.purple,   C.purpleDk];
    case 'speaking':    return [C.green,    C.greenDk];
    case 'confirming':  return [C.orange,   C.purpleDk];
    default:            return [C.blue,     C.blueDark];
  }
}

function modeIcon(mode: AssistantMode): keyof typeof Ionicons.glyphMap {
  switch (mode) {
    case 'listening':  return 'mic';
    case 'processing': return 'ellipsis-horizontal';
    case 'speaking':   return 'volume-high';
    case 'confirming': return 'help-circle';
    default:           return 'mic-outline';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const VoiceAssistant: React.FC = () => {
  const navigation = useNavigation<any>();
  const settings   = useSelector((s: RootState) => s.settings);
  const authState  = useSelector((s: RootState) => s.auth);
  const lessons    = useSelector((s: RootState) => s.lessons);
  const analytics  = useSelector((s: RootState) => s.analytics);

  // Current route name (handles nested tab navigator)
  const currentRoute = useNavigationState(state => {
    if (!state?.routes) return 'Home';
    const r = state.routes[state.index];
    if (r.state?.routes) return (r.state.routes as any)[(r.state.index as number)]?.name ?? r.name;
    return r.name;
  });

  // ── State ──────────────────────────────────────────────────────────────────

  const [mode, setMode]               = useState<AssistantMode>('idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [showCard, setShowCard]       = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]         = useState<ConversationEntry[]>([]);
  const [hasInit, setHasInit]         = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────

  const mountedRef     = useRef(true);
  const listeningRef   = useRef(false);
  const processingRef  = useRef(false);
  const manualStopRef  = useRef(false);
  const resultHandled  = useRef(false);
  const fatalUntil     = useRef(0);
  const scrollRef      = useRef<ScrollView>(null);

  // ── Animations ────────────────────────────────────────────────────────────

  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const histOpacity = useRef(new Animated.Value(0)).current;
  // Waveform bars
  const barAnims = useRef(
    Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(0.3))
  ).current;

  // Derived: online when Gemini API key is configured
  const online = Boolean(process.env.EXPO_PUBLIC_GEMINI_API_KEY);

  // ── Sync context to core ──────────────────────────────────────────────────

  useEffect(() => {
    const routeMap: Record<string, string> = {
      Home: 'home', Lessons: 'lessons', LessonDetail: 'lessonDetail',
      ActiveLesson: 'activeLesson', Progress: 'progress',
      Settings: 'settings', Device: 'device', Notifications: 'notifications',
    };

    voiceAssistantCore.updateContext({
      currentScreen: routeMap[currentRoute] ?? 'home',
      currentLesson: lessons.current ? {
        id: lessons.current.id,
        title: lessons.current.title,
        stepNumber: lessons.currentStep + 1,
        totalSteps: lessons.totalSteps,
      } : null,
      completedLessonsCount: lessons.completedIds?.length ?? 0,
      streak: (analytics as any)?.stats?.currentStreak ?? 0,
      deviceConnected: (store.getState() as any).device?.connected ?? false,
      isOnline: true,
    });
  }, [currentRoute, lessons, analytics]);

  // Sync handlers to core
  useEffect(() => {
    voiceAssistantCore.setHandlers({
      onNavigate: (screen, params) => {
        try {
          if (screen === 'Notifications') {
            navigation.navigate('Notifications');
          } else {
            navigation.navigate('MainTabs', { screen });
          }
        } catch {
          navigation.navigate(screen);
        }
      },
      onLessonAction: (action) => {
        if (global.lessonActionHandler) global.lessonActionHandler(action);
      },
    });
  }, [navigation]);

  // Mode changes from core
  useEffect(() => {
    voiceAssistantCore.setOnModeChange((m) => {
      if (!mountedRef.current) return;
      setMode(m);
      processingRef.current = (m === 'processing');
    });
  }, []);

  // Unmount cleanup
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── Waveform animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (isListening) {
      const loops = barAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 80),
            Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          ])
        )
      );
      loops.forEach(l => l.start());
      return () => loops.forEach(l => l.stop());
    } else {
      barAnims.forEach(a => a.setValue(0.3));
    }
  }, [isListening, barAnims]);

  // ── Pulse animation (processing) ─────────────────────────────────────────

  useEffect(() => {
    if (mode === 'processing') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [mode, pulseAnim]);

  // ── Card fade ────────────────────────────────────────────────────────────

  const showCardFn = useCallback(() => {
    setShowCard(true);
    Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [cardOpacity]);

  const hideCardFn = useCallback((delayMs = 3500) => {
    setTimeout(() => {
      if (!mountedRef.current) return;
      Animated.timing(cardOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
        .start(() => { if (mountedRef.current) setShowCard(false); });
    }, delayMs);
  }, [cardOpacity]);

  // ── Restart listening (continuous mode) ──────────────────────────────────

  const restartListening = useCallback(async (delayMs = 450) => {
    if (manualStopRef.current || !settings.voiceEnabled || !mountedRef.current) return;
    if (Date.now() < fatalUntil.current) return;
    if (listeningRef.current || processingRef.current) return;

    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

    // Wait for TTS to finish before starting mic
    const MAX_WAIT = 9000;
    const started = Date.now();
    while (Date.now() - started < MAX_WAIT) {
      if (!(await voiceService.isSpeaking())) break;
      await new Promise(r => setTimeout(r, 250));
    }

    if (manualStopRef.current || listeningRef.current || !mountedRef.current) return;

    const result = await voiceService.startListening();
    if (result.success && mountedRef.current) {
      setIsListening(true);
      listeningRef.current = true;
      setTranscript('');
      showCardFn();
    } else if (!result.success && mountedRef.current) {
      const msg = result.error || 'Voice recognition unavailable.';
      setLastResponse(msg);
      showCardFn();
      hideCardFn(5000);
    }
  }, [settings.voiceEnabled, showCardFn, hideCardFn]);

  // ── Voice event listener ──────────────────────────────────────────────────

  useEffect(() => {
    const unsub = voiceService.addEventListener(async (event, data) => {
      if (!mountedRef.current) return;

      if (event === 'voiceResult' && data.isFinal) {
        resultHandled.current = true;
        setIsListening(false);
        listeningRef.current = false;
        setTranscript(data.text);

        processingRef.current = true;
        setMode('processing');
        showCardFn();

        const response = await voiceAssistantCore.processInput(data.text);

        if (mountedRef.current) {
          setLastResponse(response);
          setHistory(voiceAssistantCore.getHistory());
          hideCardFn(response ? 4000 : 2000);
          await restartListening(600);
        }
      } else if (event === 'voicePartialResult') {
        setTranscript(data.text);
      } else if (event === 'voiceError') {
        setIsListening(false);
        listeningRef.current = false;
        resultHandled.current = false;

        const msg = String(data?.message || '').toLowerCase();
        const isFatal = msg.includes('initialize recognizer') ||
                        msg.includes('recognition service busy') ||
                        String(data?.code) === 'recognition_fail';

        if (isFatal) {
          fatalUntil.current = Date.now() + 7000;
          setLastResponse('Microphone initialisation failed. Tap the mic in a few seconds.');
          showCardFn(); hideCardFn(4000);
        } else {
          restartListening(700);
        }
      } else if (event === 'voiceEnd') {
        setIsListening(false);
        listeningRef.current = false;
        if (!resultHandled.current) restartListening(400);
        resultHandled.current = false;
      }
    });
    return () => unsub();
  }, [hideCardFn, restartListening, showCardFn]);

  // Stop listening when voice is disabled
  useEffect(() => {
    if (!settings.voiceEnabled) {
      manualStopRef.current = true;
      voiceService.stopListening();
      setIsListening(false);
      listeningRef.current = false;
    }
  }, [settings.voiceEnabled]);

  // ── Greeting on first mount ───────────────────────────────────────────────

  useEffect(() => {
    if (hasInit || !settings.voiceEnabled || !settings.autoAnnounce) return;
    setHasInit(true);

    setTimeout(async () => {
      if (!mountedRef.current) return;
      await voiceAssistantCore.processInput('hello');
      setHistory(voiceAssistantCore.getHistory());
      manualStopRef.current = false;
      restartListening(2000);
    }, 1800);
  }, [hasInit, restartListening, settings.autoAnnounce, settings.voiceEnabled]);

  // ── Toggle listening (manual tap) ─────────────────────────────────────────

  const handleTap = useCallback(async () => {
    if (isListening) {
      manualStopRef.current = true;
      await voiceService.stopListening();
      setIsListening(false);
      listeningRef.current = false;
      return;
    }

    if (Platform.OS === 'android') {
      const { PermissionsAndroid } = require('react-native');
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        { title: 'Microphone', message: 'Needed for voice commands', buttonPositive: 'OK' }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        await voiceService.speak('Microphone permission denied. Please enable it in settings.');
        return;
      }
    }

    manualStopRef.current = false;
    setTranscript('');
    const result = await voiceService.startListening();
    if (result.success) {
      setIsListening(true);
      listeningRef.current = true;
      showCardFn();
      AccessibilityInfo.announceForAccessibility('Listening');
    } else {
      const errMsg = result.error || 'Voice recognition is not available on this device. Make sure you are using a development build.';
      setLastResponse(errMsg);
      showCardFn();
      hideCardFn(6000);
      await voiceService.speak(errMsg);
    }
  }, [isListening, showCardFn, hideCardFn]);

  // ── History panel toggle (long press) ─────────────────────────────────────

  const handleLongPress = useCallback(() => {
    const next = !showHistory;
    setShowHistory(next);
    Animated.timing(histOpacity, {
      toValue: next ? 1 : 0, duration: 250, useNativeDriver: true,
    }).start();
    if (next) {
      setHistory(voiceAssistantCore.getHistory());
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [showHistory, histOpacity]);

  // ── Dismiss history on outside tap ────────────────────────────────────────

  const dismissHistory = useCallback(() => {
    setShowHistory(false);
    Animated.timing(histOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [histOpacity]);

  // ── Render guards ─────────────────────────────────────────────────────────

  if (!settings.voiceEnabled) return null;

  const [gradStart, gradEnd] = modeGradient(mode);

  // ── Card content ──────────────────────────────────────────────────────────

  const cardContent = useMemo(() => {
    if (mode === 'confirming') {
      return { icon: 'help-circle' as const, color: C.orange, text: lastResponse };
    }
    if (transcript && mode !== 'speaking') {
      return { icon: 'mic' as const, color: C.orange, text: transcript };
    }
    if (lastResponse) {
      return { icon: 'chatbubble-ellipses' as const, color: C.green, text: lastResponse };
    }
    if (mode === 'listening') {
      return { icon: 'mic' as const, color: C.orangeHi, text: 'Listening…' };
    }
    if (mode === 'processing') {
      return { icon: 'ellipsis-horizontal' as const, color: C.purple, text: 'Processing…' };
    }
    return null;
  }, [mode, transcript, lastResponse]);

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Tap-outside to dismiss history */}
      {showHistory && (
        <TouchableWithoutFeedback onPress={dismissHistory}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}

      <View style={styles.root} pointerEvents="box-none">

        {/* ── History panel ──────────────────────────────────────────────── */}
        {showHistory && (
          <Animated.View style={[styles.historyPanel, { opacity: histOpacity }]}>
            <BlurView intensity={90} tint="dark" style={styles.historyBlur}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Conversation</Text>
                <View style={styles.modeBadge}>
                  <View style={[styles.modeDot, { backgroundColor: online ? C.green : '#888' }]} />
                  <Text style={styles.modeLabel}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
                </View>
              </View>
              <ScrollView
                ref={scrollRef}
                style={styles.historyScroll}
                showsVerticalScrollIndicator={false}
              >
                {history.length === 0 ? (
                  <Text style={styles.historyEmpty}>No conversation yet. Tap the mic and speak!</Text>
                ) : (
                  history.map((entry, i) => (
                    <View
                      key={i}
                      style={[
                        styles.historyBubble,
                        entry.role === 'user' ? styles.userBubble : styles.aiBubble,
                      ]}
                    >
                      <Text style={[
                        styles.bubbleText,
                        entry.role === 'user' ? styles.userText : styles.aiText,
                      ]}>
                        {entry.text}
                      </Text>
                    </View>
                  ))
                )}
                <View style={{ height: 12 }} />
              </ScrollView>
            </BlurView>
          </Animated.View>
        )}

        {/* ── Transcript / response card ──────────────────────────────────── */}
        {showCard && cardContent && (
          <Animated.View style={[styles.card, { opacity: cardOpacity }]}>
            <BlurView intensity={85} tint="dark" style={styles.cardBlur}>
              <View style={styles.cardRow}>
                <Ionicons name={cardContent.icon} size={16} color={cardContent.color} />
                <Text style={[styles.cardText, { color: cardContent.color }]} numberOfLines={3}>
                  {cardContent.text}
                </Text>
              </View>
            </BlurView>
          </Animated.View>
        )}

        {/* ── Mic button ──────────────────────────────────────────────────── */}
        <View style={styles.buttonWrap}>

          {/* Ripple rings while listening */}
          {isListening && (
            <>
              <Animated.View style={[styles.ring, styles.ring1, {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0.5, 0] }),
              }]} />
              <Animated.View style={[styles.ring, styles.ring2, {
                transform: [{ scale: Animated.multiply(pulseAnim, 1.3) }],
                opacity: pulseAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0.3, 0] }),
              }]} />
            </>
          )}

          <TouchableOpacity
            onPress={handleTap}
            onLongPress={handleLongPress}
            delayLongPress={600}
            activeOpacity={0.82}
            accessible
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Stop listening' : 'Voice assistant'}
            accessibilityHint="Tap to speak, long press to see history"
            accessibilityState={{ selected: isListening }}
          >
            <Animated.View style={[styles.button, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={[gradStart, gradEnd]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.buttonGrad}
              >
                {isListening ? (
                  /* Waveform bars */
                  <View style={styles.waveform}>
                    {barAnims.map((anim, i) => (
                      <Animated.View
                        key={i}
                        style={[styles.bar, {
                          transform: [{ scaleY: anim.interpolate({
                            inputRange: [0.2, 1],
                            outputRange: [0.3, 1],
                          }) }],
                        }]}
                      />
                    ))}
                  </View>
                ) : (
                  <Ionicons name={modeIcon(mode)} size={26} color={C.white} />
                )}
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </View>

      </View>
    </>
  );
};

// Global lesson action handler
declare global {
  var lessonActionHandler: ((action: string, params?: Record<string, any>) => void) | undefined;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BTN = 62;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: 18,
    zIndex: 9999,
    alignItems: 'flex-end',
  },

  // ── Button ────────────────────────────────────────────────────────────────
  buttonWrap: { alignItems: 'center', justifyContent: 'center' },
  button: {
    width: BTN, height: BTN, borderRadius: BTN / 2,
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 10,
  },
  buttonGrad: {
    width: BTN, height: BTN, borderRadius: BTN / 2,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Ripple rings ─────────────────────────────────────────────────────────
  ring: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: C.orange,
  },
  ring1: { width: BTN, height: BTN },
  ring2: { width: BTN + 20, height: BTN + 20 },

  // ── Waveform ──────────────────────────────────────────────────────────────
  waveform: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, height: 28,
  },
  bar: {
    width: 4, height: 24, borderRadius: 2,
    backgroundColor: C.white,
  },

  // ── Transcript / response card ────────────────────────────────────────────
  card: {
    position: 'absolute',
    bottom: BTN + 14,
    right: 0,
    maxWidth: SW - 52,
    marginBottom: 4,
  },
  cardBlur: { borderRadius: 16, overflow: 'hidden' },
  cardRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 11, gap: 8,
  },
  cardText: {
    fontSize: 13.5, fontWeight: '500', flex: 1, lineHeight: 19,
  },

  // ── History panel ─────────────────────────────────────────────────────────
  historyPanel: {
    position: 'absolute',
    bottom: BTN + 18,
    right: 0,
    width: Math.min(SW - 36, 340),
    maxHeight: 420,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 20,
  },
  historyBlur: { flex: 1, borderRadius: 20 },
  historyHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  historyTitle: {
    color: C.white, fontSize: 15, fontWeight: '700',
  },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modeDot:   { width: 7, height: 7, borderRadius: 3.5 },
  modeLabel: { color: C.dim, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

  historyScroll: { maxHeight: 340 },
  historyEmpty: {
    color: C.dim, fontSize: 13, textAlign: 'center',
    marginTop: 24, marginBottom: 12, paddingHorizontal: 16,
  },

  historyBubble: {
    marginHorizontal: 12, marginVertical: 4,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
    maxWidth: '88%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(59,130,246,0.35)',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bubbleText: { fontSize: 13, lineHeight: 18 },
  userText:   { color: C.white },
  aiText:     { color: C.dim },
});

export default VoiceAssistant;
