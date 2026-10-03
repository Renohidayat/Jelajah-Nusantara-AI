import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.OPENAGENTIC_API_KEY;

export const aiConfig = {
    apiKey: apiKey,
    baseUrl: process.env.OPENAGENTIC_BASE_URL || "https://openagentic.id/api/v1",
    model: process.env.AI_MODEL || "deepseek-v4.1-flash-free",
    fallbackModels: (process.env.AI_FALLBACK_MODELS || "minimax-m3,big-pickle,mimo-v2.6-flash,space-bunny-free,muse-spark-1.3-free").split(",").map(m => m.trim()).filter(Boolean),
    // Batas satu request non-stream (ekstraksi lokasi).
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || "120000", 10),
    // Stream diputus bila tidak ada data sama sekali selama durasi ini.
    idleTimeoutMs: parseInt(process.env.AI_IDLE_TIMEOUT_MS || "60000", 10),
    // Tenggat total semua percobaan + fallback; harus di bawah maxDuration Vercel (300 dtk).
    deadlineMs: parseInt(process.env.AI_DEADLINE_MS || "280000", 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || "2", 10),
    visionEnabled: process.env.AI_VISION_ENABLED !== "false",
    visionModel: process.env.AI_VISION_MODEL || process.env.AI_MODEL || "deepseek-v4.1-flash-free",
    visionFallbackModels: (process.env.AI_VISION_FALLBACK_MODELS || "").split(",").map(m => m.trim()).filter(Boolean),
    maxImageBytes: parseInt(process.env.AI_MAX_IMAGE_BYTES || "5242880", 10) // default 5MB
};

