// Supabase Configuration
// Free tier: 500MB DB, 1GB storage, 2GB bandwidth, unlimited API requests
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const isValidSupabaseUrl = (url: string): boolean => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

const hasValidSupabaseConfig =
  isValidSupabaseUrl(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 20 &&
  SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

// Create Supabase client with React Native AsyncStorage
// Using 'any' for database type to allow flexible operations before schema generation
// Use inert fallback values when env is missing so services can switch to mock mode safely.
const clientUrl = hasValidSupabaseConfig ? SUPABASE_URL : 'https://example.supabase.co';
const clientAnonKey = hasValidSupabaseConfig ? SUPABASE_ANON_KEY : 'invalid-anon-key';

export const supabase: SupabaseClient<any> = createClient(clientUrl, clientAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return hasValidSupabaseConfig;
};

if (!hasValidSupabaseConfig) {
  console.warn(
    '[Supabase] Missing or invalid EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Using mock auth mode.'
  );
}

export default supabase;
