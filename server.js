/**
 * ============================================================================
 * MediGuide Pakistan — Backend Server (server.js)
 * ============================================================================
 * 
 * PURPOSE:
 * This is the backend "brain" of the application. It runs on Node.js using
 * the Express.js framework, and has two main jobs:
 *   1. Serve the frontend website files (HTML, CSS, JS) to the user's browser.
 *   2. Receive chat messages from the browser, forward them securely to 
 *      Google's Gemini AI model, and send the AI's response back.
 * 
 * WHY A BACKEND IS NEEDED AT ALL:
 * The Gemini API key is a secret credential. If we called Gemini directly 
 * from the browser (frontend JavaScript), anyone could open the browser's 
 * developer tools and steal the key. Instead, the key lives ONLY on this 
 * server (loaded from a hidden .env file / Vercel environment variable),
 * and the browser only ever talks to OUR server, never to Google directly.
 * 
 * DEPLOYMENT NOTE:
 * This file is designed to run in two environments:
 *   - LOCALLY on a developer's laptop (via `node server.js`), where it 
 *     starts a traditional always-on web server listening on a port.
 *   - On VERCEL as a serverless function, where Vercel automatically calls
 *     this file per-request instead of keeping a server running 24/7.
 * The code below detects which environment it's in and behaves accordingly
 * (see the bottom of this file).
 * ============================================================================
 */

import 'dotenv/config'; // Loads variables from a local .env file into process.env (only matters locally; Vercel injects its own env vars directly)
import express from 'express'; // Web framework: handles HTTP requests/responses, routing, etc.
import path from 'path'; // Node's built-in utility for working with file/folder paths
import { fileURLToPath } from 'url'; // Helper to convert ES Module file URLs into normal file paths
import { GoogleGenAI } from '@google/genai'; // Official Google SDK for talking to the Gemini AI API

// --- Path Setup ---
// Since this project uses ES Modules (import/export syntax) instead of older 
// CommonJS (require), there's no built-in "__dirname" variable like older 
// Node.js code uses. These two lines manually recreate it so we can reliably
// locate the 'public' folder regardless of where the server is run from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- App & Port Setup ---
const app = express(); // Create the Express application instance
const PORT = process.env.PORT || 3000; // Use Vercel's assigned port if available, otherwise default to 3000 for local development

// --- API Key Validation (Fail Fast) ---
// We check for the API key immediately on startup, rather than waiting until
// a user sends a chat message. This way, if the key is missing or still set
// to the placeholder value, we get a clear error message in the server logs
// right away instead of a confusing failure later during a real chat request.
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.error('\x1b[31m%s\x1b[0m', '\n❌ Error: GEMINI_API_KEY is not configured in .env file!');
  console.log('Please make sure you have a valid GEMINI_API_KEY set in your .env file.');
  process.exit(1); // Stop the server entirely — there's no point running without a working key
}

// --- Initialize the Gemini AI Client ---
// `vertexai: false` explicitly tells the SDK to use simple API-key authentication
// (the free, personal-use method) rather than Google Cloud's enterprise 
// "Vertex AI" authentication (which requires OAuth/service accounts). Without
// this flag, the SDK can sometimes auto-detect the wrong auth mode depending 
// on the local environment, causing confusing 401 authentication errors.
const ai = new GoogleGenAI({ apiKey, vertexai: false });

// The specific Gemini model version used for all chat responses.
const modelName = 'gemini-2.5-flash';

/**
 * --- AI SYSTEM INSTRUCTION (the "personality" and rules of the AI) ---
 * This large text block is sent to Gemini alongside every conversation. It
 * defines who the AI should act as, what it should and shouldn't do, and 
 * critical safety/behavior rules. Think of this as the AI's job description.
 * 
 * Key design decisions baked into these instructions:
 *   - STRICT language matching: the AI must reply in whatever language/script
 *     the user just used (English, Urdu script, or Roman Urdu) — this 
 *     prevents the AI from randomly switching languages mid-conversation.
 *   - Short, professional introductions: prevents the AI from giving overly
 *     long or unusual self-introductions when asked "who are you?"
 *   - Pakistani brand name mapping: since patients in Pakistan refer to 
 *     medicines by local brand names (e.g. "Panadol") rather than generic 
 *     names (e.g. "Paracetamol"), we explicitly teach the AI these mappings 
 *     so it gives accurate, locally-relevant answers.
 *   - Mandatory safety disclaimer: legally and ethically important — the AI
 *     must always remind users it is not a replacement for a real doctor.
 */
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

// ============================================================================
// EXPRESS MIDDLEWARE
// "Middleware" are functions that process every incoming request before it
// reaches our actual route handlers below. Order matters here.
// ============================================================================

// 1. Parses incoming requests with JSON bodies (e.g. the chat message sent 
//    from the browser) and makes the data available as a JavaScript object 
//    at req.body. Without this, req.body would be undefined.
app.use(express.json());

