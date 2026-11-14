import { useState } from 'react';
import './AdaptationBanner.css';

/**
 * AdaptationBanner — renders the Adaptive Mode ON/OFF toggle,
 * live context badges, explainable adaptation notifications,
 * the Help-Hint Card (Rule 4), the Long-Step Help Prompt (Rule 5),
 * and a collapsible Viva Demo / Context Simulator bar.
 */
function AdaptationBanner({
  adaptiveEnabled,
  onToggleAdaptive,
  adaptations,
  activeReasons,
  contextState,
  onQuickAsk,
  onResetErrors,
  simControls,
}) {
  const [showSim, setShowSim] = useState(false);

  return (
    <div className="adaptation-container">
      {/* Top control bar: Adaptive Mode ON/OFF toggle + live sensor summary */}
      <div className="adaptation-top-bar">
        <div className="adaptive-toggle-group">
          <button
            type="button"
            className={`btn-adaptive-toggle ${adaptiveEnabled ? 'adaptive-on' : 'adaptive-off'}`}
            onClick={onToggleAdaptive}
          >
            ⚙️ Adaptive Mode: <strong>{adaptiveEnabled ? 'ON' : 'OFF'}</strong>
          </button>

          <span className="sensor-summary">
            📏 {contextState.distance === 'far' ? 'Far' : 'Near'} · 🔊 Mic{' '}
            {contextState.volume}% {contextState.isNoisy ? '(Noisy)' : '(Quiet)'} · ⏱{' '}
            {contextState.secondsOnStep}s on step
          </span>
        </div>

        <button
          type="button"
          className="btn-sim-toggle"
          onClick={() => setShowSim((s) => !s)}
          title="Open context controls to test adaptation rules during viva"
        >
          {showSim ? '▲ Hide Viva Test Controls' : '🧪 Viva Test Controls'}
        </button>
      </div>

      {/* Collapsible Viva / Study Test Controls so every rule can be triggered on demand */}
      {showSim && (
        <div className="viva-sim-panel">
          <span className="sim-label">Simulate Context (for testing / viva):</span>
          <button
            type="button"
            className={`btn-sim ${contextState.distance === 'far' ? 'sim-active' : ''}`}
            onClick={() =>
              simControls.setSimulatedDistance(
                contextState.distance === 'far' ? 'near' : 'far'
              )
            }
          >
            📏 Distance: {contextState.distance === 'far' ? 'FAR (Large UI)' : 'NEAR'}
          </button>

          <button
            type="button"
            className={`btn-sim ${simControls.simulatedNoisy ? 'sim-active' : ''}`}
            onClick={() => simControls.setSimulatedNoisy((n) => !n)}
          >
            🔊 Room Noise: {simControls.simulatedNoisy ? 'NOISY' : 'Normal'}
          </button>

          <button
            type="button"
            className="btn-sim"
            onClick={simControls.simulateVoiceFail}
          >
            +1 Voice Fail ({contextState.voiceFailures})
          </button>

          <button
            type="button"
            className="btn-sim"
            onClick={simControls.simulateGestureFail}
          >
            +1 Gesture Fail ({contextState.gestureFailures})
          </button>

          <button
            type="button"
            className="btn-sim"
            onClick={simControls.fastForwardStepTime}
          >
            ⏩ Step Time +45s
          </button>

          {(contextState.voiceFailures > 0 || contextState.gestureFailures > 0) && (
            <button type="button" className="btn-sim" onClick={onResetErrors}>
              ↺ Clear Errors
            </button>
          )}
        </div>
      )}

      {/* Explainable Adaptation Notices (shown whenever any rule is active) */}
      {adaptiveEnabled && activeReasons.length > 0 && (
        <div className="adaptation-notices" role="status" aria-live="polite">
          {activeReasons.map((item) => (
            <div key={item.rule} className={`adaptation-pill pill-${item.rule}`}>
              <span className="pill-icon">✨ Adapted:</span> {item.message}
            </div>
          ))}
        </div>
      )}

      {/* Rule 4: Help-Hint Card when many errors happen in a row */}
      {adaptiveEnabled && adaptations.showHelpCard && (
        <div className="help-hint-card">
          <div className="help-hint-header">
            <strong>💡 Quick Command Reference</strong>
            <button
              type="button"
              className="btn-dismiss-help"
              onClick={onResetErrors}
            >
              Got it ✕
            </button>
          </div>
          <div className="help-hint-columns">
            <div>
              <strong>🎤 Say out loud:</strong>
              <p>"next step", "go back", "repeat", "start timer", "pause", "undo", "done"</p>
            </div>
            <div>
              <strong>✋ Hand gestures:</strong>
              <p>Swipe Right (Next), Swipe Left (Back), Hold Open Palm (Pause), Hold Thumbs Up (Done)</p>
            </div>
            <div>
              <strong>👆 Touch:</strong>
              <p>Tap the large orange Next / Back / Timer buttons anytime</p>
            </div>
          </div>
        </div>
      )}

      {/* Rule 5: Gentle prompt when user spends a long time on one step */}
      {adaptiveEnabled && adaptations.offerStepHelp && (
        <div className="step-help-prompt">
          <span>🤔 <strong>Need help with this step?</strong> Ask me a question or tap a quick tip:</span>
          <div className="step-help-actions">
            <button
              type="button"
              className="btn-quick-ask"
              onClick={() => onQuickAsk('Can you explain this step more simply?')}
            >
              Explain this step
            </button>
            <button
              type="button"
              className="btn-quick-ask"
              onClick={() => onQuickAsk('How do I know when this step is done properly?')}
            >
              How to tell when ready?
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdaptationBanner;
