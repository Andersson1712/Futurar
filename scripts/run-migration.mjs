/**
 * Ejecutar migración en Supabase Self-Hosted
 * 
 * Uso: node scripts/run-migration.mjs
 * 
 * Lee migration.sql y lo ejecuta contra tu instancia de Supabase
 * usando la REST API con SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer .env
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
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Necesitás VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

console.log(`🔗 Conectando a: ${SUPABASE_URL}\n`);

// Leer migración SQL
const sqlPath = resolve(__dirname, 'migration.sql');
const sql = readFileSync(sqlPath, 'utf-8');

// Dividir en statements individuales (por ;) y filtrar vacíos/comentarios
const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

console.log(`📋 ${statements.length} statements a ejecutar\n`);

// Ejecutar via REST API
async function executeSQL(query) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });
    return res;
}

// Ejecutar todo como un solo bloque via la SQL API de Supabase
async function runMigration() {
    try {
        // Supabase expone un endpoint SQL en /pg/
        // Pero la forma más segura es usar el SQL Editor del Studio
        // Intentamos via la API de pg-meta
        const res = await fetch(`${SUPABASE_URL}/pg/query`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'x-connection-encrypted': 'false',
            },
            body: JSON.stringify({ query: sql }),
        });

        if (res.ok) {
            const data = await res.json();
            console.log('✅ Migración ejecutada correctamente!\n');
            console.log('Resultado:', JSON.stringify(data, null, 2));
            return;
        }

        // Si /pg/query no funciona, intentar via postgres-meta
        const res2 = await fetch(`${SUPABASE_URL}/pg-meta/default/query`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: sql }),
        });

        if (res2.ok) {
            const data = await res2.json();
            console.log('✅ Migración ejecutada correctamente!\n');
            console.log('Resultado:', JSON.stringify(data, null, 2));
            return;
        }

        // Si ninguna API funciona, dar instrucciones para ejecutar manualmente
        console.log('⚠️  No se pudo ejecutar via API REST. Opciones:\n');
        console.log('  1. Abrir Studio → SQL Editor → pegar el contenido de migration.sql');
        console.log(`     URL: ${SUPABASE_URL}\n`);
        console.log('  2. Ejecutar via psql:');
        console.log(`     psql 'postgres://postgres:PASSWORD@tu-servidor:5432/postgres' -f scripts/migration.sql\n`);
        console.log(`  Status API: ${res.status} ${res.statusText}`);
        const body = await res.text();
        if (body) console.log(`  Response: ${body.substring(0, 200)}`);

    } catch (error) {
        console.error(`❌ Error de conexión: ${error.message}`);
        console.log('\n  Verificá que la URL sea correcta y el servidor esté corriendo.');
    }
}

runMigration();
