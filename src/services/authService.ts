// Authentication Service
// Strategy: Local AsyncStorage auth is always available (no verification, no network).
// If Supabase is configured AND online, it also syncs there — but local always wins
// so login never breaks due to Supabase email-confirmation settings.

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
  password: string;   // stored as-is; local-only learning app
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

async function getLocalUsers(): Promise<LocalUser[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
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

    // --- Local registration (always runs) ---
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

    const authUser: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      age: newUser.age,
      created_at: newUser.created_at,
    };
    const token = generateToken(newUser.id);
    await saveLocalSession(authUser, token);

    // --- Best-effort Supabase sync (silent, never blocks the user) ---
    if (isSupabaseConfigured()) {
      supabase.auth.signUp({
        email,
        password: params.password,
        options: { data: { name: params.name, age: params.age } },
      }).catch(() => {/* ignore */});
    }

    return { user: authUser, token, error: null };
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  async login(params: LoginParams): Promise<AuthResponse> {
    const email = this.normalizeEmail(params.email);

    // --- Local lookup first ---
    const users = await getLocalUsers();
    const found = users.find(u => u.email === email);

    if (!found) {
      return { user: null, token: null, error: 'No account found with this email. Please sign up first.' };
    }

    if (found.password !== params.password) {
      return { user: null, token: null, error: 'Incorrect password. Please try again.' };
    }

    const authUser: AuthUser = {
      id: found.id,
      email: found.email,
      name: found.name,
      age: found.age,
      created_at: found.created_at,
    };
    const token = generateToken(found.id);
    await saveLocalSession(authUser, token);

    // --- Best-effort Supabase sync (silent) ---
    if (isSupabaseConfigured()) {
      supabase.auth.signInWithPassword({ email, password: params.password }).catch(() => {/* ignore */});
    }

    return { user: authUser, token, error: null };
  }

  // ── Logout ───────────────────────────────────────────────────────────────────
  async logout(): Promise<{ error: string | null }> {
    await clearLocalSession();
    if (isSupabaseConfigured()) {
      supabase.auth.signOut().catch(() => {/* ignore */});
    }
    return { error: null };
  }

  // ── Get session (app resume) ──────────────────────────────────────────────────
  async getSession(): Promise<AuthResponse> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (!raw) return { user: null, token: null, error: null };
      const { user, token } = JSON.parse(raw);
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
      // Update saved session too
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        session.user = { ...session.user, ...updates };
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // ── Reset password (local) ────────────────────────────────────────────────────
  async resetPassword(email: string): Promise<{ error: string | null }> {
    // Local app has no email — just acknowledge
    return { error: null };
  }

  // ── Kept for API compatibility (no-op) ───────────────────────────────────────
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
