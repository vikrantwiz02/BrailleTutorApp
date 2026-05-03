// Authentication Service
// Strategy: Local AsyncStorage (fast, offline-first) + Supabase (cloud backup).
// Login order: local → Supabase fallback (handles reinstall / data-clear).
// Registration: local save first, Supabase sync in background.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../config/supabase';

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

// ── Local storage keys ────────────────────────────────────────────────────────

const USERS_KEY   = '@braille_local_users';
const SESSION_KEY = '@braille_local_session';

interface LocalUser {
  id: string;
  email: string;
  password: string;   // plain-text; local-only learning app, not a banking app
  name: string;
  age?: number;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateToken(userId: string): string {
  return `local-token-${userId}-${Date.now()}`;
}

function toAuthUser(u: LocalUser): AuthUser {
  return { id: u.id, email: u.email, name: u.name, age: u.age, created_at: u.created_at };
}

async function getLocalUsers(): Promise<LocalUser[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as LocalUser[]) : [];
  } catch {
    return [];
  }
}

async function saveLocalUsers(users: LocalUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function saveLocalSession(user: AuthUser, token: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ user, token }));
}

async function clearLocalSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// ── Auth Service ──────────────────────────────────────────────────────────────

class AuthService {
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  // ── Register ────────────────────────────────────────────────────────────────
  async register(params: RegisterParams): Promise<AuthResponse> {
    const email = this.normalizeEmail(params.email);

    // Local check first — if account already exists, tell them to sign in
    const users = await getLocalUsers();
    const existing = users.find(u => u.email === email);
    if (existing) {
      return { user: null, token: null, error: 'An account with this email already exists. Please sign in.' };
    }

    const newUser: LocalUser = {
      id: generateId(),
      email,
      password: params.password,
      name: params.name,
      age: params.age,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    await saveLocalUsers(users);

    const authUser = toAuthUser(newUser);
    const token = generateToken(newUser.id);
    await saveLocalSession(authUser, token);

    // Sync to Supabase so the account is available as a login fallback
    // (if email confirmation is disabled in the Supabase dashboard this is instant;
    //  if enabled the user will need to verify before cross-device login works)
    if (isSupabaseConfigured()) {
      supabase.auth.signUp({
        email,
        password: params.password,
        options: { data: { name: params.name, age: params.age } },
      }).catch(() => { /* ignore — local auth already succeeded */ });
    }

    return { user: authUser, token, error: null };
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  async login(params: LoginParams): Promise<AuthResponse> {
    const email = this.normalizeEmail(params.email);

    // ── Step 1: local storage ─────────────────────────────────────────────────
    const users = await getLocalUsers();
    const found = users.find(u => u.email === email);

    if (found) {
      if (found.password !== params.password) {
        return { user: null, token: null, error: 'Incorrect password. Please try again.' };
      }
      const authUser = toAuthUser(found);
      const token = generateToken(found.id);
      await saveLocalSession(authUser, token);

      // Best-effort Supabase sync in background (silent)
      if (isSupabaseConfigured()) {
        supabase.auth.signInWithPassword({ email, password: params.password }).catch(() => {});
      }
      return { user: authUser, token, error: null };
    }

    // ── Step 2: local account missing — try Supabase as fallback ─────────────
    // This handles: app reinstalled, app data cleared, or first login on a new device.
    if (isSupabaseConfigured()) {
      try {
        const { data, error: sbError } = await supabase.auth.signInWithPassword({
          email,
          password: params.password,
        });

        if (!sbError && data.user) {
          // Supabase auth succeeded → recreate the local user record
          const restored: LocalUser = {
            id: `supabase-${data.user.id}`,
            email: data.user.email ?? email,
            password: params.password,
            name: (data.user.user_metadata?.name as string) || email.split('@')[0],
            age: data.user.user_metadata?.age as number | undefined,
            created_at: data.user.created_at,
          };
          const updatedUsers = [...users, restored];
          await saveLocalUsers(updatedUsers).catch(() => { /* best effort */ });
          const authUser = toAuthUser(restored);
          const token = generateToken(restored.id);
          await saveLocalSession(authUser, token);
          return { user: authUser, token, error: null };
        }

        if (sbError) {
          const msg = sbError.message?.toLowerCase() ?? '';
          if (msg.includes('email not confirmed')) {
            return {
              user: null, token: null,
              error: 'Email not verified. Please check your inbox and click the confirmation link, then try again.',
            };
          }
          if (msg.includes('invalid login credentials') || msg.includes('user not found')) {
            // Confirmed wrong credentials — don't fall through to generic message
            return { user: null, token: null, error: 'No account found with this email. Please sign up first.' };
          }
        }
      } catch {
        // Network unavailable — fall through to the local-only error below
      }
    }

    return { user: null, token: null, error: 'No account found with this email. Please sign up first.' };
  }

  // ── Logout ───────────────────────────────────────────────────────────────────
  async logout(): Promise<{ error: string | null }> {
    await clearLocalSession();
    if (isSupabaseConfigured()) {
      supabase.auth.signOut().catch(() => {});
    }
    return { error: null };
  }

  // ── Get session (app resume) ──────────────────────────────────────────────────
  async getSession(): Promise<AuthResponse> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (!raw) return { user: null, token: null, error: null };
      const { user, token } = JSON.parse(raw) as { user: AuthUser; token: string };
      if (!user || !token) return { user: null, token: null, error: null };
      return { user, token, error: null };
    } catch {
      return { user: null, token: null, error: null };
    }
  }

  // ── Update profile ────────────────────────────────────────────────────────────
  async updateProfile(userId: string, updates: Partial<AuthUser>): Promise<{ error: string | null }> {
    try {
      const users = await getLocalUsers();
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        await saveLocalUsers(users);
      }
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as { user: AuthUser; token: string };
        session.user = { ...session.user, ...updates };
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // ── Reset password (local) ────────────────────────────────────────────────────
  async resetPassword(_email: string): Promise<{ error: string | null }> {
    return { error: null };
  }

  // ── Kept for API compatibility (no-ops) ──────────────────────────────────────
  async resendVerificationEmail(_email: string): Promise<{ error: string | null }> {
    return { error: null };
  }

  async getSettings(_userId: string): Promise<null> {
    return null;
  }

  async updateSettings(_userId: string, _settings: object): Promise<{ error: string | null }> {
    return { error: null };
  }
}

export const authService = new AuthService();
export default authService;
