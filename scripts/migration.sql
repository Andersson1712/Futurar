-- ================================================================
-- Futurar Database Schema Migration
-- Para Supabase Self-Hosted
-- ================================================================

-- Activar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. STUDENTS (tabla principal)
-- ================================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    age INTEGER,
    avatar_icon TEXT,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 2. STUDENT_SETTINGS (depende de students, 1:1)
-- ================================================================
CREATE TABLE IF NOT EXISTS student_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    scan_interval INTEGER DEFAULT 2000,
    scan_columns INTEGER DEFAULT 3,
    sound_enabled BOOLEAN DEFAULT true,
    voice_feedback BOOLEAN DEFAULT true,
    font_size TEXT DEFAULT 'medium',
    theme TEXT DEFAULT 'default',
    content_filter_level TEXT DEFAULT 'strict',
    max_stories_per_day INTEGER DEFAULT 5,
    preferred_protagonists TEXT[],
    preferred_sceneries TEXT[],
    preferred_styles TEXT[],
    story_length TEXT DEFAULT 'medium',
    target_audience TEXT DEFAULT 'child',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. STORIES (depende de students)
-- ================================================================
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    protagonist TEXT NOT NULL,
    scenery TEXT NOT NULL,
    mission TEXT NOT NULL,
    style TEXT NOT NULL,
    type TEXT DEFAULT 'story',
    image_url TEXT,
    is_favorite BOOLEAN DEFAULT false,
    dedication_to TEXT,
    dedication_reason TEXT,
    dedication_position TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_student_id ON stories(student_id);

-- ================================================================
-- 4. STUDENT_PROTAGONISTS (depende de students)
-- ================================================================
CREATE TABLE IF NOT EXISTS student_protagonists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    icon TEXT DEFAULT '👤',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_protagonists_student_id ON student_protagonists(student_id);

-- ================================================================
-- 5. STUDENT_SCENARIOS (depende de students)
-- ================================================================
CREATE TABLE IF NOT EXISTS student_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    icon TEXT DEFAULT '🌍',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_scenarios_student_id ON student_scenarios(student_id);

-- ================================================================
-- 6. STUDENT_MISSIONS (depende de students)
-- ================================================================
CREATE TABLE IF NOT EXISTS student_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    icon TEXT DEFAULT '🎯',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_missions_student_id ON student_missions(student_id);

-- ================================================================
-- 7. STUDENT_STYLES (depende de students)
-- ================================================================
CREATE TABLE IF NOT EXISTS student_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    icon TEXT DEFAULT '🎨',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_styles_student_id ON student_styles(student_id);

-- ================================================================
-- 8. AI_CONFIG (configuración global, singleton)
-- ================================================================
CREATE TYPE story_size_enum AS ENUM ('small', 'medium', 'large');

CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    active_provider TEXT DEFAULT 'gemini',
    gemini_api_key TEXT,
    openai_api_key TEXT,
    claude_api_key TEXT,
    groq_api_key TEXT,
    cloudflare_account_id TEXT,
    cloudflare_api_token TEXT,
    together_api_key TEXT,
    preferred_model TEXT,
    story_size story_size_enum DEFAULT 'medium',
    custom_story_structure TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 9. USAGE_SESSIONS (depende de students)
-- ================================================================
CREATE TABLE IF NOT EXISTS usage_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    stories_created INTEGER DEFAULT 0,
    total_interactions INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_usage_sessions_student_id ON usage_sessions(student_id);

-- ================================================================
-- RLS (Row Level Security) - Habilitar en todas las tablas
-- ================================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_protagonists ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (la app usa ANON key del frontend)
CREATE POLICY "Allow all for service role" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON student_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON stories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON student_protagonists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON student_scenarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON student_missions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON student_styles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON ai_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON usage_sessions FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- Función para actualizar updated_at automáticamente
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON student_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- ✅ Schema completo creado
-- ================================================================