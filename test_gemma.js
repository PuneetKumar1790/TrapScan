import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const match = env.match(/VITE_GEMMA_API_KEY=(.*)/);
const apiKey = match ? match[1].trim() : null;

const prompt = "Hello";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${apiKey}`;

async function check() {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        
        const data = await response.json();
        console.log("Status:", response.status);
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

check();
