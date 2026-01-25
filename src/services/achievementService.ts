// Achievement Service
import { supabase, isSupabaseConfigured } from '../config/supabase';
import type { Achievement } from '../types/database';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'lessons' | 'streak' | 'time' | 'accuracy' | 'special';
  requirement: number;
  points: number;
}

// Achievement type from database
export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: string;
  achievement_name: string;
  earned_at: string;
  metadata?: any;
}

// All available achievements
export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Lesson achievements
  { id: 'first_lesson', title: 'First Steps', description: 'Complete your first lesson', icon: '🎯', category: 'lessons', requirement: 1, points: 10 },
  { id: 'lessons_5', title: 'Getting Started', description: 'Complete 5 lessons', icon: '📚', category: 'lessons', requirement: 5, points: 25 },
  { id: 'lessons_10', title: 'Dedicated Learner', description: 'Complete 10 lessons', icon: '📖', category: 'lessons', requirement: 10, points: 50 },
  { id: 'lessons_25', title: 'Knowledge Seeker', description: 'Complete 25 lessons', icon: '🎓', category: 'lessons', requirement: 25, points: 100 },
  { id: 'lessons_50', title: 'Braille Scholar', description: 'Complete 50 lessons', icon: '🏆', category: 'lessons', requirement: 50, points: 200 },
  { id: 'lessons_100', title: 'Braille Master', description: 'Complete all 100 lessons', icon: '👑', category: 'lessons', requirement: 100, points: 500 },
  
  // Streak achievements
  { id: 'streak_3', title: 'Consistent', description: 'Maintain a 3-day streak', icon: '🔥', category: 'streak', requirement: 3, points: 30 },
  { id: 'streak_7', title: 'Weekly Warrior', description: 'Maintain a 7-day streak', icon: '💪', category: 'streak', requirement: 7, points: 70 },
  { id: 'streak_14', title: 'Two Week Champion', description: 'Maintain a 14-day streak', icon: '⭐', category: 'streak', requirement: 14, points: 140 },
  { id: 'streak_30', title: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '🌟', category: 'streak', requirement: 30, points: 300 },
  
  // Time achievements
  { id: 'time_60', title: 'Hour of Learning', description: 'Practice for 60 minutes total', icon: '⏰', category: 'time', requirement: 60, points: 20 },
  { id: 'time_300', title: 'Dedicated Practitioner', description: 'Practice for 5 hours total', icon: '📅', category: 'time', requirement: 300, points: 75 },
  { id: 'time_600', title: 'Committed Student', description: 'Practice for 10 hours total', icon: '🕐', category: 'time', requirement: 600, points: 150 },
  
  // Accuracy achievements
  { id: 'perfect_lesson', title: 'Perfectionist', description: 'Get 100% on any lesson', icon: '💯', category: 'accuracy', requirement: 100, points: 25 },
  { id: 'accuracy_90', title: 'High Achiever', description: 'Maintain 90%+ average accuracy', icon: '🎯', category: 'accuracy', requirement: 90, points: 100 },
  
  // Special achievements
  { id: 'device_connected', title: 'Hardware Ready', description: 'Connect a Braille device', icon: '🔗', category: 'special', requirement: 1, points: 50 },
  { id: 'first_print', title: 'First Print', description: 'Print your first Braille', icon: '🖨️', category: 'special', requirement: 1, points: 30 },
  { id: 'night_owl', title: 'Night Owl', description: 'Complete a lesson after midnight', icon: '🦉', category: 'special', requirement: 1, points: 15 },
  { id: 'early_bird', title: 'Early Bird', description: 'Complete a lesson before 6 AM', icon: '🐦', category: 'special', requirement: 1, points: 15 },
];

