// Supabase Configuration
// Free tier: 500MB DB, 1GB storage, 2GB bandwidth, unlimited API requests
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables - replace with your Supabase project credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wvughhbrpnxvbkgalkwv.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dWdoaGJycG54dmJrZ2Fsa3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDg5ODMsImV4cCI6MjA4NDgyNDk4M30.vS6QtDWRCTFeqafPqiWMv1CDQpUsAIFW-FK3RlJ25Oo';

// Create Supabase client with React Native AsyncStorage
// Using 'any' for database type to allow flexible operations before schema generation
export const supabase: SupabaseClient<any> = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
};

export default supabase;
