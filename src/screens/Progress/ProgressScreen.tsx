import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { RootState, AppDispatch } from '../../store';
import { updateStats } from '../../store/slices/analyticsSlice';
import { allLessons, getLevelProgress } from '../../data';
import type { MainTabParamList } from '../../navigation/MainTabNavigator';

type ProgressScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Progress'>;

interface Props {
  navigation: ProgressScreenNavigationProp;
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

// Day names for weekly chart
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Levels matching the actual lesson data
const LESSON_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

export const ProgressScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { completed: completedLessons = [] } = useSelector((state: RootState) => state.lessons);
  const { stats } = useSelector((state: RootState) => state.analytics);

  // Calculate completion IDs for level progress
  const completedLessonIds = useMemo(() => {
    return completedLessons.map(l => l.lessonId || l.id).filter(Boolean);
  }, [completedLessons]);

  // Calculate level progress from actual lesson data
  const levelProgressData = useMemo(() => {
    return LESSON_LEVELS.map(level => {
      const levelLessons = allLessons.filter(l => l.level === level);
      const completed = levelLessons.filter(l => completedLessonIds.includes(l.id)).length;
      return {
        level,
        total: levelLessons.length,
        completed,
        percentage: levelLessons.length > 0 ? Math.round((completed / levelLessons.length) * 100) : 0,
      };
    });
  }, [completedLessonIds]);

