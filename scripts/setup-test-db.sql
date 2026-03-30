-- ================================================================
-- Futurar — Setup completo de base de datos para TEST
-- Supabase Self-Hosted
-- ================================================================
-- Ejecutar este script en el SQL Editor del Studio en:
--   http://<IP_SERVIDOR>:8000
--
-- O via psql:
--   psql 'postgres://postgres:<PASSWORD>@<IP>:5432/postgres' -f setup-test-db.sql
-- ================================================================

-- ----------------------------------------------------------------
-- 0. LIMPIEZA (drop en orden inverso para respetar FK)
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS usage_sessions       CASCADE;
DROP TABLE IF EXISTS stories              CASCADE;
DROP TABLE IF EXISTS student_styles       CASCADE;
DROP TABLE IF EXISTS student_missions     CASCADE;
DROP TABLE IF EXISTS student_scenarios    CASCADE;
DROP TABLE IF EXISTS student_protagonists CASCADE;
DROP TABLE IF EXISTS student_settings     CASCADE;
DROP TABLE IF EXISTS ai_config            CASCADE;
DROP TABLE IF EXISTS students             CASCADE;

DROP TYPE  IF EXISTS story_size_enum CASCADE;

DROP FUNCTION IF EXISTS update_updated_at CASCADE;

-- ================================================================
-- 1. EXTENSIONES
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 2. TIPOS PERSONALIZADOS
-- ================================================================
CREATE TYPE story_size_enum AS ENUM ('small', 'medium', 'large');

