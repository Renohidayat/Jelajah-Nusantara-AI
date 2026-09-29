import assert from 'assert';
import { generateContent } from '../ai/openagentic.js';

let fetchMock;
global.fetch = async (url, options) => fetchMock(url, options);

let passed = 0;
let failed = 0;

async function runTest(name, mockSetup, testFn) {
    try {
        fetchMock = mockSetup;
        await testFn();
        console.log(`✅ LULUS: ${name}`);
        passed++;
    } catch (e) {
        console.error(`❌ GAGAL: ${name}`);
        console.error(e);
        failed++;
    }
}

async function main() {
    process.env.OPENAGENTIC_API_KEY = "sk-test-key";
    
    // 1. Sukses murni
    await runTest("Sukses JSON murni", 
        async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"tripData":{}}' } }] }) }),
        async () => {
            const res = await generateContent("sys", "user");
            assert.deepStrictEqual(res, {tripData:{}});
        }
    );

    // 2. Pagar markdown
    await runTest("Menghapus pagar ```json", 
        async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] }) }),
        async () => {
            const res = await generateContent("sys", "user");
            assert.deepStrictEqual(res, {a:1});
        }
    );

    // 3. stream: false (reasoning_content tidak muncul di konten)
    await runTest("reasoning_content diabaikan (tidak bocor)", 
        async (url, opts) => {
            const body = JSON.parse(opts.body);
            assert.strictEqual(body.stream, false);
            return { ok: true, json: async () => ({ choices: [{ message: { content: '{"b":2}', reasoning_content: 'hmm' } }] }) };
        },
        async () => {
            const res = await generateContent("sys", "user");
            assert.deepStrictEqual(res, {b:2});
        }
    );

    // 4. 401 Unauthorized
    await runTest("Error 401", 
        async () => ({ ok: false, status: 401, json: async () => ({ error: "Auth failed" }) }),
        async () => {
            await assert.rejects(generateContent("a","b"), (err) => err.status === 401);
        }
    );

    // 5. 403 Forbidden
    await runTest("Error 403", 
        async () => ({ ok: false, status: 403, json: async () => ({ error: "Model not found" }) }),
        async () => {
            await assert.rejects(generateContent("a","b"), (err) => err.status === 403);
        }
    );

    // 6. 429 Terlalu banyak permintaan
    await runTest("Error 429", 
        async () => ({ ok: false, status: 429, json: async () => ({ error: "Rate limit" }) }),
        async () => {
            await assert.rejects(generateContent("a","b"), (err) => err.status === 429);
        }
    );

    // 7. 503 Layanan Sibuk
    await runTest("Error 503", 
        async () => ({ ok: false, status: 503, json: async () => ({ error: "Busy" }) }),
        async () => {
            await assert.rejects(generateContent("a","b"), (err) => err.status === 503);
        }
    );

    // 8. 5xx Server Error
    await runTest("Error 500", 
        async () => ({ ok: false, status: 500, json: async () => ({ error: "Server Error" }) }),
        async () => {
            await assert.rejects(generateContent("a","b"), (err) => err.status === 503); // openagentic.js throws 503 for all 5xx
        }
    );

    // 9. JSON invalid
    await runTest("JSON invalid fallback", 
        async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'invalid json' } }] }) }),
        async () => {
            await assert.rejects(generateContent("a","b"), (err) => err.status === 502);
        }
    );

    // 10. Vision
    await runTest("Sukses Vision", 
        async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"img":true}' } }] }) }),
        async () => {
            const res = await generateContent("sys", "user", true, "base64a", "image/jpeg");
            assert.deepStrictEqual(res, {img:true});
        }
    );
    
    // 11. Key tidak tercetak di error
    await runTest("Key tidak bocor di pesan error", 
        async () => { throw new Error("Connection failed on https://openagentic.id/api/v1 with key sk-test-key"); },
        async () => {
            try {
                await generateContent("sys", "user");
            } catch (e) {
                assert.strictEqual((e.publicMessage || e.message || "").includes("sk-test-key"), false);
            }
        }
    );

    console.log(`\nHASIL: ${passed} LULUS, ${failed} GAGAL`);
}

main();
