import { useState } from 'react';
import './AskPanel.css';

/**
 * AskPanel — AI cooking assistant UI.
 *
 * Shows a text input + "Ask" button so the user can type a question
 * (fallback when voice isn't working or in noisy kitchens).
 * Displays: "Thinking..." state, the AI answer, or an error message.
 *
 * Only rendered in smartcook mode.
 */
function AskPanel({ ai, onAsk }) {
  const [inputText, setInputText] = useState('');

  /** Submit the typed question */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim() && !ai.isAsking) {
      onAsk(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="ask-panel">
      {/* Text input + Ask button */}
      <form className="ask-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="ask-input"
          placeholder="Ask a cooking question…"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={ai.isAsking}
        />
        <button
          type="submit"
          className="btn btn-ask"
          disabled={ai.isAsking || !inputText.trim()}
        >
          Ask
        </button>
      </form>

      {/* Thinking spinner */}
      {ai.isAsking && (
        <div className="ask-thinking">
          <span className="thinking-dot">●</span>
          <span className="thinking-dot">●</span>
          <span className="thinking-dot">●</span>
          <span>&nbsp;Thinking…</span>
        </div>
      )}

      {/* AI answer card */}
      {ai.answer && (
        <div className="ask-answer">
          <div className="answer-header">
            <span>🧑‍🍳 AI Assistant</span>
            <button
              className="btn-close-answer"
              onClick={ai.clearAnswer}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
          <p className="answer-text">{ai.answer}</p>
        </div>
      )}

      {/* Error message */}
      {ai.error && !ai.isAsking && (
        <div className="ask-error">
          <p>⚠️ {ai.error}</p>
        </div>
      )}
    </div>
  );
}

export default AskPanel;

