import fs from 'node:fs';
const env = fs.readFileSync('../.env', 'utf8');
const lines = env.split('\n');
let key = '';
for (const line of lines) {
  if (line.startsWith('VITE_GEMINI_API_KEY=')) {
    key = line.split('=')[1].trim();
  }
}

fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key)
  .then(r => r.json())
  .then(d => {
    if (!d.models) { console.log(d); return; }
    const imgModels = d.models.filter(m => m.name.includes('ima') || m.name.includes('flash'));
    console.log(JSON.stringify(imgModels.map(m => m.name), null, 2));
  })
  .catch(console.error);
