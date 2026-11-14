/**
 * config.js — Central app configuration & tunable constants
 *
 * Reads the "mode" URL parameter and exports it for the whole app:
 *   ?mode=baseline   → touch only, no AI/voice/gesture/adaptation
 *   ?mode=smartcook  → full multimodal experience (default)
 *
 * All timing, gesture, and adaptation thresholds are placed here
 * at the top so they can be easily tuned and explained in a viva.
 */

const searchString =
  typeof window !== 'undefined' ? window.location.search : '';
const params = new URLSearchParams(searchString);

// --- Gesture Detection Constants (Phase 3) ---
export const POSE_HOLD_MS = 600;           // Static pose (Open_Palm, Thumb_Up) must be held ~600ms
export const GESTURE_COOLDOWN_MS = 1500;   // 1.5s cooldown between any two triggered gestures
export const SWIPE_WINDOW_MS = 500;        // Time window (500ms) for tracking wrist horizontal movement
export const SWIPE_THRESHOLD_X = 0.22;     // Normalized horizontal distance (22% of frame width) for a swipe
export const MIN_GESTURE_CONFIDENCE = 0.65; // Minimum MediaPipe confidence score to accept a pose
export const FAR_HAND_SIZE_THRESHOLD = 0.14; // Normalized hand size below which user is considered "far"
export const NEAR_HAND_SIZE_THRESHOLD = 0.18; // Hysteresis upper bound to switch back to "near"

// --- Adaptation Engine Constants (Phase 5) ---
export const NOISE_HIGH_THRESHOLD = 35;    // Mic volume (0-100) above which room is considered noisy
export const NOISE_LOW_THRESHOLD = 25;     // Hysteresis lower bound for room noise to clear
export const NOISE_HOLD_MS = 2000;         // Noise must persist 2s before triggering adaptation
export const VOICE_FAIL_THRESHOLD = 2;     // Number of recent voice failures to suggest gestures
export const GESTURE_FAIL_THRESHOLD = 3;   // Number of recent gesture failures to suggest voice/touch
export const TOTAL_ERROR_THRESHOLD = 4;    // Combined errors in a row to display the help-hint card
export const LONG_STEP_SECONDS = 45;       // Seconds on a single step before offering AI help prompt
export const ADAPTATION_HOLD_MS = 4000;    // Hysteresis: minimum time (4s) an adaptation stays active

const config = {
  /** Current study mode: "baseline" or "smartcook" */
  mode: params.get('mode') === 'baseline' ? 'baseline' : 'smartcook',

  /** Update mode dynamically from the Study Control Panel and sync URL */
  setMode(newMode) {
    const valid = newMode === 'baseline' ? 'baseline' : 'smartcook';
    this.mode = valid;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', valid);
      window.history.replaceState({}, '', url.toString());
    }
  },
};

export default config;
