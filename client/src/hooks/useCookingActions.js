import { useState, useEffect, useCallback } from 'react';
import useTimer from './useTimer.js';
import { logEvent } from '../utils/logger.js';

/**
 * useCookingActions — Central Action Dispatcher + Feedback & Recovery State
 *
 * ALL user inputs (touch, voice, gesture) must go through these actions.
 *
 * Responsibilities:
 *  1. Executes recipe actions (nextStep, prevStep, repeatStep, startTimer,
 *     pauseTimer, restartRecipe, markDone, undo).
 *  2. Records what the system understood for EVERY input, labeled by source
 *     ('touch' | 'voice' | 'gesture') for Norman/Nielsen visibility of status.
 *  3. Guards risky actions (restarting recipe, finishing early) with a
 *     confirmation prompt before executing.
 *  4. Maintains an undo stack so the user can always recover from mistakes.
 *  5. Tracks voiceFailures, gestureFailures, and secondsOnStep for the
 *     Phase 5 Adaptation Engine.
 *  6. Emits structured events via logEvent().
 */
export default function useCookingActions(recipe) {
  const totalSteps = recipe.steps.length;

  const [stepIndex, setStepIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);

  // Undo history stack: stores [{ stepIndex, isDone, description }]
  const [history, setHistory] = useState([]);

  // Feedback banner state: { source: 'touch'|'voice'|'gesture', message: string, timestamp: number }
  const [lastActionFeedback, setLastActionFeedback] = useState(null);

  // Confirmation modal state for risky actions: { type, message, source } | null
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  // Error counters for the Adaptation Engine
  const [voiceFailures, setVoiceFailures] = useState(0);
  const [gestureFailures, setGestureFailures] = useState(0);

  // Seconds spent on the current step (resets on step change)
  const [secondsOnStep, setSecondsOnStep] = useState(0);

  // Countdown timer for timed recipe steps
  const timer = useTimer();

  // --- Increment secondsOnStep every second ---
  useEffect(() => {
    setSecondsOnStep(0);
    if (isDone) return;

    const id = setInterval(() => {
      setSecondsOnStep((s) => s + 1);
    }, 1000);

    return () => clearInterval(id);
  }, [stepIndex, isDone]);

  /** Helper: record visible source-labeled feedback and emit to logger */
  const recordFeedback = useCallback(
    (source, actionName, message, extra = {}) => {
      setLastActionFeedback({
        source,
        actionName,
        message,
        timestamp: Date.now(),
      });

      // Reset consecutive error count for a modality when it succeeds
      if (source === 'voice') setVoiceFailures(0);
      if (source === 'gesture') setGestureFailures(0);

      logEvent('action', {
        source,
        action: actionName,
        stepIndex,
        message,
        ...extra,
      });
    },
    [stepIndex]
  );

  /** Save current state to undo stack before mutating */
  const pushHistory = useCallback(
    (description) => {
      setHistory((prev) => [
        ...prev,
        { stepIndex, isDone, description },
      ]);
    },
    [stepIndex, isDone]
  );

  // --- Core Actions ---

  /** Go to the next step */
  const nextStep = useCallback(
    (source = 'touch') => {
      if (stepIndex < totalSteps - 1) {
        pushHistory(`Step ${stepIndex + 1}`);
        timer.reset();
        setPendingConfirmation(null);
        const nextIdx = stepIndex + 1;
        setStepIndex(nextIdx);
        recordFeedback(
          source,
          'nextStep',
          `Moved to Step ${nextIdx + 1} of ${totalSteps}`
        );
      }
    },
    [stepIndex, totalSteps, pushHistory, timer, recordFeedback]
  );

  /** Go to the previous step */
  const prevStep = useCallback(
    (source = 'touch') => {
      if (stepIndex > 0) {
        pushHistory(`Step ${stepIndex + 1}`);
        timer.reset();
        setPendingConfirmation(null);
        const prevIdx = stepIndex - 1;
        setStepIndex(prevIdx);
        recordFeedback(
          source,
          'prevStep',
          `Went back to Step ${prevIdx + 1} of ${totalSteps}`
        );
      }
    },
    [stepIndex, totalSteps, pushHistory, timer, recordFeedback]
  );

  /** Repeat (re-read) the current step */
  const repeatStep = useCallback(
    (source = 'touch') => {
      timer.reset();
      recordFeedback(
        source,
        'repeatStep',
        `Repeated Step ${stepIndex + 1}`
      );
    },
    [timer, stepIndex, recordFeedback]
  );

  /** Start the timer for a given duration in seconds */
  const startTimer = useCallback(
    (seconds, source = 'touch') => {
      const dur = seconds || recipe.steps[stepIndex]?.timerSeconds || 60;
      timer.start(dur);
      recordFeedback(
        source,
        'startTimer',
        `Started timer for ${dur}s`,
        { seconds: dur }
      );
    },
    [timer, recipe.steps, stepIndex, recordFeedback]
  );

  /** Pause or resume the running timer */
  const pauseTimer = useCallback(
    (source = 'touch') => {
      if (timer.isRunning) {
        timer.pause();
        recordFeedback(source, 'pauseTimer', 'Paused timer');
      } else if (timer.remaining > 0) {
        timer.resume();
        recordFeedback(source, 'resumeTimer', 'Resumed timer');
      } else {
        recordFeedback(
          source,
          'pauseTimer',
          'Timer is not currently running'
        );
      }
    },
    [timer, recordFeedback]
  );

  /**
   * Restart the recipe from Step 1 (Risky action if user is past Step 1).
   * Asks for confirmation first so accidental voice/gesture triggers are safe.
   */
  const restartRecipe = useCallback(
    (source = 'touch') => {
      if (stepIndex === 0) return;
      setPendingConfirmation({
        type: 'restart',
        source,
        message: `Are you sure you want to restart from Step 1? (Currently on Step ${stepIndex + 1})`,
      });
      logEvent('confirmation_requested', {
        type: 'restart',
        source,
        stepIndex,
      });
    },
    [stepIndex]
  );

  /**
   * Mark the recipe as Done.
   * If triggered before the final step (e.g. accidental Thumbs-Up gesture),
   * ask for confirmation first.
   */
  const markDone = useCallback(
    (source = 'touch') => {
      if (stepIndex < totalSteps - 1) {
        setPendingConfirmation({
          type: 'finish_early',
          source,
          message: `You are on Step ${stepIndex + 1} of ${totalSteps}. Finish the recipe early?`,
        });
        logEvent('confirmation_requested', {
          type: 'finish_early',
          source,
          stepIndex,
        });
        return;
      }

      pushHistory(`Step ${stepIndex + 1}`);
      timer.reset();
      setIsDone(true);
      recordFeedback(source, 'markDone', 'Completed the recipe!');
    },
    [stepIndex, totalSteps, pushHistory, timer, recordFeedback]
  );

  /** Confirm a pending risky action */
  const confirmRiskyAction = useCallback(
    (source = 'touch') => {
      if (!pendingConfirmation) return;

      const { type } = pendingConfirmation;
      setPendingConfirmation(null);

      if (type === 'restart') {
        pushHistory(`Step ${stepIndex + 1}`);
        timer.reset();
        setStepIndex(0);
        setIsDone(false);
        recordFeedback(
          source,
          'restartRecipe',
          'Confirmed: Restarted recipe at Step 1'
        );
      } else if (type === 'finish_early') {
        pushHistory(`Step ${stepIndex + 1}`);
        timer.reset();
        setIsDone(true);
        recordFeedback(
          source,
          'markDone',
          'Confirmed: Marked recipe complete'
        );
      }
    },
    [pendingConfirmation, pushHistory, stepIndex, timer, recordFeedback]
  );

  /** Cancel a pending risky action */
  const cancelRiskyAction = useCallback(
    (source = 'touch') => {
      if (!pendingConfirmation) return;
      const { type } = pendingConfirmation;
      setPendingConfirmation(null);
      recordFeedback(
        source,
        'cancelRiskyAction',
        `Cancelled ${type === 'restart' ? 'restart' : 'early finish'}`
      );
    },
    [pendingConfirmation, recordFeedback]
  );

  /** Undo the last step change (works even from the Done screen) */
  const undo = useCallback(
    (source = 'touch') => {
      if (history.length === 0) return;
      const last = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      timer.reset();
      setPendingConfirmation(null);
      setIsDone(last.isDone);
      setStepIndex(last.stepIndex);
      recordFeedback(
        source,
        'undo',
        `Undid last action → back to Step ${last.stepIndex + 1}`
      );
    },
    [history, timer, recordFeedback]
  );

  // --- Failure Tracking for Adaptation Engine ---

  const recordVoiceFailure = useCallback(
    (heardText = '') => {
      setVoiceFailures((c) => {
        const next = c + 1;
        logEvent('input_failure', {
          modality: 'voice',
          heard: heardText,
          consecutiveFailures: next,
        });
        return next;
      });
    },
    []
  );

  const recordGestureFailure = useCallback(
    (reason = 'unrecognized') => {
      setGestureFailures((c) => {
        const next = c + 1;
        logEvent('input_failure', {
          modality: 'gesture',
          reason,
          consecutiveFailures: next,
        });
        return next;
      });
    },
    []
  );

  const resetFailures = useCallback(() => {
    setVoiceFailures(0);
    setGestureFailures(0);
  }, []);

  /** Fast-forward step time to 45s (for Viva / testing Rule 5) */
  const fastForwardStepTime = useCallback(() => {
    setSecondsOnStep((s) => Math.max(s, 45));
  }, []);

  return {
    stepIndex,
    totalSteps,
    isDone,
    timer,
    canUndo: history.length > 0,
    lastActionFeedback,
    pendingConfirmation,
    voiceFailures,
    gestureFailures,
    secondsOnStep,
    actions: {
      nextStep,
      prevStep,
      repeatStep,
      startTimer,
      pauseTimer,
      restartRecipe,
      markDone,
      confirmRiskyAction,
      cancelRiskyAction,
      undo,
      recordVoiceFailure,
      recordGestureFailure,
      resetFailures,
      fastForwardStepTime,
    },
  };
}
