/**
 * parseVoiceCommand — turns a voice transcript into an action command.
 *
 * Uses forgiving keyword matching: case-insensitive, supports synonyms.
 * Returns { action, params? } if a command is found, or null if no match.
 *
 * Supported commands:
 *   "next" / "next step" / "forward" / "continue"   → nextStep
 *   "back" / "go back" / "previous"                  → prevStep
 *   "repeat" / "again" / "say again"                 → repeatStep
 *   "start a 5 minute timer" / "set timer" etc.      → startTimer
 *   "pause" / "pause timer" / "resume"               → pauseTimer
 *   "undo" / "go back one action"                    → undo
 *   "restart" / "start over" / "first step"          → restartRecipe (risky)
 *   "done" / "finish" / "complete"                   → markDone
 *   "yes" / "confirm"                                → confirmAction
 *   "no" / "cancel"                                  → cancelAction
 */
export default function parseVoiceCommand(transcript) {
  const text = transcript.toLowerCase().trim();
  if (!text) return null;

  // --- If user is answering a confirmation dialog ---
  if (/^(yes|yeah|yep|confirm|sure|do it)$/.test(text)) {
    return { action: 'confirmAction' };
  }
  if (/^(no|nope|cancel|stop|never mind)$/.test(text)) {
    return { action: 'cancelAction' };
  }

  // --- Timer with duration (check first — most specific) ---
  const minMatch = text.match(/(\d+)\s*(?:minute|min)/);
  const secMatch = text.match(/(\d+)\s*(?:second|sec)/);

  if ((minMatch || secMatch) && /\b(timer|start|set|begin)\b/.test(text)) {
    const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;
    const seconds = secMatch ? parseInt(secMatch[1], 10) : 0;
    const total = minutes * 60 + seconds;
    if (total > 0) {
      return { action: 'startTimer', params: { seconds: total } };
    }
  }

  // --- "start timer" without a duration → use the step's suggested timer ---
  if (/\b(start|set|begin)\b.*\btimer\b/.test(text)) {
    return { action: 'startTimer', params: { seconds: 0 } };
  }

  // --- Pause / resume timer ---
  if (/\b(pause|resume)\b.*\b(timer)?\b/.test(text)) {
    return { action: 'pauseTimer' };
  }

  // --- Undo last action ---
  if (/\b(undo|revert)\b/.test(text)) {
    return { action: 'undo' };
  }

  // --- Restart recipe (risky action — asks confirmation) ---
  if (/\b(restart|start\s*over|first\s*step|reset\s*recipe)\b/.test(text)) {
    return { action: 'restartRecipe' };
  }

  // --- Next step ---
  if (/\b(next|forward|continue)\b/.test(text)) {
    return { action: 'nextStep' };
  }

  // --- Previous step ---
  if (/\b(back|previous|go\s*back)\b/.test(text)) {
    return { action: 'prevStep' };
  }

  // --- Repeat current step ---
  if (/\b(repeat|again|re-?read|read\s*again)\b/.test(text)) {
    return { action: 'repeatStep' };
  }

  // --- Mark done ---
  if (/\b(done|finish|finished|complete|completed)\b/.test(text)) {
    return { action: 'markDone' };
  }

  // No recognized command
  return null;
}

/**
 * Check if an unrecognized spoken phrase looks like a cooking question
 * (as opposed to a garbled short command or background noise).
 */
export function looksLikeQuestion(transcript) {
  const text = transcript.toLowerCase().trim();
  if (!text) return false;
  if (text.includes('?')) return true;
  if (
    /^(how|what|why|when|where|can|could|should|do|does|is|are|will|which|tell|explain)\b/.test(
      text
    )
  ) {
    return true;
  }
  // Longer multi-word sentences (>= 4 words) are treated as questions
  const words = text.split(/\s+/);
  return words.length >= 4;
}

/**
 * Human-friendly labels for command feedback display.
 */
export const COMMAND_LABELS = {
  nextStep: '→ Next step',
  prevStep: '← Previous step',
  repeatStep: '🔄 Repeating current step',
  startTimer: '⏱ Timer started',
  pauseTimer: '⏸ Timer paused / resumed',
  restartRecipe: '⏮ Restart recipe',
  markDone: '✅ Recipe complete!',
  undo: '↩ Undid last action',
  confirmAction: '✓ Confirmed action',
  cancelAction: '✕ Cancelled action',
};
