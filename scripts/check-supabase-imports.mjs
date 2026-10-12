import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['components', 'contexts', 'hooks'];
const IMPORT_PATTERN =
  /import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*['"][^'"]*services\/supabase['"]/;
const DATA_CALL_PATTERNS = [/\.from\(\s*['"]/, /\.rpc\(/];

const ALLOWED = new Set(['contexts/AuthContext.tsx']);

function walk(dir) {
  const files = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...walk(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

const importOffenders = [];
const dataCallOffenders = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const relativePath = relative(ROOT, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');

    if (!ALLOWED.has(relativePath) && IMPORT_PATTERN.test(source)) {
      importOffenders.push(relativePath);
    }

    if (DATA_CALL_PATTERNS.some((pattern) => pattern.test(source))) {
      dataCallOffenders.push(relativePath);
    }
  }
}

if (importOffenders.length > 0) {
  console.error(
    'Direct Supabase client imports are not allowed outside services/ (SPEC-010):',
  );
  for (const file of importOffenders) console.error(`  - ${file}`);
}

if (dataCallOffenders.length > 0) {
  console.error(
    'Direct Supabase data calls are not allowed; use the backend API instead (SPEC-034):',
  );
  for (const file of dataCallOffenders) console.error(`  - ${file}`);
}

if (importOffenders.length > 0 || dataCallOffenders.length > 0) {
  process.exit(1);
}

console.log('check:supabase OK');
