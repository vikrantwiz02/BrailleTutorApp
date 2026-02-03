import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme, { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme';
import { RootState } from '../../store';
import { fetchLessonsStart, ensureLessonsLoaded } from '../../store/slices/lessonsSlice';
import { MainTabParamList } from '../../navigation/MainTabNavigator';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getAvailableLessons, getLessonStats } from '../../data';
import { voiceCommandService, voiceService, translationService } from '../../services';

type LessonsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Lessons'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: LessonsScreenNavigationProp;
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

export const LessonsScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { available, completed, loading } = useSelector(
    (state: RootState) => state.lessons
  );
  const currentLanguage = useSelector((state: RootState) => state.settings?.language || 'English');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'chapters'>('all');
  const [translatedLessons, setTranslatedLessons] = useState<any[]>([]);

  // Translate lessons when language or available lessons change
  useEffect(() => {
    const translateLessonsAsync = async () => {
      if (available.length > 0 && currentLanguage !== 'English') {
        try {
          const translated = await translationService.translateLessons(
            available.map((l: any) => ({
              title: l.title,
              description: l.description,
            }))
          );
          
          const updatedLessons = available.map((lesson: any, index: number) => ({
            ...lesson,
            title: translated[index].title,
            description: translated[index].description,
          }));
          
          setTranslatedLessons(updatedLessons);
          console.log(`Translated ${updatedLessons.length} lessons to ${currentLanguage}`);
        } catch (error) {
          console.error('Error translating lessons:', error);
          setTranslatedLessons(available);
        }
      } else {
        setTranslatedLessons(available);
      }
    };

    translateLessonsAsync();
  }, [available, currentLanguage]);

  const displayLessons = translatedLessons.length > 0 ? translatedLessons : available;

  useEffect(() => {
    dispatch(fetchLessonsStart());
    dispatch(ensureLessonsLoaded());
  }, [dispatch]);

  // Voice command support for lessons screen
  useFocusEffect(
    useCallback(() => {
      voiceCommandService.setContext('lessons');
      const totalLessons = displayLessons.length;
      const completedCount = completed.length;
      voiceService.speak(`Lessons screen. ${totalLessons} lessons available. ${completedCount} completed. Say start lesson to begin.`);
      
      voiceCommandService.setHandlers({
        onNavigate: (screen) => {
          if (screen === 'Home') navigation.navigate('MainTabs', { screen: 'Home' } as any);
          else if (screen === 'Progress') navigation.navigate('MainTabs', { screen: 'Progress' } as any);
          else if (screen === 'Settings') navigation.navigate('MainTabs', { screen: 'Settings' } as any);
        },
        onLessonAction: (action) => {
          if (action === 'start' && displayLessons.length > 0) {
            // Start first incomplete lesson
            const firstIncomplete = displayLessons.find((l: any) => !completedIds.includes(l.id));
            if (firstIncomplete) {
              handleLessonPress(firstIncomplete.id);
            }
          }
        },
      });
    }, [displayLessons.length, completed.length, completedIds])
  );

  const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
  
  const stats = useMemo(() => getLessonStats(), []);
  
  const completedIds = useMemo(
    () => completed.map((c: any) => c.lessonId),
    [completed]
  );

  const availableLessonsData = useMemo(
    () => getAvailableLessons(completedIds),
    [completedIds]
  );

  const filteredLessons = useMemo(() => {
    return displayLessons.filter((lesson: any) => {
      const matchesSearch = lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lesson.chapter.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = !selectedLevel || lesson.level === selectedLevel;
      return matchesSearch && matchesLevel;
    });
  }, [displayLessons, searchQuery, selectedLevel]);

  const lessonsByChapter = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};
    filteredLessons.forEach((lesson: any) => {
      if (!grouped[lesson.chapter]) {
        grouped[lesson.chapter] = [];
      }
      grouped[lesson.chapter].push(lesson);
    });
    return grouped;
  }, [filteredLessons]);

  const handleLessonPress = (lessonId: string) => {
    const lesson = displayLessons.find((l: any) => l.id === lessonId);
    if (lesson) {
      // Check if prerequisites are met
      const prereqsMet = lesson.prerequisites.every((prereqId: string) =>
        completedIds.includes(prereqId)
      );
      
      if (prereqsMet) {
        navigation.navigate('LessonDetail', { lessonId });
      }
    }
  };

  const isLessonCompleted = (lessonId: string) => {
    return completedIds.includes(lessonId);
  };

  const isLessonLocked = (lesson: any) => {
    return !lesson.prerequisites.every((prereqId: string) =>
      completedIds.includes(prereqId)
    );
  };

  const getProgressPercentage = () => {
    if (available.length === 0) return 0;
    return Math.round((completed.length / available.length) * 100);
  };

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
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Braille Lessons</Text>
              <Text style={styles.subtitle}>
                {stats.total} lessons • {Math.floor(stats.totalDuration / 60)}h {stats.totalDuration % 60}m total
              </Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.statsCircle}>
                <Text style={styles.statsPercentage}>{getProgressPercentage()}%</Text>
                <Text style={styles.statsLabel}>Complete</Text>
              </View>
            </View>
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${getProgressPercentage()}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {completed.length} of {available.length} lessons completed
            </Text>
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="rgba(255, 255, 255, 0.5)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search lessons..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

          {/* View Mode Toggle */}
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'all' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('all')}
            >
              <Ionicons 
                name="list" 
                size={18} 
                color={viewMode === 'all' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'} 
              />
              <Text style={[styles.viewModeText, viewMode === 'all' && styles.viewModeTextActive]}>
                All Lessons
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'chapters' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('chapters')}
            >
              <Ionicons 
                name="folder-open" 
                size={18} 
                color={viewMode === 'chapters' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'} 
              />
              <Text style={[styles.viewModeText, viewMode === 'chapters' && styles.viewModeTextActive]}>
                By Chapter
              </Text>
            </TouchableOpacity>
          </View>

          {/* Level Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[styles.filterChip, !selectedLevel && styles.filterChipActive]}
              onPress={() => setSelectedLevel(null)}
            >
              <Text style={[styles.filterText, !selectedLevel && styles.filterTextActive]}>
                All Levels
              </Text>
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{available.length}</Text>
              </View>
            </TouchableOpacity>
            {levels.map((level) => {
              const levelCount = available.filter((l: any) => l.level === level).length;
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.filterChip, selectedLevel === level && styles.filterChipActive]}
                  onPress={() => setSelectedLevel(level)}
                >
                  <Text
                    style={[styles.filterText, selectedLevel === level && styles.filterTextActive]}
                  >
                    {level}
                  </Text>
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{levelCount}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Lessons List */}
          {viewMode === 'all' ? (
            // All Lessons View
            <>
              {filteredLessons.length > 0 ? (
                filteredLessons.map((lesson: any) => {
                  const completed = isLessonCompleted(lesson.id);
                  const locked = isLessonLocked(lesson);
                  return (
                    <TouchableOpacity
                      key={lesson.id}
                      style={[styles.lessonCard, locked && styles.lessonCardLocked]}
                      onPress={() => handleLessonPress(lesson.id)}
                      disabled={locked}
                      activeOpacity={locked ? 1 : 0.7}
                    >
                      <LinearGradient
                        colors={
                          locked
                            ? ['rgba(30, 30, 30, 0.4)', 'rgba(20, 20, 20, 0.2)']
                            : [EDU_COLORS.slateGray + '40', EDU_COLORS.deepSlate + '20']
                        }
                        style={styles.lessonCardGradient}
                      >
                        <View style={styles.lessonHeader}>
                          <View style={styles.lessonInfo}>
                            <View style={styles.lessonTitleRow}>
                              <Text style={[styles.lessonId, locked && styles.lessonIdLocked]}>
                                {lesson.id}
                              </Text>
                              <Text style={[styles.lessonTitle, locked && styles.lessonTitleLocked]}>
                                {lesson.title}
                              </Text>
                            </View>
                            <Text style={[styles.lessonChapter, locked && styles.lessonChapterLocked]}>
                              {lesson.chapter}
                            </Text>
                            <Text
                              style={[styles.lessonDescription, locked && styles.lessonDescriptionLocked]}
                              numberOfLines={2}
                            >
                              {lesson.description}
                            </Text>
                          </View>
                          <View style={styles.lessonStatus}>
                            {locked ? (
                              <Ionicons name="lock-closed" size={24} color="rgba(255, 255, 255, 0.3)" />
                            ) : completed ? (
                              <Ionicons name="checkmark-circle" size={28} color={EDU_COLORS.vibrantGreen} />
                            ) : (
                              <Ionicons name="play-circle" size={28} color={EDU_COLORS.primaryBlue} />
                            )}
                          </View>
                        </View>
                        <View style={styles.lessonFooter}>
                          <View style={styles.lessonMeta}>
                            <View style={[styles.levelBadge, locked && styles.levelBadgeLocked]}>
                              <Text style={[styles.levelText, locked && styles.levelTextLocked]}>
                                {lesson.level}
                              </Text>
                            </View>
                            <View style={styles.durationContainer}>
                              <Ionicons
                                name="time-outline"
                                size={16}
                                color={locked ? 'rgba(255, 255, 255, 0.3)' : EDU_COLORS.accent}
                              />
                              <Text style={[styles.durationText, locked && styles.durationTextLocked]}>
                                {' '}{lesson.duration_min} min
                              </Text>
                            </View>
                            {lesson.prerequisites.length > 0 && (
                              <View style={styles.prereqContainer}>
                                <Ionicons
                                  name="git-branch-outline"
                                  size={14}
                                  color={locked ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.5)'}
                                />
                                <Text style={[styles.prereqText, locked && styles.prereqTextLocked]}>
                                  {' '}{lesson.prerequisites.length} prereq
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
                  <Text style={styles.emptyStateText}>No lessons found</Text>
                  <Text style={styles.emptyStateSubtext}>Try adjusting your filters</Text>
                </View>
              )}
            </>
          ) : (
            // Chapters View
            <>
              {Object.keys(lessonsByChapter).length > 0 ? (
                Object.entries(lessonsByChapter).map(([chapter, lessons]: [string, any]) => (
                  <View key={chapter} style={styles.chapterSection}>
                    <View style={styles.chapterHeader}>
                      <Ionicons name="folder-open" size={20} color={EDU_COLORS.primaryBlue} />
                      <Text style={styles.chapterTitle}>{chapter}</Text>
                      <View style={styles.chapterBadge}>
                        <Text style={styles.chapterBadgeText}>{lessons.length}</Text>
                      </View>
                    </View>
                    {lessons.map((lesson: any) => {
                      const completed = isLessonCompleted(lesson.id);
                      const locked = isLessonLocked(lesson);
                      return (
                        <TouchableOpacity
                          key={lesson.id}
                          style={[styles.chapterLessonCard, locked && styles.lessonCardLocked]}
                          onPress={() => handleLessonPress(lesson.id)}
                          disabled={locked}
                          activeOpacity={locked ? 1 : 0.7}
                        >
                          <View style={styles.chapterLessonContent}>
                            <View style={styles.chapterLessonLeft}>
                              <Text style={[styles.chapterLessonId, locked && styles.lessonIdLocked]}>
                                {lesson.id}
                              </Text>
                              <View style={styles.chapterLessonInfo}>
                                <Text style={[styles.chapterLessonTitle, locked && styles.lessonTitleLocked]}>
                                  {lesson.title}
                                </Text>
                                <Text style={[styles.chapterLessonDuration, locked && styles.durationTextLocked]}>
                                  {lesson.duration_min} min
                                </Text>
                              </View>
                            </View>
                            <View style={styles.chapterLessonRight}>
                              {locked ? (
                                <Ionicons name="lock-closed" size={20} color="rgba(255, 255, 255, 0.3)" />
                              ) : completed ? (
                                <Ionicons name="checkmark-circle" size={24} color={EDU_COLORS.vibrantGreen} />
                              ) : (
                                <Ionicons name="play-circle-outline" size={24} color={EDU_COLORS.primaryBlue} />
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="folder-open-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
                  <Text style={styles.emptyStateText}>No chapters found</Text>
                </View>
              )}
            </>
          )}

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
    width: '100%',
    height: '100%',
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
    marginBottom: SPACING.lg,
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
  statsPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statsLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  progressBarContainer: {
    marginTop: SPACING.sm,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: EDU_COLORS.vibrantGreen,
    borderRadius: RADIUS.full,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: SPACING.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: SPACING.lg,
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
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    padding: SPACING.md,
    color: '#FFFFFF',
    fontSize: 16,
  },
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: SPACING.xs,
  },
  viewModeButtonActive: {
    backgroundColor: EDU_COLORS.primaryBlue + '30',
    borderColor: EDU_COLORS.primaryBlue + '60',
  },
  viewModeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: '#FFFFFF',
  },
  filterContainer: {
    maxHeight: 50,
    marginBottom: SPACING.md,
  },
  filterContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: SPACING.xs,
  },
  filterChipActive: {
    backgroundColor: EDU_COLORS.primaryBlue + '40',
    borderColor: EDU_COLORS.primaryBlue + '60',
  },
  filterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lessonCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  lessonCardLocked: {
    opacity: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  lessonCardGradient: {
    padding: SPACING.lg,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  lessonInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  lessonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  lessonId: {
    fontSize: 12,
    fontWeight: 'bold',
    color: EDU_COLORS.primaryBlue,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  lessonIdLocked: {
    color: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  lessonTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  lessonTitleLocked: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  lessonChapter: {
    fontSize: 12,
    color: EDU_COLORS.accent,
    marginBottom: SPACING.xs,
  },
  lessonChapterLocked: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  lessonDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  lessonDescriptionLocked: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  lessonStatus: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  levelBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  levelBadgeLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  levelText: {
    color: EDU_COLORS.primaryBlue,
    fontSize: 12,
    fontWeight: '600',
  },
  levelTextLocked: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  durationTextLocked: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  prereqContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prereqText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  prereqTextLocked: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  lockedText: {
    fontSize: 12,
    color: EDU_COLORS.warmOrange,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 3,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: SPACING.md,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: SPACING.xs,
  },
  chapterSection: {
    marginBottom: SPACING.xl,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: EDU_COLORS.primaryBlue,
    gap: SPACING.sm,
  },
  chapterTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  chapterBadge: {
    backgroundColor: EDU_COLORS.primaryBlue + '40',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    minWidth: 28,
    alignItems: 'center',
  },
  chapterBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chapterLessonCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  chapterLessonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  chapterLessonLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  chapterLessonId: {
    fontSize: 11,
    fontWeight: 'bold',
    color: EDU_COLORS.accent,
  },
  chapterLessonInfo: {
    flex: 1,
  },
  chapterLessonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  chapterLessonDuration: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  chapterLessonRight: {
    marginLeft: SPACING.sm,
  },
});