// Check key at startup
if (!aiConfig.apiKey) {
    console.error("❌ Kritis: OPENAGENTIC_API_KEY tidak diatur di environment. Fitur AI tidak akan berfungsi.");
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

/**
 * Tentukan tindakan untuk error dari OpenAgentic.
 * - "fatal": key/plan bermasalah, hentikan semua percobaan.
 * - "next" : model ini tidak bisa dipakai sekarang, langsung pindah model cadangan.
 * - "retry": gangguan sementara, coba lagi model yang sama setelah jeda.
 */
function classifyAiError(err) {
    const isTimeout = err?.name === 'AbortError' || err?.name === 'TimeoutError' || err?.type === 'aborted';
    if (isTimeout) return { action: "next", status: 408 };
    const status = err?.status || 500;
    const code = err?.code || "";
    if (status === 404 || code === "model_not_available") return { action: "next", status };
    if (status === 401 || status === 402 || status === 403) return { action: "fatal", status };
    if (status === 429 && code === "free_shared_pool_exhausted") return { action: "next", status };
    if (status === 429 || status >= 500) return { action: "retry", status };
    return { action: "next", status };
}

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
    const id = setTimeout(() => controller.abort(), config.attemptTimeoutMs ?? config.timeoutMs);
    const start = Date.now();
    try {
        const payload = {
            model: modelName,
            messages,
            stream: false
        };
        if (config.circuitBreakerHook) {
            const allowed = await config.circuitBreakerHook();
            if (!allowed) {
                throw { status: 503, message: "Maaf, batas maksimum harian penggunaan AI secara global telah tercapai. Silakan coba lagi besok." };
            }
        }
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
            throw { status: errCode, code: data?.error?.code, message: msg };
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
    // Batas keras = sisa tenggat; idle timer di-reset setiap ada data masuk.
    const id = setTimeout(() => controller.abort(), config.attemptTimeoutMs ?? config.deadlineMs);
    let idleId = setTimeout(() => controller.abort(), config.idleTimeoutMs);
    const resetIdle = () => {
        clearTimeout(idleId);
        idleId = setTimeout(() => controller.abort(), config.idleTimeoutMs);
    };
    const start = Date.now();
    try {
        const payload = {
            model: modelName,
            messages,
            stream: true
        };
        if (config.circuitBreakerHook) {
            const allowed = await config.circuitBreakerHook();
            if (!allowed) {
                throw { status: 503, message: "Maaf, batas maksimum harian penggunaan AI secara global telah tercapai. Silakan coba lagi besok." };
            }
        }
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
            throw { status: errCode, code: data?.error?.code, message: msg };
        }
        
        const reader = res.body;
        const decoder = new TextDecoder("utf-8");
        let buffer = '';
        let fullRawText = '';
        let chunkCount = 0;
        
        for await (const chunk of reader) {
            resetIdle();
            const strChunk = decoder.decode(chunk, { stream: true });
            buffer += strChunk;
            fullRawText += strChunk;
            
            const lines = buffer.split('\n');
            buffer = lines.pop(); // last incomplete line
            
            for (const line of lines) {
                const trimmed = line.trim();
                // Handle "data:" or "data: "
                if (trimmed.startsWith('data:')) {
                    const dataStr = trimmed.startsWith('data: ') ? trimmed.substring(6) : trimmed.substring(5);
                    if (dataStr === '[DONE]') continue;
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices?.[0]?.delta?.content;
                        if (content) {
                            onChunk(content);
                            chunkCount++;
                        }
                    } catch (e) {
                        // ignore parse error for incomplete json chunks
                    }
                }
            }
        }
        
        if (chunkCount === 0) {
            // Probably OpenAgentic ignored stream:true or failed silently
            try {
                // If it's plain json
                const data = JSON.parse(fullRawText.trim());
                const content = data.choices?.[0]?.message?.content || 
                                data.choices?.[0]?.delta?.content ||
                                data.response ||
                                data.reply ||
                                data.text ||
                                data.output?.text;
                                
                if (content) {
                    onChunk(content);
                } else if (data.error) {
                    throw { status: 500, message: data.error.message || "OpenAgentic API Error" };
                } else {
                    throw { status: 500, message: "Format respons tidak dikenali: " + fullRawText.substring(0, 100) };
                }
            } catch(e) {
                if (e.status === 500) throw e;
                if (!fullRawText.trim()) throw { status: 500, message: "Response AI kosong dari OpenAgentic" };
                throw { status: 500, message: "Gagal memproses respon OpenAgentic: " + fullRawText.substring(0, 50) };
            }
        }
        
        const duration = Date.now() - start;
        console.log(`✅ AI Stream Success [${modelName}] (Duration: ${duration}ms)`);
        return true;
    } finally {
        clearTimeout(id);
        clearTimeout(idleId);
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
    const deadline = Date.now() + aiConfig.deadlineMs;
    // Setelah ada teks terkirim ke klien, retry akan menduplikasi isi; jadi tidak boleh.
    let emitted = false;
    const emit = (chunk) => { emitted = true; onChunk(chunk); };

    modelLoop: for (const model of models) {
        let attempt = 0;
        while (attempt <= aiConfig.maxRetries) {
            try {
                const remaining = deadline - Date.now();
                if (remaining < 5000) {
                    console.warn("⚠️ Tenggat total AI habis. Berhenti mencoba model lain.");
                    break modelLoop;
                }
                await doFetchStreamCompletion(model, messages, { ...aiConfig, attemptTimeoutMs: remaining }, emit);
                return; // success
            } catch (err) {
                lastError = err;
                if (emitted) {
                    console.error(`❌ Stream [${model}] terputus setelah sebagian teks terkirim:`, err?.message || err?.name || err);
                    throw { status: 502, publicMessage: "Respons AI terputus sebelum selesai. Silakan coba lagi." };
                }
                const { action, status } = classifyAiError(err);
                
                if (action === "fatal") {
                    console.error(`❌ API key bermasalah (HTTP ${status}). Tidak di-retry.`);
                    throw { status, publicMessage: "Kunci API tidak valid atau kedaluwarsa. Hubungi admin." };
                }
                if (action === "next") {
                    console.warn(`⚠️ Model ${model} dilewati (HTTP ${status}${err?.code ? ", " + err.code : ""}). Pindah model cadangan.`);
                    break;
                }
                if (action === "retry") {
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
    
    const busy = lastError?.status === 429;
    throw {
        status: lastError?.status || 500,
        publicMessage: lastError?.publicMessage || (busy
            ? "Layanan AI sedang penuh. Silakan coba lagi dalam beberapa saat."
            : "Gagal membuat itinerary.")
    };
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
    const deadline = Date.now() + aiConfig.deadlineMs;
    let jsonAttempt = 0;
    
    // Retry JSON logic: if we fail parsing JSON, we retry the whole call (only once)
    jsonLoop: while (jsonAttempt < 2) {
        for (const model of models) {
            let attempt = 0;
            while (attempt <= aiConfig.maxRetries) {
                try {
                    const remaining = deadline - Date.now();
                    if (remaining < 5000) {
                        console.warn("⚠️ Tenggat total AI habis. Berhenti mencoba model lain.");
                        break jsonLoop;
                    }
                    const rawText = await doFetchCompletion(model, messages, { ...aiConfig, attemptTimeoutMs: Math.min(aiConfig.timeoutMs, remaining) });
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
                    const { action, status } = classifyAiError(err);
                    
                    if (action === "fatal") {
                        console.error(`❌ API key atau plan bermasalah (HTTP ${status}). Tidak di-retry.`);
                        throw { status, publicMessage: "Kunci API tidak valid atau kedaluwarsa. Hubungi admin." };
                    }
                    if (action === "next") {
                        console.warn(`⚠️ Model ${model} dilewati (HTTP ${status}${err?.code ? ", " + err.code : ""}). Pindah model cadangan.`);
                        break; // Break inner loop to go to next model
                    }
                    if (action === "retry") {
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
