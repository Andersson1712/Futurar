import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['components', 'contexts', 'hooks'];
const IMPORT_PATTERN =
  /import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*['"][^'"]*services\/supabase['"]/;

const ALLOWED = new Set([
  'components/SettingsPanel.tsx',
  'components/StoryDetails.tsx',
  'components/StoryReader.tsx',
  'components/StudentApp.tsx',
  'components/StudentEditor.tsx',
  'components/StudentLibrary.tsx',
  'components/TeacherPanel.tsx',
  'contexts/AuthContext.tsx',
  'contexts/StudentContext.tsx',
]);

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

const offenders = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const relativePath = relative(ROOT, file);

    if (ALLOWED.has(relativePath)) continue;
    if (IMPORT_PATTERN.test(readFileSync(file, 'utf8'))) {
      offenders.push(relativePath);
    }
  }
}

if (offenders.length > 0) {
  console.error(
    'Direct Supabase client imports are not allowed outside services/ (SPEC-010):',
  );
  for (const file of offenders) console.error(`  - ${file}`);
  process.exit(1);
}

console.log('check:supabase OK');