-- ================================================================
-- 3. TABLA: students
-- ================================================================
CREATE TABLE students (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT        NOT NULL,
    age         INTEGER,
    avatar_icon TEXT,
    is_active   BOOLEAN     DEFAULT true,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 4. TABLA: student_settings  (1:1 con students)
-- ================================================================
CREATE TABLE student_settings (
    id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id               UUID        NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    scan_interval            INTEGER     DEFAULT 2000,
    scan_columns             INTEGER     DEFAULT 3,
    sound_enabled            BOOLEAN     DEFAULT true,
    voice_feedback           BOOLEAN     DEFAULT true,
    font_size                TEXT        DEFAULT 'medium',
    theme                    TEXT        DEFAULT 'default',
    content_filter_level     TEXT        DEFAULT 'strict',
    max_stories_per_day      INTEGER     DEFAULT 5,
    preferred_protagonists   TEXT[],
    preferred_sceneries      TEXT[],
    preferred_styles         TEXT[],
    story_length             TEXT        DEFAULT 'medium',
    target_audience          TEXT        DEFAULT 'child',
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 5. TABLA: stories
-- ================================================================
CREATE TABLE stories (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id          UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title               TEXT        NOT NULL,
    content             TEXT,
    protagonist         TEXT        NOT NULL,
    scenery             TEXT        NOT NULL,
    mission             TEXT        NOT NULL,
    style               TEXT        NOT NULL,
    type                TEXT        DEFAULT 'story',
    image_url           TEXT,
    is_favorite         BOOLEAN     DEFAULT false,
    dedication_to       TEXT,
    dedication_reason   TEXT,
    dedication_position TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stories_student_id ON stories(student_id);

-- ================================================================
-- 6. TABLA: student_protagonists
-- ================================================================
CREATE TABLE student_protagonists (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label      TEXT        NOT NULL,
    icon       TEXT        DEFAULT '👤',
    is_enabled BOOLEAN     DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_protagonists_student_id ON student_protagonists(student_id);

-- ================================================================
-- 7. TABLA: student_scenarios
-- ================================================================
CREATE TABLE student_scenarios (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label      TEXT        NOT NULL,
    icon       TEXT        DEFAULT '🌍',
    is_enabled BOOLEAN     DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_scenarios_student_id ON student_scenarios(student_id);

-- ================================================================
-- 8. TABLA: student_missions
-- ================================================================
CREATE TABLE student_missions (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label      TEXT        NOT NULL,
    icon       TEXT        DEFAULT '🎯',
    is_enabled BOOLEAN     DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_missions_student_id ON student_missions(student_id);

-- ================================================================
-- 9. TABLA: student_styles
-- ================================================================
CREATE TABLE student_styles (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    label      TEXT        NOT NULL,
    icon       TEXT        DEFAULT '🎨',
    is_enabled BOOLEAN     DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_student_styles_student_id ON student_styles(student_id);

-- ================================================================
-- 10. TABLA: ai_config  (singleton — solo 1 fila)
-- ================================================================
CREATE TABLE ai_config (
    id                     UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    active_provider        TEXT             DEFAULT 'gemini',
    active_image_provider  TEXT             DEFAULT 'freepik',
    gemini_api_key         TEXT,
    openai_api_key         TEXT,
    claude_api_key         TEXT,
    groq_api_key           TEXT,
    cloudflare_account_id  TEXT,
    cloudflare_api_token   TEXT,
    together_api_key       TEXT,
    freepik_api_key        TEXT,
    preferred_model        TEXT,
    preferred_image_model  TEXT             DEFAULT 'imagen-4.0-fast-generate-preview-06-06',
    story_size             story_size_enum  DEFAULT 'medium',
    custom_story_structure TEXT,
    created_at             TIMESTAMPTZ      DEFAULT NOW(),
    updated_at             TIMESTAMPTZ      DEFAULT NOW()
);

-- ================================================================
-- 11. TABLA: usage_sessions
-- ================================================================
CREATE TABLE usage_sessions (
    id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id         UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    started_at         TIMESTAMPTZ DEFAULT NOW(),
    ended_at           TIMESTAMPTZ,
    stories_created    INTEGER     DEFAULT 0,
    total_interactions INTEGER     DEFAULT 0
);

CREATE INDEX idx_usage_sessions_student_id ON usage_sessions(student_id);

-- ================================================================
-- 12. FUNCIÓN & TRIGGERS para updated_at automático
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON student_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- 13. ROW LEVEL SECURITY (RLS)
-- ================================================================
ALTER TABLE students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_protagonists ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_scenarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_missions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_styles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_sessions       ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para ANON key (app usa clave pública del frontend)
CREATE POLICY "Allow all" ON students             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON student_settings     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stories              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON student_protagonists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON student_scenarios    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON student_missions     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON student_styles       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ai_config            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON usage_sessions       FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- 14. DATOS DE PRUEBA (seed para ambiente de test)
-- ================================================================

-- Configuración de IA (singleton)
INSERT INTO ai_config (active_provider, story_size)
VALUES ('gemini', 'medium');

-- Estudiante de prueba 1
WITH s AS (
    INSERT INTO students (name, age, avatar_icon, is_active, notes)
    VALUES ('Lucas García', 8, '🦁', true, 'Estudiante de prueba - Le gustan los dinosaurios')
    RETURNING id
)
INSERT INTO student_settings (
    student_id, scan_interval, scan_columns, sound_enabled,
    voice_feedback, font_size, theme, content_filter_level, max_stories_per_day
)
SELECT id, 2000, 3, true, true, 'large', 'default', 'strict', 5
FROM s;

-- Protagonistas del estudiante 1
WITH s AS (SELECT id FROM students WHERE name = 'Lucas García')
INSERT INTO student_protagonists (student_id, label, icon, is_enabled)
SELECT s.id, p.label, p.icon, true
FROM s, (VALUES
    ('Dinosaurio', '🦕'),
    ('Astronauta', '👨‍🚀'),
    ('Superhéroe', '🦸'),
    ('Pirata',     '🏴‍☠️')
) AS p(label, icon);

-- Escenarios del estudiante 1
WITH s AS (SELECT id FROM students WHERE name = 'Lucas García')
INSERT INTO student_scenarios (student_id, label, icon, is_enabled)
SELECT s.id, p.label, p.icon, true
FROM s, (VALUES
    ('Selva',      '🌴'),
    ('Espacio',    '🚀'),
    ('Mar',        '🌊'),
    ('Ciudad',     '🏙️')
) AS p(label, icon);

-- Misiones del estudiante 1
WITH s AS (SELECT id FROM students WHERE name = 'Lucas García')
INSERT INTO student_missions (student_id, label, icon, is_enabled)
SELECT s.id, p.label, p.icon, true
FROM s, (VALUES
    ('Salvar a un amigo',  '🤝'),
    ('Encontrar un tesoro','💎'),
    ('Vencer al malo',     '⚔️'),
    ('Aprender algo nuevo','📚')
) AS p(label, icon);

-- Estilos del estudiante 1
WITH s AS (SELECT id FROM students WHERE name = 'Lucas García')
INSERT INTO student_styles (student_id, label, icon, is_enabled)
SELECT s.id, p.label, p.icon, true
FROM s, (VALUES
    ('Aventura',  '🗺️'),
    ('Divertido', '😄'),
    ('Misterio',  '🔍'),
    ('Musical',   '🎵')
) AS p(label, icon);

-- Historia de prueba
WITH s AS (SELECT id FROM students WHERE name = 'Lucas García')
INSERT INTO stories (student_id, title, content, protagonist, scenery, mission, style, type, is_favorite)
SELECT
    s.id,
    'El Dinosaurio en el Espacio',
    'Había una vez un dinosaurio llamado Rex que quería explorar el cosmos...',
    'Dinosaurio',
    'Espacio',
    'Encontrar un tesoro',
    'Aventura',
    'story',
    true
FROM s;

-- Estudiante de prueba 2 (sin configuración extra — para testear onboarding)
INSERT INTO students (name, age, avatar_icon, is_active, notes)
VALUES ('Sofía Martínez', 10, '🌟', true, 'Estudiante de prueba - Onboarding');

-- ================================================================
-- 15. VERIFICACIÓN FINAL
-- ================================================================
SELECT 'students'             AS tabla, COUNT(*) AS filas FROM students
UNION ALL
SELECT 'student_settings',     COUNT(*) FROM student_settings
UNION ALL
SELECT 'student_protagonists', COUNT(*) FROM student_protagonists
UNION ALL
SELECT 'student_scenarios',    COUNT(*) FROM student_scenarios
UNION ALL
SELECT 'student_missions',     COUNT(*) FROM student_missions
UNION ALL
SELECT 'student_styles',       COUNT(*) FROM student_styles
UNION ALL
SELECT 'ai_config',            COUNT(*) FROM ai_config
UNION ALL
SELECT 'stories',              COUNT(*) FROM stories
UNION ALL
SELECT 'usage_sessions',       COUNT(*) FROM usage_sessions
ORDER BY tabla;

-- ================================================================
-- ✅ Setup completado exitosamente
-- ================================================================