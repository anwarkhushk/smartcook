import { useState, useCallback, useRef } from 'react';
import { logEvent } from '../utils/logger.js';

/**
 * useAskAI — hook for sending cooking questions to the backend (/api/ask).
 *
 * The backend proxies them to the Groq API so the API key
 * is never exposed to the browser.
 *
 * Returns { isAsking, answer, error, ask, clearAnswer }
 */
export default function useAskAI() {
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(null);

  // Ref prevents duplicate concurrent requests (more reliable than state)
  const busyRef = useRef(false);

  /**
   * Send a cooking question to the AI.
   * @param {string} question  — the user's question
   * @param {string} recipeTitle — current recipe name (for context)
   * @param {string} currentStep — current step text (for context)
   */
  const ask = useCallback(async (question, recipeTitle, currentStep) => {
    if (!question || !question.trim() || busyRef.current) return;

    busyRef.current = true;
    setIsAsking(true);
    setAnswer('');
    setError(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, recipeTitle, currentStep }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setAnswer(data.answer);
      logEvent('ai_answer', {
        inputSource: 'ai',
        action: 'ask_question',
        success: true,
        question,
      });
    } catch (err) {
      const msg =
        err.message || "I couldn't get an answer, please try again.";
      setError(msg);
      logEvent('ai_error', {
        inputSource: 'ai',
        action: 'ask_question',
        success: false,
        question,
        error: msg,
      });
    } finally {
      busyRef.current = false;
      setIsAsking(false);
    }
  }, []);

  /** Clear the current answer and error */
  const clearAnswer = useCallback(() => {
    setAnswer('');
    setError(null);
  }, []);

  return { isAsking, answer, error, ask, clearAnswer };
}
