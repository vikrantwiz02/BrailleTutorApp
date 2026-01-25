-- Supabase Database Schema for Braille Tutor App
-- Run this in your Supabase SQL Editor

-- Enable UUID extension in public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    age INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- LESSON PROGRESS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0, -- seconds
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- Indexes
CREATE INDEX idx_lesson_progress_user_id ON public.lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);
CREATE INDEX idx_lesson_progress_completed ON public.lesson_progress(user_id, completed);

-- Enable RLS
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own lesson progress" ON public.lesson_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lesson progress" ON public.lesson_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lesson progress" ON public.lesson_progress
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- USER ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    lessons_completed INTEGER DEFAULT 0,
    practice_minutes INTEGER DEFAULT 0,
    accuracy_sum INTEGER DEFAULT 0,
    accuracy_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_user_analytics_user_date ON public.user_analytics(user_id, date DESC);

-- Enable RLS
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own analytics" ON public.user_analytics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analytics" ON public.user_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analytics" ON public.user_analytics
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- ACHIEVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL,
    achievement_name TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    UNIQUE(user_id, achievement_type)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own achievements" ON public.achievements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON public.achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- DEVICE PAIRINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.device_pairings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    mac_address TEXT NOT NULL,
    firmware_version TEXT,
    last_connected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- Enable RLS
ALTER TABLE public.device_pairings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own devices" ON public.device_pairings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices" ON public.device_pairings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices" ON public.device_pairings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices" ON public.device_pairings
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- CHAT HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_history_user_session ON public.chat_history(user_id, session_id, created_at);

-- Enable RLS
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own chat history" ON public.chat_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON public.chat_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    voice_speed DECIMAL(2,1) DEFAULT 1.0,
    audio_volume DECIMAL(2,1) DEFAULT 0.8,
    dot_depth DECIMAL(2,1) DEFAULT 0.6,
    print_speed TEXT DEFAULT 'normal',
    language TEXT DEFAULT 'en',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    dark_mode BOOLEAN DEFAULT TRUE,
    haptic_feedback BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own settings" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Trigger to create settings on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- ============================================
-- OFFLINE QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.offline_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.offline_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own offline queue" ON public.offline_queue
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Calculate current streak
CREATE OR REPLACE FUNCTION public.calculate_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    streak INTEGER := 0;
    current_date DATE := CURRENT_DATE;
    check_date DATE;
    found BOOLEAN;
BEGIN
    LOOP
        check_date := current_date - streak;
        
        SELECT EXISTS(
            SELECT 1 FROM public.user_analytics
            WHERE user_id = p_user_id
            AND date = check_date
            AND (lessons_completed > 0 OR practice_minutes > 0)
        ) INTO found;
        
        IF found THEN
            streak := streak + 1;
        ELSE
            -- Allow 1 day gap for current day
            IF streak = 0 AND check_date = CURRENT_DATE THEN
                check_date := check_date - 1;
                SELECT EXISTS(
                    SELECT 1 FROM public.user_analytics
                    WHERE user_id = p_user_id
                    AND date = check_date
                    AND (lessons_completed > 0 OR practice_minutes > 0)
                ) INTO found;
                IF found THEN
                    streak := streak + 1;
                    CONTINUE;
                END IF;
            END IF;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get weekly progress
CREATE OR REPLACE FUNCTION public.get_weekly_progress(p_user_id UUID)
RETURNS TABLE(day TEXT, minutes INTEGER, lessons INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT
        to_char(d.date, 'Dy') as day,
        COALESCE(ua.practice_minutes, 0)::INTEGER as minutes,
        COALESCE(ua.lessons_completed, 0)::INTEGER as lessons
    FROM (
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE as date
    ) d
    LEFT JOIN public.user_analytics ua
        ON ua.date = d.date AND ua.user_id = p_user_id
    ORDER BY d.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user stats summary
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE(
    total_lessons_completed INTEGER,
    total_practice_minutes INTEGER,
    average_score DECIMAL,
    current_streak INTEGER,
    longest_streak INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(CASE WHEN completed = TRUE THEN 1 END)::INTEGER as total_lessons_completed,
        COALESCE(SUM(time_spent) / 60, 0)::INTEGER as total_practice_minutes,
        COALESCE(AVG(CASE WHEN completed = TRUE THEN score END), 0)::DECIMAL as average_score,
        public.calculate_streak(p_user_id) as current_streak,
        (
            SELECT COALESCE(MAX(streak_length), 0)::INTEGER
            FROM (
                SELECT COUNT(*) as streak_length
                FROM (
                    SELECT date,
                        date - ROW_NUMBER() OVER (ORDER BY date)::INTEGER * INTERVAL '1 day' as grp
                    FROM public.user_analytics
                    WHERE user_id = p_user_id
                    AND (lessons_completed > 0 OR practice_minutes > 0)
                ) t
                GROUP BY grp
            ) streaks
        ) as longest_streak
    FROM public.lesson_progress
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS
-- ============================================

-- User streaks view
CREATE OR REPLACE VIEW public.user_streaks AS
SELECT
    p.id as user_id,
    public.calculate_streak(p.id) as current_streak,
    (
        SELECT COALESCE(MAX(streak_length), 0)
        FROM (
            SELECT COUNT(*) as streak_length
            FROM (
                SELECT date,
                    date - ROW_NUMBER() OVER (ORDER BY date)::INTEGER * INTERVAL '1 day' as grp
                FROM public.user_analytics ua
                WHERE ua.user_id = p.id
                AND (lessons_completed > 0 OR practice_minutes > 0)
            ) t
            GROUP BY grp
        ) streaks
    ) as longest_streak,
    (
        SELECT MAX(date)
        FROM public.user_analytics
        WHERE user_id = p.id
    ) as last_active_date
FROM public.profiles p;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_lesson_progress_updated_at
    BEFORE UPDATE ON public.lesson_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_analytics_updated_at
    BEFORE UPDATE ON public.user_analytics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
