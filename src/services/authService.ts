// Authentication Service
import { supabase, isSupabaseConfigured } from '../config/supabase';
import type { Profile, UserSettings } from '../types/database';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  age?: number;
  created_at: string;
}

export interface AuthResponse {
  user: AuthUser | null;
  token: string | null;
  error: string | null;
}

export interface RegisterParams {
  email: string;
  password: string;
  name: string;
  age?: number;
}

export interface LoginParams {
  email: string;
  password: string;
}

class AuthService {
  // Register new user
  async register(params: RegisterParams): Promise<AuthResponse> {
    if (!isSupabaseConfigured()) {
      // Fallback for development without Supabase
      return this.mockRegister(params);
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            name: params.name,
            age: params.age,
          },
        },
      });

      if (error) {
        return { user: null, token: null, error: error.message };
      }

      if (!data.user) {
        return { user: null, token: null, error: 'Registration failed' };
      }

      // Update profile with additional info
      if (params.age) {
        await supabase
          .from('profiles')
          .update({ age: params.age } as any)
          .eq('id', data.user.id);
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email!,
        name: params.name,
        created_at: data.user.created_at,
      };

      return {
        user: authUser,
        token: data.session?.access_token || null,
        error: null,
      };
    } catch (err) {
      return { user: null, token: null, error: (err as Error).message };
    }
  }

  // Login existing user
  async login(params: LoginParams): Promise<AuthResponse> {
    console.log('[AuthService] Login attempt for:', params.email);
    
    if (!isSupabaseConfigured()) {
      console.log('[AuthService] Supabase not configured, using mock login');
      return this.mockLogin(params);
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      });

      if (error) {
        console.error('[AuthService] Login error:', error.message);
        return { user: null, token: null, error: error.message };
      }

      if (!data.user) {
        console.error('[AuthService] Login failed - no user returned');
        return { user: null, token: null, error: 'Login failed' };
      }

      console.log('[AuthService] Login successful, user ID:', data.user.id);

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.log('[AuthService] Profile fetch error:', profileError.message);
      }

      const profileData = profile as Profile | null;
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email!,
        name: profileData?.name || data.user.email!.split('@')[0],
        avatar_url: profileData?.avatar_url || undefined,
        age: profileData?.age || undefined,
        created_at: data.user.created_at,
      };

      console.log('[AuthService] User authenticated:', authUser.id, authUser.name);

      return {
        user: authUser,
        token: data.session?.access_token || null,
        error: null,
      };
    } catch (err) {
      console.error('[AuthService] Login exception:', err);
      return { user: null, token: null, error: (err as Error).message };
    }
  }

  // Logout
  async logout(): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signOut();
      return { error: error?.message || null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // Get current session
  async getSession(): Promise<AuthResponse> {
    if (!isSupabaseConfigured()) {
      return { user: null, token: null, error: null };
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        return { user: null, token: null, error: error?.message || null };
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const profileData = profile as Profile | null;
      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email!,
        name: profileData?.name || session.user.email!.split('@')[0],
        avatar_url: profileData?.avatar_url || undefined,
        age: profileData?.age || undefined,
        created_at: session.user.created_at,
      };

      return {
        user: authUser,
        token: session.access_token,
        error: null,
      };
    } catch (err) {
      return { user: null, token: null, error: (err as Error).message };
    }
  }

  // Update profile
  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('id', userId);

      return { error: error?.message || null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error?.message || null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // Get user settings
  async getSettings(userId: string): Promise<UserSettings | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      return error ? null : data;
    } catch {
      return null;
    }
  }

  // Update user settings
  async updateSettings(userId: string, settings: Partial<UserSettings>): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured()) {
      return { error: null };
    }

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, ...settings } as any)
        .eq('user_id', userId);

      return { error: error?.message || null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // Mock methods for development without Supabase
  private mockRegister(params: RegisterParams): AuthResponse {
    return {
      user: {
        id: `mock-${Date.now()}`,
        email: params.email,
        name: params.name,
        age: params.age,
        created_at: new Date().toISOString(),
      },
      token: `mock-token-${Date.now()}`,
      error: null,
    };
  }

  private mockLogin(params: LoginParams): AuthResponse {
    return {
      user: {
        id: `mock-${Date.now()}`,
        email: params.email,
        name: params.email.split('@')[0],
        created_at: new Date().toISOString(),
      },
      token: `mock-token-${Date.now()}`,
      error: null,
    };
  }
}

export const authService = new AuthService();
export default authService;
