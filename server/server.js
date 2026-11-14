/**
 * SmartCook Express Server
 *
 * A tiny API proxy that:
 *  1. Loads the Groq API key from .env (never sent to the browser)
 *  2. Exposes POST /api/ask for AI cooking questions via Groq
 *  3. Returns a health-check at GET /api/health
 *  4. Has simple rate limiting, a 10-second timeout, and retry logic
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());            // Allow requests from the Vite dev server
app.use(express.json());    // Parse JSON request bodies

// --- Groq setup ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_INSTRUCTION =
  'You are a concise cooking assistant. Answer in 1-3 short, simple sentences. Use the recipe context.';

// Check if Groq is configured on startup
const PLACEHOLDER_KEYS = ['your_groq_key_here', 'PASTE_YOUR_KEY_HERE', ''];
const groqConfigured =
  GROQ_API_KEY && !PLACEHOLDER_KEYS.includes(GROQ_API_KEY);

if (groqConfigured) {
  console.log(`✓ Groq configured (model: ${GROQ_MODEL})`);
} else {
  console.warn('⚠ GROQ_API_KEY not set — /api/ask will return an error.');
  console.warn('  Add your key to server/.env and restart.');
}

// --- Groq API caller ---

/**
 * Call the Groq chat completions API with a 10-second timeout.
 *
 * Uses Node's built-in fetch (available in Node 18+).
 * The API key is sent only server-side, never to the client.
 *
 * @param {string} userMessage — the user's question with recipe context
 * @returns {Promise<string>} the assistant's answer text
 * @throws on HTTP errors or timeout
 */
async function callGroq(userMessage) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 150,
        temperature: 0.5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    // Handle HTTP errors
    if (!response.ok) {
      const status = response.status;
      const body = await response.text().catch(() => '');
      const err = new Error(`Groq API error: ${status}`);
      err.status = status;
      err.body = body;
      throw err;
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error('Empty response from Groq');
    }

    return answer.trim();
  } catch (err) {
    clearTimeout(timer);

    // Convert AbortError to a clearer TIMEOUT error
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('TIMEOUT');
      timeoutErr.status = 504;
      throw timeoutErr;
    }

    throw err;
  }
}

// --- Retry logic ---

/** Sleep helper for retry backoff */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if an HTTP error is retryable.
 * Retry on 429 (rate limited) and 5xx (server errors).
 * Do NOT retry on 401 (bad key) or 404 (bad model).
 */
function isRetryable(err) {
  const status = err?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

/**
 * Log a diagnostic message for known error types.
 * Never prints the API key.
 */
function logDiagnostic(err) {
  const status = err?.status;
  if (status === 401) {
    console.error('[AI] Invalid or missing GROQ_API_KEY');
  } else if (status === 404) {
    console.error(`[AI] Model not found, check GROQ_MODEL (current: ${GROQ_MODEL})`);
  } else if (status === 429) {
    console.warn('[AI] Rate limited');
  } else if (err?.message === 'TIMEOUT') {
    console.warn('[AI] Request timed out (10s limit)');
  }
}

/**
 * Call Groq with retry logic.
 *
 * - Up to 3 total attempts (1 initial + 2 retries)
 * - 1 second delay before retry 2, 2 seconds before retry 3
 * - Only retries on 429 or 5xx errors
 * - Does NOT retry on 401 (invalid key) or 404 (model not found)
 *
 * @param {string} userMessage — prompt with recipe context
 * @returns {Promise<string>} the AI answer
 */
async function askWithRetry(userMessage) {
  const RETRY_DELAYS = [1000, 2000]; // ms before retry 2 and 3
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const answer = await callGroq(userMessage);
      if (attempt > 1) {
        console.log(`[AI] Succeeded on attempt ${attempt}/3`);
      }
      console.log(`[AI] Answer generated using: ${GROQ_MODEL}`);
      return answer;
    } catch (err) {
      lastError = err;
      console.warn(`[AI] Attempt ${attempt}/3 failed: ${err.status || err.message}`);
      logDiagnostic(err);

      // Don't retry non-retryable errors
      if (!isRetryable(err)) break;

      // Wait before next retry (if retries remain)
      if (attempt < 3) {
        const delayMs = RETRY_DELAYS[attempt - 1];
        console.log(`[AI] Retrying in ${delayMs / 1000} second${delayMs > 1000 ? 's' : ''}...`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

// --- Simple rate limiter (in-memory) ---
// Max 10 requests per 60 seconds — enough for testing, prevents runaway loops
const requestTimes = [];
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function isRateLimited() {
  const now = Date.now();
  while (requestTimes.length > 0 && now - requestTimes[0] > RATE_LIMIT_WINDOW_MS) {
    requestTimes.shift();
  }
  if (requestTimes.length >= RATE_LIMIT_MAX) {
    return true;
  }
  requestTimes.push(now);
  return false;
}

// --- Routes ---

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: 'groq',
    model: GROQ_MODEL,
    configured: groqConfigured,
  });
});

// AI cooking question
app.post('/api/ask', async (req, res) => {
  const { question, recipeTitle, currentStep } = req.body;

  // Validate input
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'A question is required.' });
  }

  // Check API key configuration
  if (!groqConfigured) {
    return res.status(500).json({
      error: 'AI is not configured. Add your GROQ_API_KEY to server/.env',
    });
  }

  // Rate limit
  if (isRateLimited()) {
    return res.status(429).json({
      error: 'Too many questions — please wait a moment and try again.',
    });
  }

  // Build user message with recipe context
  const context = [
    recipeTitle ? `Recipe: ${recipeTitle}` : '',
    currentStep ? `Current step: ${currentStep}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  const userMessage = context
    ? `${context}\n\nQuestion: ${question}`
    : question;

  try {
    const answer = await askWithRetry(userMessage);
    return res.json({ answer });
  } catch (err) {
    // Friendly error message — never expose internals to the client
    if (err?.message === 'TIMEOUT') {
      return res
        .status(504)
        .json({ error: 'The AI took too long. Please try again.' });
    }
    return res
      .status(500)
      .json({ error: "I couldn't get an answer, please try again." });
  }
});

// Export for testing
export { app, callGroq, isRetryable, askWithRetry };

// --- Start server when run directly ---
const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`SmartCook server running on http://localhost:${PORT}`);
  });
}
