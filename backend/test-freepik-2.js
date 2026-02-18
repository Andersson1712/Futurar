
const API_KEY = process.env.VITE_FREEPIK_API_KEY || process.env.FREEPIK_API_KEY || 'FPSX2dc59da16fe9aec7bc81499c9a0e0871';

console.log('🔑 Using API Key:', API_KEY ? `${API_KEY.substring(0, 5)}...` : 'NONE');

async function testFreepik() {
    console.log('🧪 Testing Freepik API (Round 2)...');

    // Try different endpoint structures based on 404
    const tests = [
        {
            name: 'Flux Dev (Corrected Endpoint?)',
            url: 'https://api.freepik.com/v1/ai/text-to-image', // Generic endpoint?
            body: {
                prompt: "A futuristic city",
                model: "flux-realism" // Try passing model in body
            }
        },
        {
            name: 'Flux Dev Specific',
            url: 'https://api.freepik.com/v1/ai/text-to-image',
            body: {
                prompt: "A futuristic city",
                // No model, see default
            }
        },
        // Checking for "image-generation" instead of "text-to-image"?
    ];

    try {
        console.log('\n--- Test A: Standard Endpoint with Model in URL (flux-realism) ---');
        // We know this failed, but let's try the *correct* model name found in docs "flux-dev"
        const url = `https://api.freepik.com/v1/ai/text-to-image/flux-dev`;
        console.log(`URL: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'x-freepik-api-key': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: "A futuristic city",
            })
        });
        const text = await response.text();
        console.log(`Result: ${response.status} - ${text.substring(0, 100)}`);
    } catch (e) { console.error(e.message); }

}

testFreepik();
