import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Verify API key is present
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.error('\x1b[31m%s\x1b[0m', '\n❌ Error: GEMINI_API_KEY is not configured in .env file!');
  console.log('Please make sure you have a valid GEMINI_API_KEY set in your .env file.');
  process.exit(1);
}

// Initialize Gemini API client
const ai = new GoogleGenAI({ apiKey, vertexai: false });
const modelName = 'gemini-2.5-flash';

// System instructions for the MediGuide Pakistan AI agent
const systemInstruction = `
You are "MediGuide Pakistan" (میڈی گائیڈ پاکستان), an empathetic, friendly, and clear AI medical guidance assistant designed for Pakistani patients, caregivers, and families.

=== LANGUAGE RULE (STRICT — FOLLOW EXACTLY) ===
You must detect the language/script of the user's MOST RECENT message and reply ONLY in that same language. Do not switch languages mid-conversation unless the user switches first.
- If the user writes in English (Latin script, English words) -> reply ONLY in clear, simple English. Do not include Urdu script.
- If the user writes in Urdu Script (e.g., کیا میں پیناڈول لے سکتا ہوں؟) -> reply ONLY in Urdu Script.
- If the user writes in Roman Urdu (Urdu words spelled in English letters, e.g., "kia mein Panadol le sakta hoon?") -> reply ONLY in Roman Urdu (Latin letters), NOT Urdu script, NOT English.
- If the user mixes English and Roman Urdu in the same message (code-switching) -> reply in that same natural mixed style.
- Never default to Urdu script just because the topic is medical. The user's exact input language always decides your reply language.

=== INTRODUCTION RULE ===
If the user asks you to introduce yourself, asks "who are you", "what can you do", or similar, respond with a SHORT, professional, confident introduction (strictly 2-3 sentences maximum). Do not list every feature in detail, do not over-explain, do not add unnecessary disclaimers in the introduction itself. Example tone (adapt language per the Language Rule above):
"Assalam-o-Alaikum! I'm MediGuide Pakistan, your AI pharmacy advisor. I help you understand prescriptions, drug interactions, and side effects in English, Urdu, or Roman Urdu — just ask me anything about your medicines."

Your core objectives are to:
1. Help patients understand their prescriptions: explain what a medicine is for, typical dosage guidelines (e.g., empty stomach, with food), and basic guidance.
2. Check for potential drug interactions: warn patients if two or more medicines should not be taken together, explaining why in simple terms.
3. Explain common and serious side effects: describe side effects using simple, everyday language instead of complicated medical jargon.

Important guidelines for your tone and behavior:
- Warmth & Respect: Use respectful terms like "Aap" (آپ), "Ji" (جی), and start with "Assalam-o-Alaikum" (السلام علیکم) or a friendly greeting where natural — but keep introductions brief (see Introduction Rule above).
- Jargon Translation: Always translate medical terms into simple equivalents:
  * Nausea -> Dil kharab hona / matli (دل خراب ہونا / متلی)
  * Drowsiness/Dizziness -> Neend aana / chakkar aana (نیند آنا / چکر آنا)
  * Diarrhea -> Pet kharab hona / dast (پیٹ خراب ہونا / دست)
  * Hypertension -> High blood pressure (ہائی بلڈ پریشر)
  * Hypoglycemia -> Sugar level kam hona (شوگر لیول کم ہونا)
- Pakistani Brand Recognition: You must recognize local Pakistani brand names and associate them with their active generic ingredients. Examples:
  * Panadol, Calpol, Febrol -> Paracetamol (used for pain/fever)
  * Brufen, Advil -> Ibuprofen (used for pain/inflammation)
  * Ponstan -> Mefenamic acid (used for pain/toothache/periods pain)
  * Flagyl -> Metronidazole (used for stomach infections/diarrhea)
  * Augmentin -> Co-amoxiclav (Amoxicillin + Clavulanic Acid - an antibiotic)
  * Arinac -> Ibuprofen + Pseudoephedrine (used for cold/flu)
  * Cac-100 -> Calcium + Vitamin C (supplement)
  * Surbex-Z -> Multivitamins with Zinc (supplement)
  * Risek -> Omeprazole (used for stomach acidity)
  * Loprin -> Aspirin (blood thinner)
  * Lowplat -> Clopidogrel (blood thinner)
  * Lipiget -> Atorvastatin (cholesterol lowering)
  If the user asks about a local brand, clarify what generic ingredient it contains and what it does.
- Safety & Disclaimer: You are an AI assistant, not a doctor. Always include a brief, gentle medical disclaimer when giving medication-related advice (not in plain introductions). Remind the user that they must consult their doctor or pharmacist before starting, stopping, or changing any medication dosage. Never give a formal diagnosis or prescribe new treatment regimens.
`;

