
const API_KEY = process.env.VITE_FREEPIK_API_KEY || process.env.FREEPIK_API_KEY || 'FPSX2dc59da16fe9aec7bc81499c9a0e0871';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPolling() {
    console.log('🧪 Testing Freepik Polling Logic...');

    // 1. Start Task
    try {
        const url = 'https://api.freepik.com/v1/ai/text-to-image/flux-dev';
        console.log(`Step 1: POST ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'x-freepik-api-key': API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: "A cute robot reading a book, pixel art style",
            })
        });

        const data = await response.json();
        console.log('Step 1 Response:', JSON.stringify(data));

        if (!data.id) {
            console.error('❌ No Task ID returned!');
            return;
        }

        const taskId = data.id;
        console.log(`\n🆔 Task ID: ${taskId}`);

        // 2. Poll for Result
        for (let i = 0; i < 20; i++) {
            process.stdout.write(`.`);
            await delay(2000);

            const statusUrl = `https://api.freepik.com/v1/ai/text-to-image/${taskId}`;
            const statusRes = await fetch(statusUrl, {
                headers: {
                    'x-freepik-api-key': API_KEY,
                    'Accept': 'application/json'
                }
            });

            if (!statusRes.ok) {
                console.log(`\nPoll status: ${statusRes.status}`);
                continue;
            }

            const statusData = await statusRes.json();
            // console.log('\nPoll Data:', JSON.stringify(statusData).substring(0, 100));

            if (statusData.status === 'COMPLETED') {
                console.log('\n✅ Status COMPLETED!');
                console.log('Full Data:', JSON.stringify(statusData, null, 2));
                return;
            } else if (statusData.status === 'FAILED') {
                console.log('\n❌ Status FAILED');
                return;
            }
        }
        console.log('\n⏰ Timeout waiting for result');

    } catch (e) {
        console.error('\n❌ Exception:', e);
    }
}

testPolling();
