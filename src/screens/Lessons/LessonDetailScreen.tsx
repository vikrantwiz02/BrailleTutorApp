import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { RootState } from '../../store';
import { startLesson } from '../../store/slices/lessonsSlice';
import { voiceService, voiceCommandService } from '../../services';
import { RootStackParamList } from '../../navigation/RootNavigator';

type LessonDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'LessonDetail'
>;
type LessonDetailScreenRouteProp = RouteProp<RootStackParamList, 'LessonDetail'>;

interface Props {
  navigation: LessonDetailScreenNavigationProp;
  route: LessonDetailScreenRouteProp;
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

export const LessonDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { lessonId, mode: initialMode } = route.params;
  const dispatch = useDispatch();
  const { available, completed } = useSelector(
    (state: RootState) => state.lessons
  );
  const { connected } = useSelector((state: RootState) => state.device);
  const settings = useSelector((state: RootState) => state.settings);

  const lesson = available.find((l) => l.id === lessonId);
  const isCompleted = completed.some((l) => l.lessonId === lessonId);

  // Voice command support
  useFocusEffect(
    useCallback(() => {
      voiceCommandService.setContext('lessonDetail');
      voiceCommandService.setHandlers({
        onNavigate: (screen) => {
          if (screen === 'Home') navigation.navigate('Main', { screen: 'Home' });
          else if (screen === 'Lessons') navigation.goBack();
        },
        onLessonAction: (action) => {
          if (action === 'start' && lesson) handleStartLesson();
          else if (action === 'practice' && lesson) handleStartQuickPractice();
          else if (action === 'challenge' && lesson) handleStartChallenge();
        },
        onHelpRequested: () => {
          voiceCommandService.readAvailableCommands();
        },
      });
      
      // Announce screen if auto-announce enabled
      if (settings.autoAnnounce && lesson) {
        voiceService.speak(`${lesson.title}. ${lesson.description}. Say help for available commands.`);
      }
      
      return () => {
        voiceCommandService.setContext('home');
      };
    }, [lesson, settings.autoAnnounce])
  );

