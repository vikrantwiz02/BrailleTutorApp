import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { RootState, AppDispatch } from '../../store';
import { MainTabParamList } from '../../navigation/MainTabNavigator';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { fetchLessonProgress, fetchUserStats } from '../../store/slices/lessonsSlice';
import { offlineSyncService, notificationService, voiceCommandService, voiceService } from '../../services';

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { completed: completedLessons = [], completedIds = [], current: currentLesson, currentStep, totalSteps, stats: lessonStats } = useSelector((state: RootState) => state.lessons);
  const { stats } = useSelector((state: RootState) => state.analytics);
  const { connected: isConnected, deviceInfo: connectedDevice } = useSelector((state: RootState) => state.device);
  
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Fetch user progress on mount
  useEffect(() => {
    if (user?.id) {
      dispatch(fetchLessonProgress(user.id));
      dispatch(fetchUserStats(user.id));
    }
    
    // Initialize services
    offlineSyncService.initialize();
    notificationService.initialize(user?.id);
    voiceCommandService.initialize();
    
    // Set up voice command handlers
    voiceCommandService.setHandlers({
      onNavigate: (screen) => {
        if (screen === 'Lessons') navigation.navigate('MainTabs', { screen: 'Lessons' } as any);
        else if (screen === 'Progress') navigation.navigate('MainTabs', { screen: 'Progress' } as any);
        else if (screen === 'Settings') navigation.navigate('MainTabs', { screen: 'Settings' } as any);
        else if (screen === 'Device') navigation.navigate('Device');
      },
      onNotificationAction: (action) => {
        if (action === 'read' || action === 'open') {
          navigation.navigate('Notifications');
        } else if (action === 'clear') {
          notificationService.markAllAsRead();
        }
      },
      onHelpRequested: () => {
        voiceCommandService.readAvailableCommands();
      },
    });
    voiceCommandService.setContext('home');
    
    // Subscribe to notifications
    const unsubscribe = notificationService.subscribe((notifications) => {
      setUnreadNotifications(notifications.filter(n => !n.read).length);
    });
    
    return () => {
      offlineSyncService.cleanup();
      unsubscribe();
    };
  }, [user?.id, dispatch, navigation]);

  // Announce screen on focus for accessibility
  useFocusEffect(
    useCallback(() => {
      voiceCommandService.setContext('home');
      // Welcome message for blind users
      const welcomeMessage = `Welcome back ${user?.name || 'learner'}. You have completed ${completedIds.length} lessons. ${unreadNotifications > 0 ? `You have ${unreadNotifications} new notifications.` : ''} Say help for voice commands.`;
      voiceService.speak(welcomeMessage);
    }, [user?.name, completedIds.length, unreadNotifications])
  );

  const handleNotificationPress = () => {
    navigation.navigate('Notifications');
  };

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

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={['transparent', EDU_COLORS.deepSlate]}
        style={styles.backgroundGlow}
      >
        {/* Animated background elements */}
        <View style={styles.floatingOrbs}>
          <View style={[styles.orb, styles.orb1]} />
          <View style={[styles.orb, styles.orb2]} />
          <View style={[styles.orb, styles.orb3]} />
        </View>
        
        <LinearGradient
          colors={[EDU_COLORS.slateGray, EDU_COLORS.deepSlate]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.userSection}>
              <View style={styles.avatarGlow}>
                <LinearGradient
                  colors={[EDU_COLORS.primaryBlue, EDU_COLORS.vibrantGreen]}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>
                    {user?.name?.charAt(0) || 'L'}
                  </Text>
                </LinearGradient>
              </View>
              <View>
                <Text style={styles.greeting}>WELCOME BACK</Text>
                <Text style={styles.userName}>{user?.name || 'Learner'}</Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.premiumButton}
              onPress={handleNotificationPress}
              accessibilityLabel={`Notifications. ${unreadNotifications} unread.`}
              accessibilityRole="button"
            >
              <Ionicons name="notifications-outline" size={20} color={EDU_COLORS.primaryBlue} />
              {unreadNotifications > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Device Connection Status */}
          <TouchableOpacity
            style={[styles.deviceCard, isConnected && styles.deviceCardActive]}
            onPress={() => navigation.navigate('Device')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={isConnected ? 
                [EDU_COLORS.vibrantGreen + '20', EDU_COLORS.vibrantGreen + '08'] : 
                [EDU_COLORS.slateGray, EDU_COLORS.deepSlate]
              }
              style={styles.neuralGradient}
            >
              <View style={styles.neuralHeader}>
                <View style={styles.signalContainer}>
                  <View style={[styles.signalWave, styles.wave1]} />
                  <View style={[styles.signalWave, styles.wave2]} />
                  <View style={[styles.signalIcon, isConnected && styles.signalIconActive]}>
                    <Ionicons 
                      name={isConnected ? 'bluetooth' : 'bluetooth-outline'} 
                      size={24} 
                      color={isConnected ? EDU_COLORS.vibrantGreen : EDU_COLORS.primaryBlue}
                    />
                  </View>
                </View>
                <View style={styles.connectionStatus}>
                  <Text style={styles.deviceTitle}>
                    {isConnected ? 'DEVICE CONNECTED' : 'CONNECT YOUR DEVICE'}
                  </Text>
                  <Text style={styles.deviceSubtitle}>
                    {isConnected ? connectedDevice?.name || 'Braille Learning Device' : 'Tap to pair your Braille device'}
                  </Text>
                </View>
                <Ionicons 
                  name="chevron-forward" 
                  size={20} 
                  color={isConnected ? EDU_COLORS.vibrantGreen : EDU_COLORS.primaryBlue} 
                />
              </View>
              {isConnected && (
                <View style={styles.dataStream}>
                  <View style={styles.streamLine} />
                  <View style={styles.streamLine} />
                  <View style={styles.streamLine} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Continue Learning */}
          {currentLesson && (
            <TouchableOpacity
              style={styles.learningCard}
              onPress={() => navigation.navigate('ActiveLesson', { lessonId: currentLesson.id })}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[EDU_COLORS.softPurple, EDU_COLORS.richPurple]}
                style={styles.portalGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.learningHeader}>
                  <Text style={styles.learningLabel}>CONTINUE LEARNING</Text>
                  <View style={styles.learningGlow} />
                </View>
                <Text style={styles.learningTitle} numberOfLines={2}>{currentLesson.title}</Text>
                
                <View style={styles.lessonProgress}>
                  <View style={styles.progressGrid}>
                    {Array.from({ length: totalSteps || 10 }).map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.gridCell,
                          index < (currentStep || 0) && styles.gridCellActive,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.progressText}>
                    Step {currentStep || 0} of {totalSteps || 0}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Learning Stats */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>YOUR PROGRESS</Text>
            <View style={styles.hologramGrid}>
              <View style={styles.holoRow}>
                <View style={styles.statCard}>
                  <LinearGradient
                    colors={[EDU_COLORS.primaryBlue + '30', EDU_COLORS.primaryBlue + '10']}
                    style={styles.statGradient}
                  >
                    <Ionicons name="book" size={28} color={EDU_COLORS.primaryBlue} />
                    <Text style={styles.statValue}>{completedLessons.length}</Text>
                    <Text style={styles.statLabel}>Lessons</Text>
                  </LinearGradient>
                </View>

                <View style={styles.statCard}>
                  <LinearGradient
                    colors={[EDU_COLORS.vibrantGreen + '30', EDU_COLORS.vibrantGreen + '10']}
                    style={styles.statGradient}
                  >
                    <Ionicons name="flame" size={28} color={EDU_COLORS.vibrantGreen} />
                    <Text style={styles.statValue}>{stats.currentStreak}</Text>
                    <Text style={styles.statLabel}>Day Streak</Text>
                  </LinearGradient>
                </View>
              </View>

              <View style={styles.holoRow}>
                <View style={styles.statCard}>
                  <LinearGradient
                    colors={[EDU_COLORS.warmOrange + '30', EDU_COLORS.warmOrange + '10']}
                    style={styles.statGradient}
                  >
                    <Ionicons name="time" size={28} color={EDU_COLORS.warmOrange} />
                    <Text style={styles.statValue}>{stats.totalPracticeMinutes}</Text>
                    <Text style={styles.statLabel}>Minutes</Text>
                  </LinearGradient>
                </View>

                <View style={styles.statCard}>
                  <LinearGradient
                    colors={[EDU_COLORS.softPurple + '30', EDU_COLORS.softPurple + '10']}
                    style={styles.statGradient}
                  >
                    <Ionicons name="star" size={28} color={EDU_COLORS.softPurple} />
                    <Text style={styles.statValue}>{stats.averageScore}%</Text>
                    <Text style={styles.statLabel}>Accuracy</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
            
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('Lessons')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[EDU_COLORS.primaryBlue + '40', EDU_COLORS.primaryBlue + '10']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="library" size={32} color={EDU_COLORS.primaryBlue} />
                  <Text style={styles.actionTitle}>All Lessons</Text>
                  <Text style={styles.actionSubtitle}>Browse library</Text>
                  <View style={[styles.actionAccent, { backgroundColor: EDU_COLORS.primaryBlue }]} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('Progress')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[EDU_COLORS.vibrantGreen + '40', EDU_COLORS.vibrantGreen + '10']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="trending-up" size={32} color={EDU_COLORS.vibrantGreen} />
                  <Text style={styles.actionTitle}>Progress</Text>
                  <Text style={styles.actionSubtitle}>View analytics</Text>
                  <View style={[styles.actionAccent, { backgroundColor: EDU_COLORS.vibrantGreen }]} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('Device')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[EDU_COLORS.accent + '40', EDU_COLORS.accent + '10']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="bluetooth" size={32} color={EDU_COLORS.accent} />
                  <Text style={styles.actionTitle}>Device</Text>
                  <Text style={styles.actionSubtitle}>Manage device</Text>
                  <View style={[styles.actionAccent, { backgroundColor: EDU_COLORS.accent }]} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('Settings')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[EDU_COLORS.softPurple + '40', EDU_COLORS.softPurple + '10']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="settings" size={32} color={EDU_COLORS.softPurple} />
                  <Text style={styles.actionTitle}>Settings</Text>
                  <Text style={styles.actionSubtitle}>Preferences</Text>
                  <View style={[styles.actionAccent, { backgroundColor: EDU_COLORS.softPurple }]} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 120 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  backgroundGlow: {
    flex: 1,
  },
  floatingOrbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.1,
  },
  orb1: {
    width: 200,
    height: 200,
    backgroundColor: '#3B82F6',
    top: -100,
    right: -50,
  },
  orb2: {
    width: 150,
    height: 150,
    backgroundColor: '#8B5CF6',
    bottom: 100,
    left: -50,
  },
  orb3: {
    width: 100,
    height: 100,
    backgroundColor: '#10B981',
    top: '40%',
    right: '20%',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarGlow: {
    padding: 2,
    borderRadius: RADIUS.full,
    backgroundColor: '#3B82F6',
    marginRight: SPACING.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: TYPOGRAPHY.sizes.h4,
    fontWeight: 'bold',
    color: '#0A0A0F',
  },
  greeting: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: '#3B82F6',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 2,
  },
  userName: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  premiumButton: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    position: 'relative',
  },
  notificationPulse: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },

  // Device Connection Card
  deviceCard: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  deviceCardActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  neuralGradient: {
    padding: SPACING.lg,
  },
  neuralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signalContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  signalWave: {
    position: 'absolute',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    opacity: 0.3,
  },
  wave1: {
    width: 40,
    height: 40,
    borderColor: '#3B82F6',
    top: -8,
    left: -8,
  },
  wave2: {
    width: 56,
    height: 56,
    borderColor: '#3B82F6',
    top: -16,
    left: -16,
  },
  signalIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  signalIconActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  connectionStatus: {
    flex: 1,
  },
  deviceTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  deviceSubtitle: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  dataStream: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: 4,
  },
  streamLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.6)',
    borderRadius: RADIUS.full,
  },

  // Learning Card
  learningCard: {
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  portalGradient: {
    padding: SPACING.lg,
  },
  learningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  learningLabel: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 1,
  },
  learningGlow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginLeft: SPACING.sm,
  },
  learningTitle: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: SPACING.md,
    lineHeight: 32,
  },
  lessonProgress: {
    marginTop: SPACING.sm,
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  gridCell: {
    width: 28,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  gridCellActive: {
    backgroundColor: '#FFFFFF',
  },
  progressText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // Stats Section
  statsSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.h4,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: SPACING.lg,
    letterSpacing: 1,
  },
  hologramGrid: {
    gap: SPACING.md,
  },
  holoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statGradient: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: SPACING.xs,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    letterSpacing: 1,
  },

  // Actions Section
  actionsSection: {
    marginBottom: SPACING.xl,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  actionGradient: {
    padding: SPACING.lg,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: SPACING.sm,
    marginBottom: 2,
    letterSpacing: 1,
  },
  actionSubtitle: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  actionAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.8,
  },
});