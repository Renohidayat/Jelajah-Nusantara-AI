import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Just basic HTTP requests to our local server
const BASE_URL = "http://localhost:8080";

async function runSmokeTests() {
    console.log("Starting smoke tests...");

    // Test 1: Check if /api/generate works
    console.log("\\n1. Testing /api/generate");
    const genRes = await fetch(`${BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            origin: "Jakarta",
            destination: "Bali",
            duration: 1,
            budget: "Mid-range",
            style: "Santai"
        })
    });
    const genData = await genRes.json();
    console.log("Status:", genRes.status);
    console.log("Has itineraryText:", !!genData.itineraryText);
    console.log("Has budgetBreakdown:", !!genData.budgetBreakdown);
    if (genData.itineraryText && genData.itineraryText.includes("reasoning_content")) {
        console.error("FAIL: reasoning_content leaked!");
    } else {
        console.log("PASS: No reasoning_content leaked.");
    }
}

runSmokeTests().catch(console.error);
