import { useState, useEffect, useRef, useCallback } from 'react';
import config from '../config.js';
import useCookingActions from '../hooks/useCookingActions.js';
import useVoice from '../hooks/useVoice.js';
import useGesture from '../hooks/useGesture.js';
import useNoiseLevel from '../hooks/useNoiseLevel.js';
import useAskAI from '../hooks/useAskAI.js';
import parseVoiceCommand, {
  looksLikeQuestion,
  COMMAND_LABELS,
} from '../utils/parseVoiceCommand.js';
import { evaluateAdaptations } from '../utils/adaptationEngine.js';
import { logEvent } from '../utils/logger.js';
import AdaptationBanner from './AdaptationBanner.jsx';
import GesturePanel from './GesturePanel.jsx';
import VoiceStatus from './VoiceStatus.jsx';
import AskPanel from './AskPanel.jsx';
import './CookingView.css';

const SOURCE_BADGES = {
  touch: '👆 Touch',
  voice: '🎤 Voice',
  gesture: '✋ Gesture',
};

/**
 * CookingView — the core cooking experience.
 *
 * Shows one step at a time with large text, progress bar,
 * navigation buttons, and a timer panel.
 *
 * In "smartcook" mode, also enables:
 *  - Voice commands + TTS (Phase 2)
 *  - Hand gesture control + distance estimation (Phase 3)
 *  - AI cooking assistant via Groq (Phase 4)
 *  - Rule-based Adaptation Engine + Feedback & Recovery layer (Phase 5)
 */