  // Calculate weekly progress from completed lessons
  const weeklyProgress = useMemo(() => {
    const now = new Date();
    const weekData = DAYS.map((day, index) => {
      // Calculate date for each day of the current week
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + mondayOffset + index);
      targetDate.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(targetDate);
      nextDay.setDate(targetDate.getDate() + 1);

      // Count lessons completed on this day
      const lessonsOnDay = completedLessons.filter(l => {
        const completedDate = new Date(l.completedAt);
        return completedDate >= targetDate && completedDate < nextDay;
      });

      // Estimate minutes (average 10 min per lesson)
      const minutes = lessonsOnDay.length * 10;

      return { day, minutes, date: targetDate.toISOString().split('T')[0] };
    });

    return weekData;
  }, [completedLessons]);

  // Calculate day streak
  const dayStreak = useMemo(() => {
    if (completedLessons.length === 0) return 0;

    // Sort by date descending
    const sortedDates = [...new Set(
      completedLessons.map(l => new Date(l.completedAt).toDateString())
    )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // Check if user practiced today or yesterday
    if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
      return 0;
    }

    // Count consecutive days
    let checkDate = new Date(sortedDates[0]);
    for (const dateStr of sortedDates) {
      const lessonDate = new Date(dateStr);
      const diffDays = Math.round((checkDate.getTime() - lessonDate.getTime()) / 86400000);
      
      if (diffDays <= 1) {
        streak++;
        checkDate = lessonDate;
      } else {
        break;
      }
    }

    return streak;
  }, [completedLessons]);

  // Calculate total practice minutes
  const totalMinutes = useMemo(() => {
    // Sum up timeSpent from completed lessons (stored in seconds, convert to minutes)
    return completedLessons.reduce((sum, l) => {
      // timeSpent is in seconds, convert to minutes
      const minutes = l.timeSpent ? Math.round(l.timeSpent / 60) : 0;
      // If no timeSpent recorded, estimate based on lesson duration
      if (minutes === 0) {
        const lessonData = allLessons.find(al => al.id === (l.lessonId || l.id));
        return sum + (lessonData?.duration_min || 10);
      }
      return sum + minutes;
    }, 0);
  }, [completedLessons]);

  // Calculate average accuracy
  const averageAccuracy = useMemo(() => {
    if (completedLessons.length === 0) return 0;
    const totalScore = completedLessons.reduce((sum, l) => sum + (l.score || 0), 0);
    return Math.round(totalScore / completedLessons.length);
  }, [completedLessons]);

  // Update stats in Redux when calculated
  useFocusEffect(
    React.useCallback(() => {
      dispatch(updateStats({
        lessonsCompleted: completedLessons.length,
        currentStreak: dayStreak,
        totalPracticeMinutes: totalMinutes,
        averageScore: averageAccuracy,
        weeklyProgress,
      }));
    }, [dispatch, completedLessons.length, dayStreak, totalMinutes, averageAccuracy, weeklyProgress])
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['transparent', EDU_COLORS.deepSlate]}
        style={styles.backgroundGlow}
      >
        {/* Floating Orbs */}
        <View style={styles.floatingOrbs}>
          <View style={[styles.orb, styles.orb1]} />
          <View style={[styles.orb, styles.orb2]} />
        </View>

        {/* Header */}
        <LinearGradient
          colors={[EDU_COLORS.slateGray, EDU_COLORS.deepSlate]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Your Progress</Text>
              <Text style={styles.subtitle}>Track your learning journey</Text>
            </View>
            <View style={styles.trophyContainer}>
              <LinearGradient
                colors={[EDU_COLORS.warmOrange, EDU_COLORS.sunsetOrange]}
                style={styles.trophyGradient}
              >
                <Ionicons name="trophy" size={24} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Stats Overview */}
          <View style={styles.statsGrid}>
            <View style={styles.statCardWrapper}>
              <LinearGradient
                colors={[EDU_COLORS.primaryBlue + '30', EDU_COLORS.primaryBlue + '10']}
                style={styles.statCard}
              >
                <Ionicons name="book" size={32} color={EDU_COLORS.primaryBlue} />
                <Text style={styles.statValue}>{completedLessons.length}</Text>
                <Text style={styles.statLabel}>Lessons</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCardWrapper}>
              <LinearGradient
                colors={[EDU_COLORS.warmOrange + '30', EDU_COLORS.warmOrange + '10']}
                style={styles.statCard}
              >
                <Ionicons name="flame" size={32} color={EDU_COLORS.warmOrange} />
                <Text style={styles.statValue}>{dayStreak}</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
              </LinearGradient>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCardWrapper}>
              <LinearGradient
                colors={[EDU_COLORS.vibrantGreen + '30', EDU_COLORS.vibrantGreen + '10']}
                style={styles.statCard}
              >
                <Ionicons name="time" size={32} color={EDU_COLORS.vibrantGreen} />
                <Text style={styles.statValue}>{totalMinutes}</Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCardWrapper}>
              <LinearGradient
                colors={[EDU_COLORS.softPurple + '30', EDU_COLORS.softPurple + '10']}
                style={styles.statCard}
              >
                <Ionicons name="star" size={32} color={EDU_COLORS.softPurple} />
                <Text style={styles.statValue}>{averageAccuracy}%</Text>
                <Text style={styles.statLabel}>Accuracy</Text>
              </LinearGradient>
            </View>
          </View>

        {/* Weekly Progress Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Activity</Text>
          <View style={styles.chartCard}>
            {weeklyProgress.some(d => d.minutes > 0) ? (
              <View style={styles.chart}>
                {weeklyProgress.map((day, index) => {
                  const maxMinutes = Math.max(...weeklyProgress.map((d) => d.minutes), 1);
                  const height = day.minutes > 0 ? Math.max((day.minutes / maxMinutes) * 100, 5) : 5;
                  const isActive = day.minutes > 0;
                  
                  return (
                    <View key={index} style={styles.chartBar}>
                      <View style={styles.chartBarContainer}>
                        <LinearGradient
                          colors={isActive ? [EDU_COLORS.primaryBlue, EDU_COLORS.deepBlue] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                          style={[
                            styles.chartBarFill,
                            { height: `${height}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.chartLabel}>{day.day}</Text>
                      <Text style={[styles.chartValue, isActive && styles.chartValueActive]}>{day.minutes}m</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyChartContainer}>
                <Ionicons name="bar-chart-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyChartText}>Complete lessons to track your activity</Text>
                <View style={styles.chart}>
                  {DAYS.map((day, index) => (
                    <View key={index} style={styles.chartBar}>
                      <View style={styles.chartBarContainer}>
                        <View style={[styles.chartBarEmpty, { height: '5%' }]} />
                      </View>
                      <Text style={styles.chartLabel}>{day}</Text>
                      <Text style={styles.chartValue}>0m</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Level Breakdown - Using actual lesson levels */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress by Level</Text>
          
          {levelProgressData.map((levelData) => {
            const levelColors: Record<string, string> = {
              'Beginner': EDU_COLORS.vibrantGreen,
              'Intermediate': EDU_COLORS.primaryBlue,
              'Advanced': EDU_COLORS.softPurple,
              'Expert': EDU_COLORS.warmOrange,
            };
            const color = levelColors[levelData.level] || EDU_COLORS.primaryBlue;

            return (
              <View key={levelData.level} style={styles.levelCard}>
                <View style={styles.levelHeader}>
                  <View style={styles.levelNameContainer}>
                    <View style={[styles.levelDot, { backgroundColor: color }]} />
                    <Text style={styles.levelName}>{levelData.level}</Text>
                  </View>
                  <Text style={styles.levelProgress}>
                    {levelData.completed}/{levelData.total}
                  </Text>
                </View>
                <View style={styles.levelProgressBar}>
                  <LinearGradient
                    colors={[color, color + '80']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.levelProgressFill,
                      { width: `${Math.max(levelData.percentage, 0)}%` as any },
                    ]}
                  />
                </View>
                <Text style={styles.levelPercentage}>{levelData.percentage}% complete</Text>
              </View>
            );
          })}
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          {completedLessons.length === 0 ? (
            <View style={styles.emptyAchievements}>
              <Ionicons name="trophy-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>Complete lessons to earn achievements!</Text>
            </View>
          ) : (
            <View style={styles.achievementsGrid}>
              {completedLessons.length >= 1 && (
                <View style={styles.achievementCard}>
                  <Text style={styles.achievementIcon}>🎯</Text>
                  <Text style={styles.achievementName}>First Lesson</Text>
                </View>
              )}
              {completedLessons.length >= 5 && (
                <View style={styles.achievementCard}>
                  <Text style={styles.achievementIcon}>⭐</Text>
                  <Text style={styles.achievementName}>Rising Star</Text>
                </View>
              )}
              {completedLessons.length >= 10 && (
                <View style={styles.achievementCard}>
                  <Text style={styles.achievementIcon}>🔥</Text>
                  <Text style={styles.achievementName}>On Fire</Text>
                </View>
              )}
              {dayStreak >= 3 && (
                <View style={styles.achievementCard}>
                  <Text style={styles.achievementIcon}>📅</Text>
                  <Text style={styles.achievementName}>3 Day Streak</Text>
                </View>
              )}
              {dayStreak >= 7 && (
                <View style={styles.achievementCard}>
                  <Text style={styles.achievementIcon}>🏆</Text>
                  <Text style={styles.achievementName}>Week Warrior</Text>
                </View>
              )}
              {averageAccuracy >= 90 && completedLessons.length >= 5 && (
                <View style={styles.achievementCard}>
                  <Text style={styles.achievementIcon}>💯</Text>
                  <Text style={styles.achievementName}>Perfectionist</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {completedLessons.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="time-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No activity yet. Start a lesson!</Text>
            </View>
          ) : (
            completedLessons.slice(0, 5).map((lesson, index) => {
              const lessonData = allLessons.find(l => l.id === (lesson.lessonId || lesson.id));
              return (
                <View key={index} style={styles.activityCard}>
                  <View style={styles.activityIcon}>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {lessonData?.title || 'Completed Lesson'}
                    </Text>
                    <Text style={styles.activityDescription}>
                      Score: {lesson.score || 0}% • {lesson.attempts || 1} attempt{(lesson.attempts || 1) > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.activityDate}>
                    {new Date(lesson.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              );
            })
          )}
        </View>
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
    backgroundColor: EDU_COLORS.primaryBlue,
    top: -100,
    right: -50,
  },
  orb2: {
    width: 150,
    height: 150,
    backgroundColor: EDU_COLORS.softPurple,
    bottom: 100,
    left: -50,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  trophyContainer: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  trophyGradient: {
    padding: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 120,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statCardWrapper: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statCard: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
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
  section: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  chartCard: {
    backgroundColor: COLORS.surface.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarContainer: {
    flex: 1,
    width: '70%',
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
  },
  chartBarFill: {
    backgroundColor: COLORS.primary.main,
    borderRadius: RADIUS.sm,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  chartValue: {
    fontSize: TYPOGRAPHY.sizes.tiny,
    color: COLORS.text.secondary,
  },
  chartValueActive: {
    color: EDU_COLORS.primaryBlue,
    fontWeight: '600',
  },
  chartBarEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.sm,
    minHeight: 4,
  },
  emptyChartContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  emptyChartText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    marginVertical: SPACING.md,
    textAlign: 'center',
  },
  levelCard: {
    backgroundColor: COLORS.surface.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  levelNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  levelName: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  levelProgress: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  levelProgressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  levelPercentage: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: SPACING.xs,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  emptyAchievements: {
    backgroundColor: COLORS.surface.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  emptyActivity: {
    backgroundColor: COLORS.surface.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: TYPOGRAPHY.sizes.body,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  achievementCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  achievementIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  achievementName: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface.elevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.success.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  activityIconText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.sizes.h4,
    fontWeight: 'bold',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  activityDescription: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    color: COLORS.text.secondary,
  },
  activityDate: {
    fontSize: TYPOGRAPHY.sizes.caption,
    color: COLORS.text.secondary,
  },
});
