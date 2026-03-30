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
const model = "gemini-2.5-flash-image"; // El supuesto modelo "Nano Banana"
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] }
    })
})
.then(r => r.json())
.then(d => {
    if (d.error) console.log('ERROR:', JSON.stringify(d.error));
    else console.log('ÉXITO. Candidatos:', d.candidates?.length);
})
.catch(console.error);
