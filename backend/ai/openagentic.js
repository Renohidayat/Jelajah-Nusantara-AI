import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.OPENAGENTIC_API_KEY || process.env.GEMINI_API_KEY;
const isGemini = !process.env.OPENAGENTIC_API_KEY && !!process.env.GEMINI_API_KEY;

export const aiConfig = {
    apiKey: apiKey,
    baseUrl: isGemini ? "https://generativelanguage.googleapis.com/v1beta/openai" : (process.env.OPENAGENTIC_BASE_URL || "https://openagentic.id/api/v1"),
    model: isGemini ? "gemini-1.5-flash" : (process.env.AI_MODEL || "deepseek-v4.1-flash-free"),
    fallbackModels: (process.env.AI_FALLBACK_MODELS || "big-pickle,mimo-v2.6-flash,muse-spark-1.3-free,space-bunny-free").split(",").map(m => m.trim()).filter(Boolean),
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || "60000", 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || "2", 10),
    visionEnabled: process.env.AI_VISION_ENABLED !== "false",
    visionModel: isGemini ? "gemini-1.5-flash" : (process.env.AI_VISION_MODEL || process.env.AI_MODEL || "deepseek-v4.1-flash-free"),
    visionFallbackModels: (process.env.AI_VISION_FALLBACK_MODELS || "").split(",").map(m => m.trim()).filter(Boolean),
    maxImageBytes: parseInt(process.env.AI_MAX_IMAGE_BYTES || "5242880", 10) // default 5MB
};

// Check key at startup
if (!aiConfig.apiKey) {
    console.error("❌ Kritis: OPENAGENTIC_API_KEY atau GEMINI_API_KEY tidak diatur di environment.");
    // Don't process.exit on serverless environments
}

// Optional async check models without blocking
export async function checkModelsOnStartup() {
    try {
        const res = await fetch(`${aiConfig.baseUrl}/models`, {
            headers: { Authorization: `Bearer ${aiConfig.apiKey}` }
        });
        if (res.ok) {
            const data = await res.json();
            const models = data.data.map(m => m.id);
            if (!models.includes(aiConfig.model)) {
                console.warn(`⚠️ Model default '${aiConfig.model}' tidak ditemukan di server OpenAgentic.`);
            }
        }
    } catch (err) {
        console.warn(`⚠️ Gagal memverifikasi daftar model OpenAgentic: ${err.message}`);
    }
}
checkModelsOnStartup();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseJsonResult(text) {
    let clean = text.trim();
    // Buang pagar ```json
    if (clean.startsWith("```json")) {
        clean = clean.replace(/^```json/, "");
    } else if (clean.startsWith("```")) {
        clean = clean.replace(/^```/, "");
    }
    if (clean.endsWith("```")) {
        clean = clean.substring(0, clean.length - 3);
    }
    
    // Ambil dari "{" pertama sampai "}" terakhir
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }
    
    return JSON.parse(clean.trim());
}

async function doFetchCompletion(modelName, messages, config) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), config.timeoutMs);
    const start = Date.now();
    try {
        const payload = {
            model: modelName,
            messages,
            stream: false
        };
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        const duration = Date.now() - start;
        const data = await res.json().catch(() => null);
        
        if (!res.ok) {
            const errCode = res.status;
            const msg = data?.error?.message || "Unknown error";
            console.warn(`⚠️ AI HTTP ${errCode} [${modelName}] (${duration}ms): ${msg}`);
            throw { status: errCode, message: msg };
        }
        
        const content = data?.choices?.[0]?.message?.content;
        const usage = data?.usage?.total_tokens || 0;
        const reqId = data?.id || "unknown";
        
        console.log(`✅ AI Success [${modelName}] (ReqID: ${reqId}, Duration: ${duration}ms, Tokens: ${usage})`);
        return content;
    } finally {
        clearTimeout(id);
    }
}

async function doFetchStreamCompletion(modelName, messages, config, onChunk) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), config.timeoutMs);
    const start = Date.now();
    try {
        const payload = {
            model: modelName,
            messages,
            stream: true
        };
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        if (!res.ok) {
            const duration = Date.now() - start;
            const data = await res.json().catch(() => null);
            const errCode = res.status;
            const msg = data?.error?.message || "Unknown error";
            console.warn(`⚠️ AI HTTP ${errCode} [${modelName}] (${duration}ms): ${msg}`);
            throw { status: errCode, message: msg };
        }
        
        const reader = res.body;
        const decoder = new TextDecoder("utf-8");
        let buffer = '';
        for await (const chunk of reader) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // last incomplete line
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                    const dataStr = trimmed.substring(6);
                    if (dataStr === '[DONE]') continue;
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices?.[0]?.delta?.content;
                        if (content) onChunk(content);
                    } catch (e) {
                        // ignore parse error for incomplete json chunks
                    }
                }
            }
        }
        
        const duration = Date.now() - start;
        console.log(`✅ AI Stream Success [${modelName}] (Duration: ${duration}ms)`);
        return true;
    } finally {
        clearTimeout(id);
    }
}

