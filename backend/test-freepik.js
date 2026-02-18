
// Simple script to test Freepik API
// Run with: node test-freepik.js
// Make sure to set your key below or in environment

const API_KEY = process.env.VITE_FREEPIK_API_KEY || process.env.FREEPIK_API_KEY || 'TU_API_KEY_AQUI';

console.log('🔑 Using API Key:', API_KEY ? `${API_KEY.substring(0, 5)}...` : 'NONE');

// Use native fetch (Node 18+)
async function testFreepik() {
    console.log('🧪 Testing Freepik API...');

    const endpoints = [
        { name: 'Flux Realism', model: 'flux-realism' },
        { name: 'Mystic', model: 'mystic' },
        { name: 'Classic Fast', model: 'classic-fast' }
    ];

    for (const { name, model } of endpoints) {
        try {
            console.log(`\n--- Testing ${name} (${model}) ---`);
            const url = `https://api.freepik.com/v1/ai/text-to-image/${model}`;
            console.log(`URL: ${url}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-freepik-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    prompt: "A futuristic city with flying cars, cinematic lighting, photorealistic",
                    aspect_ratio: "square",
                    num_images: 1
                })
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`❌ Error: ${response.status} - ${text}`);
            } else {
                const data = await response.json();
                console.log('✅ Success!');
                // console.log(JSON.stringify(data).substring(0, 200) + '...');
                const img = data.data?.[0] || data[0];
                if (img) console.log('Image URL/Base64 found.');
            }
        } catch (e) {
            console.error(`❌ Exception: ${e.message}`);
        }
    }
}

if (API_KEY === 'TU_API_KEY_AQUI') {
    console.error('❌ Please edit this file to add your API Key or set FREEPIK_API_KEY env var');
} else {
    testFreepik();
}