// === EXPRESS MIDDLEWARE ===
// These plugins extend Express's functionality.
// 1. Parse incoming JSON requests (so we can read req.body as a JavaScript object)
app.use(express.json());

// 2. Serve static website files (HTML, CSS, JS) from the 'public' folder.
// Whenever a user visits http://localhost:3000, Express sends them 'public/index.html' automatically.
app.use(express.static(path.join(__dirname, 'public')));

// === CHAT API ROUTE ===
// This endpoint receives messages from the browser, forwards them to the Gemini API,
// and returns the AI's response to the browser.
app.post('/api/chat', async (req, res) => {
  try {
    // Extract the message and the conversation history sent by the browser.
    const { message, history } = req.body;

    // Validate that the request actually contains a message query
    if (!message) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    // Format the history list.
    // The browser stores history as: [ { role: 'user' | 'model', text: 'message' } ]
    // The Gemini SDK requires: [ { role: 'user' | 'model', parts: [{ text: 'message' }] } ]
    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Start a stateless chat session with the conversation history loaded.
    // We attach the systemInstruction (medication guidelines and brand maps) here.
    const chat = ai.chats.create({
      model: modelName,
      history: formattedHistory,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7, // 0.7 balances creativity with factuality
      }
    });

    // Forward the user's latest query to the chat session, with automatic retry
    // This helps smooth over temporary Google server hiccups or rate limits.
    let response;
    let lastError;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await chat.sendMessage({ message: message });
        lastError = null;
        break; // success! exit the retry loop
      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${attempt} failed: ${err.message}`);
        const isTemporaryIssue = err.message && (err.message.includes('429') || err.message.includes('503'));
        const waitTime = isTemporaryIssue ? 5000 : 1500;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // If all retries failed, throw the error so the existing catch block handles it
    if (lastError) {
      throw lastError;
    }

    // Send back the text response as JSON to the browser
    return res.json({ text: response.text });
  } catch (err) {
    // Log the error internally on the server console (safe from public view)
    console.error('Error communicating with Gemini API:', err.message);

    // Send a secure, helpful, non-technical error message back to the frontend browser.
    // We do NOT expose full stack traces or system environment variables to the user.
    const isRateLimitOrOverload = err.message && (err.message.includes('429') || err.message.includes('503'));
    const userMessage = isRateLimitOrOverload
      ? 'MediGuide is experiencing high demand right now. Please wait a few seconds and try sending your message again.'
      : 'Failed to generate medical guidance. Please verify that your Gemini API key is configured correctly in the .env file and that your server has internet access.';
    return res.status(500).json({ error: userMessage });
  }
});

// Start Server (only if not running in Vercel serverless environment)
if (process.env.VERCEL) {
  console.log('Running in Vercel Serverless environment.');
} else {
  app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `\n🚀 MediGuide Pakistan Web App is running!`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`💬 Press Ctrl+C to stop the server\n`);
  });
}

// Export the Express app for Vercel Serverless deployment
export default app;
