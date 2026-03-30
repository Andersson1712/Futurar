/**
 * Script para consultar la base de datos de Supabase (Cloud o Self-hosted)
 * 
 * Uso:
 *   node scripts/db-query.mjs                        → Lista todas las tablas
 *   node scripts/db-query.mjs students                → Muestra datos de students
 *   node scripts/db-query.mjs stories --limit 5       → Muestra 5 registros
 *   node scripts/db-query.mjs students --count         → Cuenta registros
 *   node scripts/db-query.mjs --sql "SELECT * FROM students LIMIT 3"  → SQL directo
 * 
 * Configuración: Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY del .env
 *                Opcionalmente SUPABASE_SERVICE_ROLE_KEY para bypass RLS
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer .env manualmente
function loadEnv() {
    const envPath = resolve(__dirname, '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    const vars = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
    return vars;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
// Preferir SERVICE_ROLE_KEY (bypass RLS) si existe, sino usar ANON_KEY
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const keyType = env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Configurá en .env:');
    console.error('   VITE_SUPABASE_URL=https://supabase.try-ema.com');
    console.error('   VITE_SUPABASE_ANON_KEY=tu_anon_key');
    console.error('   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key (opcional, bypass RLS)');
    process.exit(1);
}

console.log(`🔗 ${SUPABASE_URL} (usando ${keyType} key)\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tablas conocidas del proyecto
const KNOWN_TABLES = [
    'students',
    'student_settings',
    'stories',
    'student_protagonists',
    'student_scenarios',
    'student_missions',
    'student_styles',
    'ai_config',
];

async function listTables() {
    console.log('📊 Tablas del proyecto:\n');
    for (const table of KNOWN_TABLES) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`  ❌ ${table} — ${error.message}`);
        } else {
            console.log(`  ✅ ${table} — ${count} registros`);
        }
    }
    console.log('');
}

async function queryTable(table, { limit = 20, countOnly = false } = {}) {
    console.log(`📋 Tabla: ${table}\n`);

    if (countOnly) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        if (error) {
            console.error(`❌ Error: ${error.message}`);
        } else {
            console.log(`  Total: ${count} registros`);
        }
        return;
    }

    const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(limit);

    if (error) {
        console.error(`❌ Error: ${error.message}`);
        return;
    }

    console.log(`  Total: ${count} registros (mostrando ${data.length})\n`);

    if (data.length === 0) {
        console.log('  (tabla vacía)');
        return;
    }

    console.table(data);
}

async function runSQL(sql) {
    console.log(`🔧 SQL: ${sql}\n`);
    const { data, error } = await supabase.rpc('', {}).then(() => null).catch(() => null);

    // Usar la REST API directamente para SQL arbitrario
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
    });

    if (!res.ok) {
        // Fallback: usar PostgREST query
        console.log('⚠️  SQL directo no disponible via REST. Usá psql para queries complejos.');
        console.log(`   psql 'postgres://postgres:PASSWORD@supabase.try-ema.com:5432/postgres'`);
    }
}

// Parse args
const args = process.argv.slice(2);
const sqlIdx = args.indexOf('--sql');

if (sqlIdx !== -1) {
    const sql = args[sqlIdx + 1];
    if (sql) await runSQL(sql);
    else console.error('❌ Falta la query: --sql "SELECT ..."');
} else {
    const table = args.find(a => !a.startsWith('--'));
    const countOnly = args.includes('--count');
    const limitArg = args.indexOf('--limit');
    const limit = limitArg !== -1 ? parseInt(args[limitArg + 1]) || 20 : 20;

    if (!table) {
        await listTables();
    } else {
        await queryTable(table, { limit, countOnly });
    }
}
