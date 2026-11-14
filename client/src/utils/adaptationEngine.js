import {
  VOICE_FAIL_THRESHOLD,
  GESTURE_FAIL_THRESHOLD,
  TOTAL_ERROR_THRESHOLD,
  LONG_STEP_SECONDS,
  ADAPTATION_HOLD_MS,
} from '../config.js';
import { logEvent } from './logger.js';

/**
 * adaptationEngine.js — Rule-based UI Adaptation Engine (NO machine learning)
 *
 * Evaluates 5 plain if-then rules based on real-time kitchen context:
 *   Rule 1 (Distance)       : User is far away → enlarge text & buttons
 *   Rule 2 (Noisy / Voice)  : Room is noisy or voice fails ≥ 2 → suggest gestures & highlight guide
 *   Rule 3 (Gesture / Light): Gesture fails ≥ 3 or poor lighting → suggest voice or touch
 *   Rule 4 (Repeated Errors): Total consecutive errors ≥ 4 → show available commands help card
 *   Rule 5 (Long Step Time) : Time on current step ≥ 45s → offer "Need help? Ask me a question"
 *
 * Includes hysteresis: once a rule activates, it remains active for at least
 * ADAPTATION_HOLD_MS (4 seconds) so the interface never flickers.
 */

// Explainable messages shown to the user when each rule triggers
export const RULE_MESSAGES = {
  largeUi: 'Text and buttons enlarged because you seem far from the screen.',
  suggestGestures:
    'Room seems noisy or voice failed — try using hand gestures instead!',
  suggestVoiceOrTouch:
    'Having trouble with camera gestures — try speaking a command or tapping buttons.',
  showHelpCard:
    'Several unrecognized inputs detected — showing available commands below.',
  offerStepHelp:
    'You have been on this step for a while — need help? Ask the AI assistant!',
};

/**
 * Evaluate all adaptation rules with hysteresis.
 *
 * @param {object} context
 * @param {'near'|'far'} context.distance — Estimated user distance from camera
 * @param {boolean} context.isNoisy — True if ambient mic volume exceeds threshold
 * @param {number} context.voiceFailures — Recent consecutive voice misses
 * @param {number} context.gestureFailures — Recent consecutive gesture misses
 * @param {boolean} context.lowLight — True if camera detects poor lighting / low confidence
 * @param {number} context.secondsOnStep — Seconds spent on the current recipe step
 * @param {boolean} context.adaptiveEnabled — User toggle for Adaptive Mode ON/OFF
 * @param {object} prevMemory — Internal hysteresis memory ({ lastActiveTime, prevActive })
 * @returns {{ adaptations: object, activeReasons: string[], latestNotice: string|null }}
 */
export function evaluateAdaptations(context, prevMemory = {}) {
  const {
    distance = 'near',
    isNoisy = false,
    voiceFailures = 0,
    gestureFailures = 0,
    lowLight = false,
    secondsOnStep = 0,
    adaptiveEnabled = true,
  } = context;

  // If Adaptive Mode is turned OFF by the user, disable all rules immediately
  if (!adaptiveEnabled) {
    return {
      adaptations: {
        largeUi: false,
        suggestGestures: false,
        suggestVoiceOrTouch: false,
        showHelpCard: false,
        offerStepHelp: false,
      },
      activeReasons: [],
      latestNotice: null,
    };
  }

  const now = Date.now();
  const lastActiveTime = prevMemory.lastActiveTime || {};
  const prevActive = prevMemory.prevActive || {};

  // --- Plain IF-THEN Rules ---

  const rawRules = {
    largeUi: false,
    suggestGestures: false,
    suggestVoiceOrTouch: false,
    showHelpCard: false,
    offerStepHelp: false,
  };

  // Rule 1: Far away → increase font size and button size
  if (distance === 'far') {
    rawRules.largeUi = true;
  }

  // Rule 2: Noisy room OR repeated voice failures → suggest gestures & highlight guide
  if (isNoisy || voiceFailures >= VOICE_FAIL_THRESHOLD) {
    rawRules.suggestGestures = true;
  }

  // Rule 3: Repeated gesture failures OR poor lighting → suggest voice or touch
  if (gestureFailures >= GESTURE_FAIL_THRESHOLD || lowLight) {
    rawRules.suggestVoiceOrTouch = true;
  }

  // Rule 4: Many errors in a row → show short help-hint card with available commands
  if (voiceFailures + gestureFailures >= TOTAL_ERROR_THRESHOLD) {
    rawRules.showHelpCard = true;
  }

  // Rule 5: Very long time on one step → offer gentle "Need help? Ask me a question" prompt
  if (secondsOnStep >= LONG_STEP_SECONDS) {
    rawRules.offerStepHelp = true;
  }

  // --- Apply Hysteresis (prevent rapid UI flickering) ---
  const finalAdaptations = {};
  const activeReasons = [];
  let latestNotice = prevMemory.latestNotice || null;

  for (const ruleName of Object.keys(rawRules)) {
    const isNowTrue = rawRules[ruleName];

    if (isNowTrue) {
      // Condition is currently met: update timestamp and activate
      lastActiveTime[ruleName] = now;
      finalAdaptations[ruleName] = true;
    } else {
      // Condition is false: keep active if within the hysteresis hold window
      const lastTime = lastActiveTime[ruleName] || 0;
      if (now - lastTime < ADAPTATION_HOLD_MS) {
        finalAdaptations[ruleName] = true;
      } else {
        finalAdaptations[ruleName] = false;
      }
    }

    // Log and notify whenever a rule transitions from OFF → ON or ON → OFF
    const wasActive = Boolean(prevActive[ruleName]);
    const isActive = finalAdaptations[ruleName];

    if (isActive && !wasActive) {
      const reason = RULE_MESSAGES[ruleName];
      latestNotice = reason;
      logEvent('adaptation_triggered', {
        rule: ruleName,
        reason,
        context: {
          distance,
          isNoisy,
          voiceFailures,
          gestureFailures,
          lowLight,
          secondsOnStep,
        },
      });
    } else if (!isActive && wasActive) {
      logEvent('adaptation_cleared', { rule: ruleName });
    }

    prevActive[ruleName] = isActive;

    if (isActive) {
      activeReasons.push({
        rule: ruleName,
        message: RULE_MESSAGES[ruleName],
      });
    }
  }

  prevMemory.lastActiveTime = lastActiveTime;
  prevMemory.prevActive = prevActive;
  prevMemory.latestNotice = latestNotice;

  return {
    adaptations: finalAdaptations,
    activeReasons,
    latestNotice,
  };
}