class AchievementService {
  // Get all achievements for a user
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      return error ? [] : (data as UserAchievement[]) || [];
    } catch {
      return [];
    }
  }

  // Check and unlock achievements based on user progress
  async checkAndUnlockAchievements(
    userId: string,
    stats: {
      lessonsCompleted: number;
      currentStreak: number;
      totalMinutes: number;
      averageAccuracy: number;
      lastScore?: number;
      deviceConnected?: boolean;
      hasPrinted?: boolean;
    }
  ): Promise<UserAchievement[]> {
    const unlockedAchievements: UserAchievement[] = [];
    const existingAchievements = await this.getUserAchievements(userId);
    const existingIds = new Set(existingAchievements.map(a => a.achievement_name));

    const now = new Date();
    const hour = now.getHours();

    for (const achievement of ACHIEVEMENTS) {
      // Skip if already unlocked (check by name/id)
      if (existingIds.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.category) {
        case 'lessons':
          shouldUnlock = stats.lessonsCompleted >= achievement.requirement;
          break;
        case 'streak':
          shouldUnlock = stats.currentStreak >= achievement.requirement;
          break;
        case 'time':
          shouldUnlock = stats.totalMinutes >= achievement.requirement;
          break;
        case 'accuracy':
          if (achievement.id === 'perfect_lesson') {
            shouldUnlock = stats.lastScore === 100;
          } else {
            shouldUnlock = stats.averageAccuracy >= achievement.requirement;
          }
          break;
        case 'special':
          if (achievement.id === 'device_connected') {
            shouldUnlock = stats.deviceConnected === true;
          } else if (achievement.id === 'first_print') {
            shouldUnlock = stats.hasPrinted === true;
          } else if (achievement.id === 'night_owl') {
            shouldUnlock = hour >= 0 && hour < 4;
          } else if (achievement.id === 'early_bird') {
            shouldUnlock = hour >= 4 && hour < 6;
          }
          break;
      }

      if (shouldUnlock) {
        const unlocked = await this.unlockAchievement(userId, achievement);
        if (unlocked) {
          unlockedAchievements.push(unlocked);
        }
      }
    }

    return unlockedAchievements;
  }

  // Unlock a specific achievement
  async unlockAchievement(
    userId: string,
    achievement: AchievementDefinition
  ): Promise<UserAchievement | null> {
    console.log('[AchievementService] Attempting to unlock achievement:', {
      userId,
      achievementId: achievement.id,
      achievementTitle: achievement.title,
    });

    if (!isSupabaseConfigured()) {
      console.log('[AchievementService] Supabase not configured, returning mock');
      // Return mock achievement for development
      return {
        id: `mock-${Date.now()}`,
        user_id: userId,
        achievement_type: achievement.category,
        achievement_name: achievement.id,
        earned_at: new Date().toISOString(),
        metadata: { title: achievement.title, points: achievement.points },
      };
    }

    try {
      const { data, error } = await supabase
        .from('achievements')
        .insert({
          user_id: userId,
          achievement_type: achievement.category,
          achievement_name: achievement.id,
          earned_at: new Date().toISOString(),
          metadata: { title: achievement.title, points: achievement.points },
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[AchievementService] Failed to unlock achievement:', error);
        return null;
      }

      console.log('[AchievementService] Achievement unlocked successfully:', data);
      return data as UserAchievement;
    } catch {
      return null;
    }
  }

  // Get achievement definition by ID
  getAchievementDefinition(achievementId: string): AchievementDefinition | undefined {
    return ACHIEVEMENTS.find(a => a.id === achievementId);
  }

  // Get all achievement definitions
  getAllDefinitions(): AchievementDefinition[] {
    return [...ACHIEVEMENTS];
  }

  // Get achievements by category
  getAchievementsByCategory(category: AchievementDefinition['category']): AchievementDefinition[] {
    return ACHIEVEMENTS.filter(a => a.category === category);
  }

  // Calculate total points from unlocked achievements
  calculateTotalPoints(unlockedAchievementNames: string[]): number {
    return ACHIEVEMENTS
      .filter(a => unlockedAchievementNames.includes(a.id))
      .reduce((sum, a) => sum + a.points, 0);
  }

  // Get next achievements to unlock
  getNextAchievements(
    unlockedNames: string[],
    stats: {
      lessonsCompleted: number;
      currentStreak: number;
      totalMinutes: number;
    }
  ): AchievementDefinition[] {
    const unlockedSet = new Set(unlockedNames);
    const nextAchievements: AchievementDefinition[] = [];

    // Find the next achievement in each category
    for (const category of ['lessons', 'streak', 'time'] as const) {
      const categoryAchievements = ACHIEVEMENTS
        .filter(a => a.category === category && !unlockedSet.has(a.id))
        .sort((a, b) => a.requirement - b.requirement);

      if (categoryAchievements.length > 0) {
        nextAchievements.push(categoryAchievements[0]);
      }
    }

    return nextAchievements;
  }

  // Get progress towards next achievements
  getAchievementProgress(
    achievementId: string,
    stats: {
      lessonsCompleted: number;
      currentStreak: number;
      totalMinutes: number;
      averageAccuracy: number;
    }
  ): { current: number; required: number; percentage: number } {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) {
      return { current: 0, required: 0, percentage: 0 };
    }

    let current = 0;
    switch (achievement.category) {
      case 'lessons':
        current = stats.lessonsCompleted;
        break;
      case 'streak':
        current = stats.currentStreak;
        break;
      case 'time':
        current = stats.totalMinutes;
        break;
      case 'accuracy':
        current = stats.averageAccuracy;
        break;
    }

    return {
      current,
      required: achievement.requirement,
      percentage: Math.min(100, Math.round((current / achievement.requirement) * 100)),
    };
  }
}

export const achievementService = new AchievementService();
export default achievementService;
