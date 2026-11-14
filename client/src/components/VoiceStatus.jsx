import './VoiceStatus.css';

/**
 * VoiceStatus — voice feedback panel shown during cooking (smartcook mode only).
 *
 * Displays:
 *  - Mic on/off toggle with status indicator
 *  - Live transcript ("I heard: ...")
 *  - Command feedback ("→ Next step") or error ("Did not understand...")
 *  - Optional "Ask AI instead" recovery button on unrecognized phrases
 *  - TTS on/off toggle
 *  - Mic-denied or browser-not-supported errors
 */
function VoiceStatus({
  voice,
  commandFeedback, // { heard, message, isError, canAskAI } | null
  onAskFallback,
}) {
  // Browser doesn't support speech recognition at all
  if (!voice.isSupported) {
    return (
      <div className="voice-bar voice-bar-error">
        <p>🚫 Voice control is not supported in this browser. Use Chrome.</p>
      </div>
    );
  }

  // Mic permission denied or other hard error
  if (voice.error) {
    return (
      <div className="voice-bar voice-bar-error">
        <p>⚠️ {voice.error}</p>
        <p className="voice-hint">Touch and gesture controls still work normally.</p>
      </div>
    );
  }

  return (
    <div className="voice-bar">
      {/* Left: mic toggle + status */}
      <div className="voice-controls">
        <button
          className={`btn-mic ${voice.isListening ? 'mic-on' : 'mic-off'}`}
          onClick={voice.isListening ? voice.stopListening : voice.startListening}
          title={voice.isListening ? 'Turn off mic' : 'Turn on mic'}
        >
          🎤
          <span className="mic-label">
            {voice.isListening ? 'Listening' : 'Mic Off'}
          </span>
        </button>

        <button
          className={`btn-tts ${voice.ttsEnabled ? 'tts-on' : 'tts-off'}`}
          onClick={voice.toggleTts}
          title={voice.ttsEnabled ? 'Turn off read-aloud' : 'Turn on read-aloud'}
        >
          {voice.ttsEnabled ? '🔊' : '🔇'}
          <span className="tts-label">
            {voice.ttsEnabled ? 'Read Aloud' : 'Silent'}
          </span>
        </button>
      </div>

      {/* Right: transcript + feedback */}
      <div className="voice-transcript-area">
        {/* Live interim transcript */}
        {voice.isListening && voice.interimText && (
          <p className="voice-interim">
            🎙️ <em>{voice.interimText}</em>
          </p>
        )}

        {/* Command feedback after a final result */}
        {commandFeedback && (
          <div
            className={`voice-feedback ${
              commandFeedback.isError ? 'feedback-error' : 'feedback-ok'
            }`}
          >
            <p className="voice-heard">I heard: &ldquo;{commandFeedback.heard}&rdquo;</p>
            <p className="voice-result">{commandFeedback.message}</p>
            {onAskFallback && (
              <button
                type="button"
                className="btn-ask-fallback"
                onClick={onAskFallback}
              >
                🧑‍🍳 Send to AI Assistant instead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceStatus;
