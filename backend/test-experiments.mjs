import fs from 'node:fs';
const env = fs.readFileSync('../.env', 'utf8');
const lines = env.split('\n');
let key = '';
for (const line of lines) {
  if (line.startsWith('VITE_GEMINI_API_KEY=')) {
    key = line.split('=')[1].trim();
  }
}

async function testModel(model) {
  console.log(`\nProbando modelo: ${model}`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: "A cute cartoon robot" }] }],
            generationConfig: { responseModalities: ["IMAGE"] }
        })
    });
    const d = await res.json();
    if (d.error) {
        console.log(`ERROR ${d.error.code}:`, d.error.message.split('\n')[0]);
    } else {
        console.log('✅ ÉXITO! Partes devueltas:', d.candidates?.[0]?.content?.parts?.length);
    }
  } catch(e) { console.error(e); }
}

async function runTests() {
  await testModel('gemini-2.0-flash-exp');
  await testModel('gemini-2.5-flash');
  await testModel('gemini-exp-1206');
}

runTests();