  if (!lesson) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[EDU_COLORS.slateGray, EDU_COLORS.deepSlate]}
          style={styles.backgroundGlow}
        >
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={COLORS.error.main} />
            <Text style={styles.errorText}>Lesson not found</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const handleStartLesson = () => {
    dispatch(startLesson(lesson));
    navigation.navigate('ActiveLesson', { lessonId: lesson.id, mode: 'lesson' });
  };

  const handleStartQuickPractice = () => {
    if (!lesson) return;
    dispatch(startLesson(lesson));
    navigation.navigate('ActiveLesson', { lessonId: lesson.id, mode: 'quickPractice' });
  };

  const handleStartChallenge = () => {
    if (!lesson) return;
    dispatch(startLesson(lesson));
    navigation.navigate('ActiveLesson', { lessonId: lesson.id, mode: 'challenge' });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['transparent', EDU_COLORS.deepSlate]}
        style={styles.backgroundGlow}
      >
        {/* Animated background elements */}
        <View style={styles.floatingOrbs}>
          <View style={[styles.orb, styles.orb1]} />
          <View style={[styles.orb, styles.orb2]} />
        </View>

        {/* Header - Matching HomeScreen Style */}
        <LinearGradient
          colors={[EDU_COLORS.slateGray, EDU_COLORS.deepSlate]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              {/* Back Button */}
              <TouchableOpacity
                style={styles.backButtonInline}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Level Badge */}
              <View style={styles.levelBadgeContainer}>
                <Text style={styles.levelText}>{lesson.level.toUpperCase()}</Text>
              </View>

              {/* Title */}
              <Text style={styles.title}>{lesson.title}</Text>

              {/* Description */}
              <Text style={styles.subtitle}>{lesson.description}</Text>
            </View>

            {/* Stats Circle */}
            <View style={styles.headerRight}>
              <View style={styles.statsCircle}>
                <Ionicons name="time-outline" size={24} color={EDU_COLORS.primaryBlue} />
                <Text style={styles.statsValue}>{lesson.duration_min}</Text>
                <Text style={styles.statsLabel}>min</Text>
              </View>
            </View>
          </View>

          {/* Chapter Info */}
          <View style={styles.chapterInfo}>
            <Ionicons name="layers-outline" size={16} color={EDU_COLORS.accent} />
            <Text style={styles.chapterText}>{lesson.chapter}</Text>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Lesson Stats Cards */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>LESSON OVERVIEW</Text>
            <View style={styles.hologramGrid}>
              <View style={styles.holoRow}>
                <View style={styles.statCard}>
                  <LinearGradient
                    colors={[EDU_COLORS.primaryBlue + '30', EDU_COLORS.primaryBlue + '10']}
                    style={styles.statGradient}
                  >
                    <Ionicons name="time" size={28} color={EDU_COLORS.primaryBlue} />
                    <Text style={styles.statValueLarge}>{lesson.duration_min}</Text>
                    <Text style={styles.statLabelSmall}>Minutes</Text>
                  </LinearGradient>
                </View>

                <View style={styles.statCard}>
                  <LinearGradient
                    colors={[EDU_COLORS.softPurple + '30', EDU_COLORS.softPurple + '10']}
                    style={styles.statGradient}
                  >
                    <Ionicons name="layers" size={28} color={EDU_COLORS.softPurple} />
                    <Text style={styles.statValueLarge}>{lesson.chapter.split('-')[0].trim()}</Text>
                    <Text style={styles.statLabelSmall}>Chapter</Text>
                  </LinearGradient>
                </View>
              </View>

              <View style={styles.holoRow}>
                <View style={styles.statCard}>
                  <LinearGradient
                    colors={[EDU_COLORS.vibrantGreen + '30', EDU_COLORS.vibrantGreen + '10']}
                    style={styles.statGradient}
                  >
                    <Ionicons name="checkmark-circle" size={28} color={EDU_COLORS.vibrantGreen} />
                    <Text style={styles.statValueLarge}>{isCompleted ? 'Yes' : 'No'}</Text>
                    <Text style={styles.statLabelSmall}>Completed</Text>
                  </LinearGradient>
                </View>

                <View style={styles.statCard}>
                  <LinearGradient
                    colors={[EDU_COLORS.warmOrange + '30', EDU_COLORS.warmOrange + '10']}
                    style={styles.statGradient}
                  >
                    <Ionicons name="school" size={28} color={EDU_COLORS.warmOrange} />
                    <Text style={styles.statValueLarge}>{lesson.level}</Text>
                    <Text style={styles.statLabelSmall}>Level</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>
          </View>

          {/* What You'll Learn Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={20} color={EDU_COLORS.warmOrange} />
              <Text style={styles.sectionTitle}>What You'll Learn</Text>
            </View>
            <View style={styles.learningCard}>
              <Text style={styles.learningText}>
                Master the fundamentals of {lesson.title.toLowerCase()} through interactive exercises and practice.
              </Text>
            </View>
          </View>

          {/* Device Connection Warning */}
          {!connected && (
            <TouchableOpacity
              style={[styles.deviceCard]}
              onPress={() => navigation.navigate('Device' as never)}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[EDU_COLORS.slateGray, EDU_COLORS.deepSlate]}
                style={styles.neuralGradient}
              >
                <View style={styles.neuralHeader}>
                  <View style={styles.signalContainer}>
                    <View style={[styles.signalWave, styles.wave1]} />
                    <View style={[styles.signalWave, styles.wave2]} />
                    <View style={styles.signalIcon}>
                      <Ionicons 
                        name="bluetooth-outline" 
                        size={24} 
                        color={EDU_COLORS.warmOrange}
                      />
                    </View>
                  </View>
                  <View style={styles.connectionStatus}>
                    <Text style={styles.deviceTitle}>Device Not Connected</Text>
                    <Text style={styles.deviceSubtitle}>
                      Connect your Braille device for the best learning experience
                    </Text>
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={EDU_COLORS.warmOrange} 
                  />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Prerequisites Section */}
          {lesson.prerequisites && lesson.prerequisites.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="lock-closed" size={20} color={EDU_COLORS.accent} />
                <Text style={styles.sectionTitle}>Prerequisites</Text>
              </View>
              <View style={styles.prereqCard}>
                <Text style={styles.prereqText}>
                  Complete these lessons first: {lesson.prerequisites.join(', ')}
                </Text>
              </View>
            </View>
          )}

          {/* Learning Objectives */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkbox" size={20} color={EDU_COLORS.vibrantGreen} />
              <Text style={styles.sectionTitle}>Learning Objectives</Text>
            </View>
            <View style={styles.objectivesContainer}>
              <View style={styles.objectiveItem}>
                <View style={styles.objectiveBullet}>
                  <Ionicons name="checkmark" size={16} color={EDU_COLORS.vibrantGreen} />
                </View>
                <Text style={styles.objectiveText}>
                  Understand core concepts and fundamentals
                </Text>
              </View>
              <View style={styles.objectiveItem}>
                <View style={styles.objectiveBullet}>
                  <Ionicons name="checkmark" size={16} color={EDU_COLORS.vibrantGreen} />
                </View>
                <Text style={styles.objectiveText}>
                  Practice tactile reading techniques
                </Text>
              </View>
              <View style={styles.objectiveItem}>
                <View style={styles.objectiveBullet}>
                  <Ionicons name="checkmark" size={16} color={EDU_COLORS.vibrantGreen} />
                </View>
                <Text style={styles.objectiveText}>
                  Master pattern recognition skills
                </Text>
              </View>
            </View>
          </View>

          {/* Practice Modes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="game-controller" size={20} color={EDU_COLORS.primaryBlue} />
              <Text style={styles.sectionTitle}>Practice Modes</Text>
            </View>
            <View style={styles.modesGrid}>
              <TouchableOpacity 
                style={styles.modeCard} 
                activeOpacity={0.8}
                onPress={handleStartQuickPractice}
              >
                <LinearGradient
                  colors={[EDU_COLORS.primaryBlue + '30', EDU_COLORS.primaryBlue + '10']}
                  style={styles.modeGradient}
                >
                  <Ionicons name="flash" size={24} color={EDU_COLORS.primaryBlue} />
                  <Text style={styles.modeTitle}>Quick Practice</Text>
                  <Text style={styles.modeSubtitle}>5 min session</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modeCard} 
                activeOpacity={0.8}
                onPress={handleStartChallenge}
              >
                <LinearGradient
                  colors={[EDU_COLORS.softPurple + '30', EDU_COLORS.softPurple + '10']}
                  style={styles.modeGradient}
                >
                  <Ionicons name="trophy" size={24} color={EDU_COLORS.softPurple} />
                  <Text style={styles.modeTitle}>Challenge</Text>
                  <Text style={styles.modeSubtitle}>Test skills</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress Tracker */}
          {isCompleted && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="analytics" size={20} color={EDU_COLORS.warmOrange} />
                <Text style={styles.sectionTitle}>Your Progress</Text>
              </View>
              <TouchableOpacity 
                style={styles.progressCard}
                onPress={() => navigation.navigate('Progress' as never)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[EDU_COLORS.vibrantGreen + '20', EDU_COLORS.vibrantGreen + '08']}
                  style={styles.progressGradient}
                >
                  <View style={styles.progressContent}>
                    <Ionicons name="checkmark-circle" size={40} color={EDU_COLORS.vibrantGreen} />
                    <View style={styles.progressInfo}>
                      <Text style={styles.progressTitle}>Lesson Completed!</Text>
                      <Text style={styles.progressSubtitle}>View detailed analytics</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={EDU_COLORS.vibrantGreen} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom padding for button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Action Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartLesson}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[EDU_COLORS.primaryBlue, EDU_COLORS.deepBlue]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons
                name="play"
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.buttonText}>Start Lesson</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
    bottom: 200,
    left: -50,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.h3,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  backButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: EDU_COLORS.primaryBlue,
    borderRadius: RADIUS.md,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold as any,
  },
  backButtonInline: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: SPACING.sm,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginLeft: SPACING.md,
  },
  statsCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 3,
    borderColor: EDU_COLORS.primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsValue: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: '#FFFFFF',
  },
  statsLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  levelBadgeContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.xs,
    backgroundColor: EDU_COLORS.primaryBlue + '40',
    borderWidth: 1,
    borderColor: EDU_COLORS.primaryBlue + '60',
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    letterSpacing: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  chapterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  chapterText: {
    fontSize: 12,
    color: EDU_COLORS.accent,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: SPACING.lg,
  },
  statsSection: {
    marginBottom: SPACING.xl,
  },
  hologramGrid: {
    gap: SPACING.md,
  },
  holoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  statGradient: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  statValueLarge: {
    fontSize: 28,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: '#FFFFFF',
    marginTop: SPACING.sm,
  },
  statLabelSmall: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviceCard: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
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
    borderColor: '#F59E0B',
    top: -8,
    left: -8,
  },
  wave2: {
    width: 56,
    height: 56,
    borderColor: '#F59E0B',
    top: -16,
    left: -16,
  },
  signalIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  connectionStatus: {
    flex: 1,
  },
  deviceTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: EDU_COLORS.warmOrange,
    marginBottom: 4,
  },
  deviceSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  prereqCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  prereqText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  objectivesContainer: {
    gap: SPACING.md,
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  objectiveBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  objectiveText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
  },
  modesGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modeCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  modeGradient: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: '#FFFFFF',
    marginTop: SPACING.sm,
  },
  modeSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: SPACING.xs,
  },
  progressCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  progressGradient: {
    padding: SPACING.lg,
  },
  progressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: EDU_COLORS.vibrantGreen,
    marginBottom: 4,
  },
  progressSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: '#FFFFFF',
  },
  learningCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  learningText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: 'rgba(10, 10, 15, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  startButton: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    minHeight: 52,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: TYPOGRAPHY.weights.bold as any,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});