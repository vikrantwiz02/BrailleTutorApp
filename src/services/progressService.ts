// Lesson Progress Service
import { supabase, isSupabaseConfigured } from '../config/supabase';
import type { LessonProgress } from '../types/database';
import { allLessons } from '../data';

export interface LessonProgressUpdate {
  lessonId: string;
  completed: boolean;
  score: number;
  attempts: number;
  timeSpent: number;
}

export interface UserStats {
  totalLessonsCompleted: number;
  totalPracticeMinutes: number;
  averageScore: number;
  currentStreak: number;
  longestStreak: number;
}

export interface WeeklyProgress {
  day: string;
  minutes: number;
  lessons: number;
}

class ProgressService {
  // Get all lesson progress for a user
  async getLessonProgress(userId: string): Promise<LessonProgress[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      return error ? [] : data || [];
    } catch {
      return [];
    }
  }

  // Get progress for a specific lesson
  async getLessonProgressById(userId: string, lessonId: string): Promise<LessonProgress | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .single();

      return error ? null : data;
    } catch {
      return null;
    }
  }

  // Update or create lesson progress
  async updateLessonProgress(
    userId: string, 
    progress: LessonProgressUpdate
  ): Promise<{ data: LessonProgress | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
      console.log('[ProgressService] Supabase not configured, skipping save');
      return { data: null, error: null };
    }

    if (!userId) {
      console.error('[ProgressService] No userId provided for saving progress');
      return { data: null, error: 'User ID is required' };
    }

    console.log('[ProgressService] Saving progress for user:', userId, 'lesson:', progress.lessonId);

    try {
      // Check if progress exists
      const { data: existingData, error: fetchError } = await supabase
        .from('lesson_progress')
        .select('id, attempts')
        .eq('user_id', userId)
        .eq('lesson_id', progress.lessonId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[ProgressService] Error checking existing progress:', fetchError);
      }

      const existing = existingData as { id: string; attempts: number } | null;
      
      const updateData = {
        user_id: userId,
        lesson_id: progress.lessonId,
        completed: progress.completed,
        score: progress.score,
        attempts: existing ? existing.attempts + 1 : progress.attempts,
        time_spent: progress.timeSpent,
        completed_at: progress.completed ? new Date().toISOString() : null,
      };

      if (existing) {
        // Update existing
        console.log('[ProgressService] Updating existing progress record:', existing.id);
        const { data, error } = await supabase
          .from('lesson_progress')
          .update(updateData as any)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('[ProgressService] Update error:', error);
        } else {
          console.log('[ProgressService] Progress updated successfully');
        }
        return { data: data as LessonProgress | null, error: error?.message || null };
      } else {
        // Insert new
        console.log('[ProgressService] Inserting new progress record');
        const { data, error } = await supabase
          .from('lesson_progress')
          .insert(updateData as any)
          .select()
          .single();

        if (error) {
          console.error('[ProgressService] Insert error:', error);
        } else {
          console.log('[ProgressService] Progress saved successfully:', data);
        }
        return { data: data as LessonProgress | null, error: error?.message || null };
      }
    } catch (err) {
      console.error('[ProgressService] Exception:', err);
      return { data: null, error: (err as Error).message };
    }
  }

  // Complete a lesson
  async completeLesson(
    userId: string,
    lessonId: string,
    score: number,
    timeSpent: number
  ): Promise<{ error: string | null }> {
    const result = await this.updateLessonProgress(userId, {
      lessonId,
      completed: true,
      score,
      attempts: 1,
      timeSpent,
    });

    // Also update daily analytics
    if (!result.error) {
      await this.updateDailyAnalytics(userId, 1, Math.floor(timeSpent / 60), score);
    }

    return { error: result.error };
  }

  // Get user statistics
  async getUserStats(userId: string): Promise<UserStats> {
    if (!isSupabaseConfigured()) {
      return {
        totalLessonsCompleted: 0,
        totalPracticeMinutes: 0,
        averageScore: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }

    try {
      const { data, error } = await supabase.rpc('get_user_stats', {
        p_user_id: userId,
      } as any);

      const statsData = data as { 
        total_lessons_completed: number;
        total_practice_minutes: number;
        average_score: number;
        current_streak: number;
        longest_streak: number;
      }[] | null;

      if (error || !statsData || statsData.length === 0) {
        return {
          totalLessonsCompleted: 0,
          totalPracticeMinutes: 0,
          averageScore: 0,
          currentStreak: 0,
          longestStreak: 0,
        };
      }

      const stats = statsData[0];
      return {
        totalLessonsCompleted: stats.total_lessons_completed || 0,
        totalPracticeMinutes: stats.total_practice_minutes || 0,
        averageScore: Math.round(stats.average_score || 0),
        currentStreak: stats.current_streak || 0,
        longestStreak: stats.longest_streak || 0,
      };
    } catch {
      return {
        totalLessonsCompleted: 0,
        totalPracticeMinutes: 0,
        averageScore: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }
  }

  // Get weekly progress
  async getWeeklyProgress(userId: string): Promise<WeeklyProgress[]> {
    if (!isSupabaseConfigured()) {
      return this.getMockWeeklyProgress();
    }

    try {
      const { data, error } = await supabase.rpc('get_weekly_progress', {
        p_user_id: userId,
      } as any);

      if (error || !data) {
        return this.getMockWeeklyProgress();
      }

      return (data as any[]).map((d: any) => ({
        day: d.day,
        minutes: d.minutes || 0,
        lessons: d.lessons || 0,
      }));
    } catch {
      return this.getMockWeeklyProgress();
    }
  }

  // Update daily analytics
  async updateDailyAnalytics(
    userId: string,
    lessonsCompleted: number,
    practiceMinutes: number,
    score: number
  ): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured()) {
      console.log('[ProgressService] Supabase not configured, skipping analytics');
      return { error: null };
    }

    if (!userId) {
      console.error('[ProgressService] No userId for analytics');
      return { error: 'User ID required' };
    }

    const today = new Date().toISOString().split('T')[0];
    console.log('[ProgressService] Updating daily analytics for:', userId, 'date:', today);

    try {
      // Check if today's record exists
      const { data: existingData, error: fetchError } = await supabase
        .from('user_analytics')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('[ProgressService] Analytics fetch error:', fetchError);
      }

      const existing = existingData as {
        id: string;
        lessons_completed: number;
        practice_minutes: number;
        accuracy_sum: number;
        accuracy_count: number;
      } | null;

      if (existing) {
        // Update existing
        console.log('[ProgressService] Updating existing analytics record');
        const { error } = await supabase
          .from('user_analytics')
          .update({
            lessons_completed: existing.lessons_completed + lessonsCompleted,
            practice_minutes: existing.practice_minutes + practiceMinutes,
            accuracy_sum: existing.accuracy_sum + score,
            accuracy_count: existing.accuracy_count + 1,
          } as any)
          .eq('id', existing.id);

        if (error) {
          console.error('[ProgressService] Analytics update error:', error);
        } else {
          console.log('[ProgressService] Analytics updated successfully');
        }
        return { error: error?.message || null };
      } else {
        // Insert new
        console.log('[ProgressService] Creating new analytics record');
        const { data, error } = await supabase
          .from('user_analytics')
          .insert({
            user_id: userId,
            date: today,
            lessons_completed: lessonsCompleted,
            practice_minutes: practiceMinutes,
            accuracy_sum: score,
            accuracy_count: 1,
          } as any)
          .select();

        if (error) {
          console.error('[ProgressService] Analytics insert error:', error);
        } else {
          console.log('[ProgressService] Analytics created successfully:', data);
        }
        return { error: error?.message || null };
      }
    } catch (err) {
      console.error('[ProgressService] Analytics exception:', err);
      return { error: (err as Error).message };
    }
  }

  // Get completed lesson IDs
  async getCompletedLessonIds(userId: string): Promise<string[]> {
    if (!isSupabaseConfigured()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('lesson_id')
        .eq('user_id', userId)
        .eq('completed', true);

      return error ? [] : (data as { lesson_id: string }[] || []).map(d => d.lesson_id);
    } catch {
      return [];
    }
  }

  // Get lesson completion percentage by level
  async getLevelProgress(userId: string): Promise<Record<string, { completed: number; total: number }>> {
    const completedIds = await this.getCompletedLessonIds(userId);
    
    const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
    const result: Record<string, { completed: number; total: number }> = {};

    for (const level of levels) {
      const levelLessons = allLessons.filter(l => l.level === level);
      const completedInLevel = levelLessons.filter(l => completedIds.includes(l.id)).length;
      result[level] = {
        completed: completedInLevel,
        total: levelLessons.length,
      };
    }

    return result;
  }

  // Mock weekly progress for development
  private getMockWeeklyProgress(): WeeklyProgress[] {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    
    return Array.from({ length: 7 }, (_, i) => ({
      day: days[(today - 6 + i + 7) % 7],
      minutes: Math.floor(Math.random() * 60),
      lessons: Math.floor(Math.random() * 3),
    }));
  }
}

export const progressService = new ProgressService();
export default progressService;
