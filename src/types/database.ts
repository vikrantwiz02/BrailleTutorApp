// Supabase Database Types
// Auto-generated types for type-safe database queries

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // User profiles (extends Supabase auth.users)
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          age: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar_url?: string | null;
          age?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          avatar_url?: string | null;
          age?: number | null;
          updated_at?: string;
        };
      };
      
      // Lesson progress tracking
      lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          completed: boolean;
          score: number;
          attempts: number;
          time_spent: number; // seconds
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          completed?: boolean;
          score?: number;
          attempts?: number;
          time_spent?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          completed?: boolean;
          score?: number;
          attempts?: number;
          time_spent?: number;
          completed_at?: string | null;
          updated_at?: string;
        };
      };
      
      // User analytics and statistics
      user_analytics: {
        Row: {
          id: string;
          user_id: string;
          date: string; // YYYY-MM-DD
          lessons_completed: number;
          practice_minutes: number;
          accuracy_sum: number;
          accuracy_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          lessons_completed?: number;
          practice_minutes?: number;
          accuracy_sum?: number;
          accuracy_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          lessons_completed?: number;
          practice_minutes?: number;
          accuracy_sum?: number;
          accuracy_count?: number;
          updated_at?: string;
        };
      };
      
      // User achievements
      achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_type: string;
          achievement_name: string;
          earned_at: string;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_type: string;
          achievement_name: string;
          earned_at?: string;
          metadata?: Json | null;
        };
        Update: {
          metadata?: Json | null;
        };
      };
      
      // Device pairings
      device_pairings: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          device_name: string;
          mac_address: string;
          firmware_version: string | null;
          last_connected: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          device_name: string;
          mac_address: string;
          firmware_version?: string | null;
          last_connected?: string;
          created_at?: string;
        };
        Update: {
          device_name?: string;
          firmware_version?: string | null;
          last_connected?: string;
        };
      };
      
      // Chat history with AI tutor
      chat_history: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at?: string;
        };
        Update: never; // Chat history is immutable
      };
      
      // User settings/preferences
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          voice_speed: number;
          audio_volume: number;
          dot_depth: number;
          print_speed: string;
          language: string;
          notifications_enabled: boolean;
          dark_mode: boolean;
          haptic_feedback: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          voice_speed?: number;
          audio_volume?: number;
          dot_depth?: number;
          print_speed?: string;
          language?: string;
          notifications_enabled?: boolean;
          dark_mode?: boolean;
          haptic_feedback?: boolean;
          updated_at?: string;
        };
        Update: {
          voice_speed?: number;
          audio_volume?: number;
          dot_depth?: number;
          print_speed?: string;
          language?: string;
          notifications_enabled?: boolean;
          dark_mode?: boolean;
          haptic_feedback?: boolean;
          updated_at?: string;
        };
      };
      
      // Offline action queue (for sync when online)
      offline_queue: {
        Row: {
          id: string;
          user_id: string;
          action_type: string;
          payload: Json;
          created_at: string;
          synced: boolean;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          action_type: string;
          payload: Json;
          created_at?: string;
          synced?: boolean;
          synced_at?: string | null;
        };
        Update: {
          synced?: boolean;
          synced_at?: string | null;
        };
      };
    };
    Views: {
      // User streak view (computed from analytics)
      user_streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_active_date: string;
        };
      };
    };
    Functions: {
      // Calculate user streak
      calculate_streak: {
        Args: { p_user_id: string };
        Returns: number;
      };
      // Get weekly progress
      get_weekly_progress: {
        Args: { p_user_id: string };
        Returns: { day: string; minutes: number; lessons: number }[];
      };
      // Get user stats
      get_user_stats: {
        Args: { p_user_id: string };
        Returns: {
          total_lessons_completed: number;
          total_practice_minutes: number;
          average_score: number;
          current_streak: number;
          longest_streak: number;
        }[];
      };
    };
  };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type LessonProgress = Database['public']['Tables']['lesson_progress']['Row'];
export type UserAnalytics = Database['public']['Tables']['user_analytics']['Row'];
export type Achievement = Database['public']['Tables']['achievements']['Row'];
export type DevicePairing = Database['public']['Tables']['device_pairings']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_history']['Row'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type OfflineAction = Database['public']['Tables']['offline_queue']['Row'];
