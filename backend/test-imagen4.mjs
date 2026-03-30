import fs from 'node:fs';
const env = fs.readFileSync('../.env', 'utf8');
const lines = env.split('\n');
let key = '';
for (const line of lines) {
  if (line.startsWith('VITE_GEMINI_API_KEY=')) {
    key = line.split('=')[1].trim();
  }
}

const prompt = "A cute cartoon robot";
const model = "imagen-4.0-fast-generate-preview-06-06";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`;

fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" }
    })
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d).substring(0, 200)))
.catch(console.error);