// 2. Serves all static files (index.html, style.css, script.js, images, etc.)
//    directly from the 'public' folder. This means when a browser requests 
//    "/" or "/style.css", Express automatically finds and returns the 
//    matching file from that folder — no manual routing code needed for them.
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// CHAT API ROUTE — the core feature of this application
// Handles: POST requests to /api/chat
// Receives: { message: string, history: array of past messages }
// Returns:  { text: "AI's response" }  OR  { error: "user-friendly message" }
// ============================================================================
app.post('/api/chat', async (req, res) => {
  try {
    // Pull the user's new message and their prior conversation history out 
    // of the request body sent by the frontend.
    const { message, history } = req.body;

    // Basic input validation: reject empty requests early with a clear error,
    // rather than letting an empty message reach the AI model.
    if (!message) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    // The frontend stores conversation history in a simple format:
    //   [ { role: 'user' | 'model', text: '...' } ]
    // But the Gemini SDK requires a more specific structure:
    //   [ { role: 'user' | 'model', parts: [{ text: '...' }] } ]
    // This line converts between the two formats.
    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Create a new chat session object for this single request. We pass in:
    //   - the model name to use
    //   - the user's full prior conversation history (so the AI has context 
    //     and remembers what was discussed earlier in the conversation)
    //   - our systemInstruction (the AI's behavior rules defined above)
    //   - temperature: controls how "creative" vs "predictable" the AI's 
    //     wording is. 0.7 is a balanced middle ground — factual enough for 
    //     medical accuracy, but not robotic/repetitive in phrasing.
    const chat = ai.chats.create({
      model: modelName,
      history: formattedHistory,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    // --- RETRY LOGIC ---
    // Google's free-tier Gemini API can occasionally return temporary errors:
    //   - HTTP 429 "Too Many Requests": the free quota's rate limit was 
    //     briefly exceeded (too many requests in a short window).
    //   - HTTP 503 "Service Unavailable": Google's servers are temporarily 
    //     overloaded by global traffic — unrelated to our account or code.
    // Both are short-lived issues that typically resolve within seconds. 
    // Rather than immediately failing and showing the user a scary error, 
    // we automatically retry the request up to 3 times, waiting longer 
    // between attempts specifically when we detect a 429/503 (since those 
    // need more recovery time than a generic one-off network hiccup).
    let response;
    let lastError;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await chat.sendMessage({ message: message });
        lastError = null;
        break; // Success — exit the retry loop immediately, no need to try again
      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${attempt} failed: ${err.message}`);

        // Detect if this specific failure is a temporary rate-limit/overload 
        // issue (429/503) versus some other, more serious error.
        const isTemporaryIssue = err.message && (err.message.includes('429') || err.message.includes('503'));
        // Wait longer (5 seconds) for temporary issues to give Google's 
        // servers time to recover; shorter (1.5 seconds) for other errors.
        const waitTime = isTemporaryIssue ? 5000 : 1500;

        // Don't wait after the final attempt — there's no point delaying 
        // before giving up for good.
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // If every retry attempt failed, throw the last error so it's caught
    // by the outer try/catch block below, which builds the final user-facing
    // error response.
    if (lastError) {
      throw lastError;
    }

    // Success path: send the AI's generated text back to the browser as JSON.
    return res.json({ text: response.text });

  } catch (err) {
    // This outer catch block handles BOTH: (a) any error thrown above after
    // retries were exhausted, and (b) any other unexpected error in this 
    // route (e.g. malformed request, network issue, etc.)

    // Log the FULL technical error message to the server's own console only.
    // This is safe because server logs are private — only we (the developers)
    // can see them via Vercel's dashboard. We deliberately do NOT send this 
    // raw technical detail to the browser, to avoid exposing internal system 
    // information to end users.
    console.error('Error communicating with Gemini API:', err.message);

    // Decide which user-facing message to show, based on whether this was a
    // temporary high-demand issue (429/503) or a more serious configuration 
    // problem (e.g. invalid API key, no internet access).
    const isRateLimitOrOverload = err.message && (err.message.includes('429') || err.message.includes('503'));
    const userMessage = isRateLimitOrOverload
      ? 'MediGuide is experiencing high demand right now. Please wait a few seconds and try sending your message again.'
      : 'Failed to generate medical guidance. Please verify that your Gemini API key is configured correctly in the .env file and that your server has internet access.';

    // Send a clean, non-technical error message back to the browser, along 
    // with HTTP status 500 (Internal Server Error) to signal something went 
    // wrong on our end (not the user's fault).
    return res.status(500).json({ error: userMessage });
  }
});

// ============================================================================
// SERVER STARTUP
// This logic branches based on the deployment environment:
//   - On VERCEL: Vercel automatically wraps this exported 'app' as a 
//     serverless function and calls it per-request. We must NOT call 
//     app.listen() here, because Vercel manages the actual server/port 
//     internally — calling app.listen() in this environment would either 
//     do nothing useful or cause errors.
//   - LOCALLY (on a developer's laptop): there's no Vercel wrapping this 
//     file, so we need to manually start a traditional web server using 
//     app.listen(), so it can be tested at http://localhost:3000.
// The `process.env.VERCEL` environment variable is automatically set to 
// 'true' by Vercel's platform itself when running in their environment, 
// which is how we detect which branch to take.
// ============================================================================
if (process.env.VERCEL) {
  console.log('Running in Vercel Serverless environment.');
} else {
  app.listen(PORT, () => {
    console.log('\x1b[32m%s\x1b[0m', `\n🚀 MediGuide Pakistan Web App is running!`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`💬 Press Ctrl+C to stop the server\n`);
  });
}

// Export the configured Express app so Vercel's serverless platform can 
// import and use it directly (instead of us starting a traditional server).
export default app;