function CookingView({ recipe, onExit }) {
  const {
    stepIndex,
    totalSteps,
    isDone,
    timer,
    canUndo,
    lastActionFeedback,
    pendingConfirmation,
    voiceFailures,
    gestureFailures,
    secondsOnStep,
    actions,
  } = useCookingActions(recipe);

  const isSmartCook = config.mode === 'smartcook';

  // User-controllable Adaptive Mode ON/OFF toggle
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);

  // Voice & AI hooks
  const voice = useVoice();
  const ai = useAskAI();

  // Ambient room noise hook (Web Audio API AnalyserNode, local only)
  const noise = useNoiseLevel(isSmartCook);

  // Voice command feedback banner: { heard, message, isError, canAskAI } | null
  const [commandFeedback, setCommandFeedback] = useState(null);
  const feedbackTimerRef = useRef(null);
  const lastProcessedIdRef = useRef(0);
  const prevAnswerRef = useRef('');
  const lastRetrySpeechRef = useRef(0); // 5-second throttle for TTS retry prompt

  const currentStep = recipe.steps[stepIndex];
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  // --- Gesture callback (routed through central action dispatcher) ---
  const handleGestureDetected = useCallback(
    ({ action }) => {
      if (!isSmartCook) return;
      if (action === 'nextStep') actions.nextStep('gesture');
      else if (action === 'prevStep') actions.prevStep('gesture');
      else if (action === 'pauseTimer') actions.pauseTimer('gesture');
      else if (action === 'markDone') actions.markDone('gesture');
    },
    [isSmartCook, actions]
  );

  const gesture = useGesture({
    enabled: isSmartCook,
    onGesture: handleGestureDetected,
    onFailure: actions.recordGestureFailure,
  });

  // --- Evaluate Adaptation Engine rules (with hysteresis memory) ---
  const hysteresisMemRef = useRef({});
  const { adaptations, activeReasons } = isSmartCook
    ? evaluateAdaptations(
        {
          distance: gesture.distance,
          isNoisy: noise.isNoisy,
          voiceFailures,
          gestureFailures,
          lowLight: gesture.lowLight,
          secondsOnStep,
          adaptiveEnabled,
        },
        hysteresisMemRef.current
      )
    : {
        adaptations: {
          largeUi: false,
          suggestGestures: false,
          suggestVoiceOrTouch: false,
          showHelpCard: false,
          offerStepHelp: false,
        },
        activeReasons: [],
      };

  /** Toggle Adaptive Mode ON/OFF and log the change */
  const handleToggleAdaptive = useCallback(() => {
    setAdaptiveEnabled((prev) => {
      const next = !prev;
      logEvent('adaptive_mode_toggled', { enabled: next });
      return next;
    });
  }, []);

  /** Send a cooking question to the AI with recipe context */
  const handleAskAI = useCallback(
    (question) => {
      logEvent('ai_question', { question, stepIndex });
      ai.ask(question, recipe.title, currentStep.text);
    },
    [ai.ask, recipe.title, currentStep.text, stepIndex]
  );

  // --- Start/stop voice listening when entering/leaving cooking view ---
  useEffect(() => {
    if (isSmartCook && voice.isSupported) {
      voice.startListening();
      return () => voice.stopListening();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Read the current step aloud when it changes (smartcook mode) ---
  useEffect(() => {
    if (isSmartCook && !isDone) {
      voice.speak(currentStep.text);
    }
  }, [stepIndex, isDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Read AI answer aloud when a new one arrives ---
  useEffect(() => {
    if (ai.answer && ai.answer !== prevAnswerRef.current) {
      prevAnswerRef.current = ai.answer;
      if (isSmartCook) {
        voice.speak(ai.answer);
      }
    }
  }, [ai.answer]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Process voice transcripts ---
  useEffect(() => {
    if (!isSmartCook) return;
    if (!voice.transcript) return;
    if (voice.transcriptId === lastProcessedIdRef.current) return;

    lastProcessedIdRef.current = voice.transcriptId;

    // Ignore very short noise (< 2 characters) silently
    if (voice.transcript.length < 2) return;

    const command = parseVoiceCommand(voice.transcript);
    clearTimeout(feedbackTimerRef.current);

    if (command) {
      dispatchVoiceCommand(command, actions, currentStep, voice);

      setCommandFeedback({
        heard: voice.transcript,
        message: COMMAND_LABELS[command.action] || '✓ Done',
        isError: false,
      });

      feedbackTimerRef.current = setTimeout(
        () => setCommandFeedback(null),
        4000
      );
    } else if (looksLikeQuestion(voice.transcript)) {
      // Unrecognized command that looks like a free cooking question → ask AI
      handleAskAI(voice.transcript);

      setCommandFeedback({
        heard: voice.transcript,
        message: '🤔 Asking AI assistant…',
        isError: false,
      });

      feedbackTimerRef.current = setTimeout(
        () => setCommandFeedback(null),
        4000
      );
    } else {
      // Unrecognized short phrase → count failure + show recovery hints + speak retry
      actions.recordVoiceFailure(voice.transcript);

      setCommandFeedback({
        heard: voice.transcript,
        message:
          'Did not understand. Try saying: "next step", "go back", "repeat", "start timer", or "undo".',
        isError: true,
        canAskAI: true,
      });

      // Speak retry message out loud (throttled to at most once every 5 seconds)
      const now = Date.now();
      if (voice.ttsEnabled && now - lastRetrySpeechRef.current >= 5000) {
        lastRetrySpeechRef.current = now;
        voice.speak("Sorry, I didn't catch that. Can you say it again?");
      }

      feedbackTimerRef.current = setTimeout(
        () => setCommandFeedback(null),
        6000
      );
    }
  }, [voice.transcriptId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => clearTimeout(feedbackTimerRef.current);
  }, []);

  // ---- Done Screen ----
  if (isDone) {
    return (
      <div
        className={`cooking-view ${adaptations.largeUi ? 'cooking-view-large' : ''}`}
      >
        <div className="done-screen">
          <span className="done-emoji">🎉</span>
          <h2>Recipe Complete!</h2>
          <p>Enjoy your {recipe.title}!</p>
          <div className="done-actions">
            {canUndo && (
              <button
                className="btn btn-undo"
                onClick={() => actions.undo('touch')}
              >
                ↩ Undo (Back to Cooking)
              </button>
            )}
            <button className="btn btn-primary" onClick={onExit}>
              ← Back to Recipes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Cooking Screen ----
  return (
    <div
      className={`cooking-view ${adaptations.largeUi ? 'cooking-view-large' : ''}`}
    >
      {/* Header bar with recipe title, restart, and exit */}
      <div className="cooking-header">
        <button className="btn btn-back" onClick={onExit}>
          ✕ Exit
        </button>
        <h2 className="cooking-title">
          {recipe.emoji} {recipe.title}
        </h2>
        {stepIndex > 0 && (
          <button
            className="btn btn-restart"
            onClick={() => actions.restartRecipe('touch')}
            title="Restart from Step 1 (asks confirmation)"
          >
            ⏮ Restart
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {/* Step counter + last understood input badge */}
      <div className="step-status-row">
        <p className="step-counter">
          Step {stepIndex + 1} of {totalSteps}
        </p>

        {lastActionFeedback && (
          <span className="understood-badge" role="status">
            <strong>{SOURCE_BADGES[lastActionFeedback.source]}:</strong>{' '}
            {lastActionFeedback.message}
          </span>
        )}
      </div>

      {/* Risky Action Confirmation Banner (Error Prevention — Nielsen) */}
      {pendingConfirmation && (
        <div className="confirmation-banner" role="alertdialog">
          <p className="confirmation-text">⚠️ {pendingConfirmation.message}</p>
          <div className="confirmation-buttons">
            <button
              className="btn btn-confirm-yes"
              onClick={() => actions.confirmRiskyAction('touch')}
            >
              ✓ Yes, Confirm
            </button>
            <button
              className="btn btn-confirm-no"
              onClick={() => actions.cancelRiskyAction('touch')}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Adaptation Engine Banner & Controls — smartcook mode only */}
      {isSmartCook && (
        <AdaptationBanner
          adaptiveEnabled={adaptiveEnabled}
          onToggleAdaptive={handleToggleAdaptive}
          adaptations={adaptations}
          activeReasons={activeReasons}
          contextState={{
            distance: gesture.distance,
            volume: noise.volume,
            isNoisy: noise.isNoisy,
            voiceFailures,
            gestureFailures,
            secondsOnStep,
          }}
          onQuickAsk={handleAskAI}
          onResetErrors={actions.resetFailures}
          simControls={{
            setSimulatedDistance: gesture.setSimulatedDistance,
            simulatedNoisy: noise.simulatedNoisy,
            setSimulatedNoisy: noise.setSimulatedNoisy,
            simulateVoiceFail: () => actions.recordVoiceFailure('simulated'),
            simulateGestureFail: () =>
              actions.recordGestureFailure('simulated'),
            fastForwardStepTime: actions.fastForwardStepTime,
          }}
        />
      )}

      {/* Step text card */}
      <div className="step-card">
        <p className="step-text">{currentStep.text}</p>
      </div>

      {/* Timer panel — shown if step has a suggested timer or timer is active */}
      {(currentStep.timerSeconds || timer.remaining > 0 || timer.isFinished) && (
        <TimerPanel
          suggestedSeconds={currentStep.timerSeconds || 60}
          timer={timer}
          onStart={(secs) => actions.startTimer(secs, 'touch')}
          onPauseResume={() => actions.pauseTimer('touch')}
        />
      )}

      {/* Navigation buttons */}
      <div className="cooking-nav">
        <button
          className="btn btn-secondary"
          onClick={() => actions.prevStep('touch')}
          disabled={stepIndex === 0}
        >
          ← Back
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => {
            actions.repeatStep('touch');
            if (isSmartCook) voice.speak(currentStep.text);
          }}
        >
          🔄 Repeat
        </button>

        {canUndo && (
          <button
            className="btn btn-undo"
            onClick={() => actions.undo('touch')}
          >
            ↩ Undo
          </button>
        )}

        {stepIndex < totalSteps - 1 ? (
          <button
            className="btn btn-primary"
            onClick={() => actions.nextStep('touch')}
          >
            Next →
          </button>
        ) : (
          <button
            className="btn btn-done"
            onClick={() => actions.markDone('touch')}
          >
            ✓ Done
          </button>
        )}
      </div>

      {/* Hand Gesture Camera + Guide — smartcook mode only */}
      {isSmartCook && (
        <GesturePanel
          gesture={gesture}
          highlightGuide={adaptations.suggestGestures}
        />
      )}

      {/* AI assistant panel — smartcook mode only */}
      {isSmartCook && <AskPanel ai={ai} onAsk={handleAskAI} />}

      {/* Voice status bar — smartcook mode only */}
      {isSmartCook && (
        <VoiceStatus
          voice={voice}
          commandFeedback={commandFeedback}
          onAskFallback={
            commandFeedback?.canAskAI
              ? () => handleAskAI(commandFeedback.heard)
              : null
          }
        />
      )}
    </div>
  );
}

/**
 * Dispatch a parsed voice command to the central action dispatcher.
 */
function dispatchVoiceCommand(command, actions, currentStep, voice) {
  switch (command.action) {
    case 'nextStep':
      actions.nextStep('voice');
      break;
    case 'prevStep':
      actions.prevStep('voice');
      break;
    case 'repeatStep':
      actions.repeatStep('voice');
      voice.speak(currentStep.text);
      break;
    case 'startTimer': {
      const seconds =
        command.params.seconds > 0
          ? command.params.seconds
          : currentStep.timerSeconds || 60;
      actions.startTimer(seconds, 'voice');
      break;
    }
    case 'pauseTimer':
      actions.pauseTimer('voice');
      break;
    case 'restartRecipe':
      actions.restartRecipe('voice');
      break;
    case 'markDone':
      actions.markDone('voice');
      break;
    case 'undo':
      actions.undo('voice');
      break;
    case 'confirmAction':
      actions.confirmRiskyAction('voice');
      break;
    case 'cancelAction':
      actions.cancelRiskyAction('voice');
      break;
    default:
      break;
  }
}

/**
 * TimerPanel — countdown timer UI for timed cooking steps.
 */
function TimerPanel({ suggestedSeconds, timer, onStart, onPauseResume }) {
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`timer-panel ${timer.isFinished ? 'timer-done' : ''}`}>
      <div className="timer-display">⏱ {formatTime(timer.remaining)}</div>

      {timer.isFinished && <p className="timer-alert">⏰ Time&apos;s up!</p>}

      <div className="timer-buttons">
        {!timer.isRunning && !timer.isFinished && timer.remaining === 0 && (
          <button
            className="btn btn-timer"
            onClick={() => onStart(suggestedSeconds)}
          >
            ▶ Start {formatTime(suggestedSeconds)}
          </button>
        )}

        {(timer.isRunning || (timer.remaining > 0 && !timer.isFinished)) && (
          <button className="btn btn-timer" onClick={onPauseResume}>
            {timer.isRunning ? '⏸ Pause' : '▶ Resume'}
          </button>
        )}

        {(timer.remaining > 0 || timer.isFinished) && (
          <button className="btn btn-timer-reset" onClick={timer.reset}>
            ⟳ Reset
          </button>
        )}
      </div>
    </div>
  );
}

export default CookingView;