export async function generateContentStream(systemPrompt, userPrompt, isVision = false, imageBase64 = null, imageMime = null, onChunk) {
    if (isVision && !aiConfig.visionEnabled) {
        throw { status: 503, publicMessage: "Fitur analisis gambar sedang dinonaktifkan." };
    }
    if (isVision && imageBase64) {
        const sizeBytes = Buffer.from(imageBase64, 'base64').length;
        if (sizeBytes > aiConfig.maxImageBytes) {
            throw { status: 400, publicMessage: `Ukuran gambar terlalu besar. Maksimal ${Math.round(aiConfig.maxImageBytes/1024/1024)} MB.` };
        }
    }

    const messages = [
        { role: "system", content: systemPrompt }
    ];

    if (isVision && imageBase64) {
        messages.push({
            role: "user",
            content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageBase64}` } }
            ]
        });
    } else {
        messages.push({ role: "user", content: userPrompt });
    }

    const models = isVision 
        ? [aiConfig.visionModel, ...aiConfig.visionFallbackModels] 
        : [aiConfig.model, ...aiConfig.fallbackModels];
    let lastError = null;

    for (const model of models) {
        let attempt = 0;
        while (attempt <= aiConfig.maxRetries) {
            try {
                await doFetchStreamCompletion(model, messages, aiConfig, onChunk);
                return; // success
            } catch (err) {
                lastError = err;
                const isTimeout = err.name === 'AbortError' || err.type === 'aborted';
                const status = err.status || (isTimeout ? 408 : 500);
                
                if (status === 401 || status === 402 || status === 403) {
                    console.error(`❌ API key bermasalah (HTTP ${status}). Tidak di-retry.`);
                    throw { status, publicMessage: "Kunci API tidak valid atau kedaluwarsa. Hubungi admin." };
                }
                if (status === 404) {
                    console.warn(`⚠️ Model ${model} tidak tersedia. Pindah model cadangan.`);
                    break;
                }
                if (status === 429 || status >= 500 || isTimeout) {
                    attempt++;
                    if (attempt <= aiConfig.maxRetries) {
                        const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
                        console.warn(`⚠️ Stream Retry ${attempt}/${aiConfig.maxRetries} setelah ${delayMs}ms...`);
                        await sleep(delayMs);
                    }
                } else {
                    break;
                }
            }
        }
    }
    
    throw { status: lastError?.status || 500, publicMessage: lastError?.publicMessage || "Gagal membuat itinerary." };
}

export async function generateContent(systemPrompt, userPrompt, isVision = false, imageBase64 = null, imageMime = null) {
    if (isVision && !aiConfig.visionEnabled) {
        throw { status: 503, publicMessage: "Fitur analisis gambar sedang dinonaktifkan." };
    }
    if (isVision && imageBase64) {
        const sizeBytes = Buffer.from(imageBase64, 'base64').length;
        if (sizeBytes > aiConfig.maxImageBytes) {
            throw { status: 400, publicMessage: `Ukuran gambar terlalu besar. Maksimal ${Math.round(aiConfig.maxImageBytes/1024/1024)} MB.` };
        }
    }

    const messages = [
        { role: "system", content: systemPrompt }
    ];

    if (isVision && imageBase64) {
        messages.push({
            role: "user",
            content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageBase64}` } }
            ]
        });
    } else {
        messages.push({ role: "user", content: userPrompt });
    }

    const models = isVision 
        ? [aiConfig.visionModel, ...aiConfig.visionFallbackModels] 
        : [aiConfig.model, ...aiConfig.fallbackModels];
    
    let lastError = null;
    let jsonAttempt = 0;
    
    // Retry JSON logic: if we fail parsing JSON, we retry the whole call (only once)
    while (jsonAttempt < 2) {
        for (const model of models) {
            let attempt = 0;
            while (attempt <= aiConfig.maxRetries) {
                try {
                    const rawText = await doFetchCompletion(model, messages, aiConfig);
                    try {
                        return parseJsonResult(rawText); // success!
                    } catch (err) {
                        console.warn(`⚠️ AI Parser error (attempt ${jsonAttempt+1}):`, err.message);
                        lastError = { status: 502, publicMessage: "Respon AI tidak dapat diproses (JSON invalid)." };
                        break; // break retry loop to retry whole call if jsonAttempt < 2
                    }
                } catch (err) {
                    lastError = err;
                    // Check if error is abort/timeout
                    const isTimeout = err.name === 'AbortError' || err.type === 'aborted';
                    const status = err.status || (isTimeout ? 408 : 500);
                    
                    if (status === 401 || status === 402 || status === 403) {
                        console.error(`❌ API key atau plan bermasalah (HTTP ${status}). Tidak di-retry.`);
                        throw { status, publicMessage: "Kunci API tidak valid atau kedaluwarsa. Hubungi admin." };
                    }
                    if (status === 404) {
                        console.warn(`⚠️ Model ${model} tidak tersedia (HTTP 404). Pindah model cadangan.`);
                        break; // Break inner loop to go to next model
                    }
                    if (status === 429 || status >= 500 || isTimeout) {
                        attempt++;
                        if (attempt <= aiConfig.maxRetries) {
                            const delayMs = Math.min(1000 * 2 ** (attempt - 1) + Math.random() * 500, 8000);
                            console.warn(`⚠️ Retry ${attempt}/${aiConfig.maxRetries} setelah ${Math.round(delayMs)}ms...`);
                            await sleep(delayMs);
                        }
                    } else {
                        // Unhandled error
                        break;
                    }
                }
            }
            if (lastError && lastError.status === 502) break; // Break model loop, let outer JSON loop continue
        }
        
        jsonAttempt++;
        if (lastError && lastError.status !== 502) {
            // It failed due to API errors, not JSON parse, so no need to retry JSON parsing again
            break;
        }
    }
    
    // If we get here, all attempts exhausted
    console.error("❌ All AI generation attempts failed:", lastError);
    if (lastError?.status === 502) {
        throw { status: 502, publicMessage: lastError.publicMessage };
    }
    if (lastError?.status === 429) {
        throw { status: 429, publicMessage: "Terlalu banyak permintaan ke AI. Silakan coba lagi." };
    }
    throw { status: 503, publicMessage: "Layanan AI sedang sibuk atau mengalami gangguan jaringan. Silakan coba lagi." };
}
