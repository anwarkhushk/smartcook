import './GesturePanel.css';

/**
 * GesturePanel — displays the mirrored webcam preview, hand landmark overlay,
 * hold-progress ring, detected gesture label, and the Gesture Guide.
 *
 * When the Adaptation Engine triggers "suggestGestures" (due to room noise
 * or voice failures), the Gesture Guide is visually highlighted.
 */
function GesturePanel({ gesture, highlightGuide = false }) {
  const {
    videoRef,
    canvasRef,
    isCameraReady,
    cameraEnabled,
    toggleCamera,
    error,
    activePose,
    holdProgress,
    distance,
  } = gesture;

  // SVG circle math for the 600ms hold-progress ring
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - holdProgress);

  return (
    <div
      className={`gesture-panel ${highlightGuide ? 'gesture-panel-highlighted' : ''}`}
    >
      {/* Left: Webcam preview + overlay + hold ring */}
      <div className="gesture-camera-box">
        {cameraEnabled && !error ? (
          <div className="camera-stage">
            <video
              ref={videoRef}
              className="gesture-video"
              width="160"
              height="120"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="gesture-canvas"
              width="160"
              height="120"
            />

            {/* Hold-progress ring + active gesture badge */}
            {activePose && (
              <div className="gesture-overlay-badge">
                <svg className="hold-ring" width="44" height="44">
                  <circle
                    className="hold-ring-bg"
                    cx="22"
                    cy="22"
                    r={radius}
                  />
                  <circle
                    className="hold-ring-fill"
                    cx="22"
                    cy="22"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <span className="gesture-pose-text">{activePose}</span>
              </div>
            )}

            {!isCameraReady && (
              <div className="camera-loading">Starting camera…</div>
            )}
          </div>
        ) : (
          <div className="camera-off-box">
            <span>📷 Camera Off</span>
          </div>
        )}

        <div className="camera-meta-row">
          <button
            type="button"
            className="btn-camera-toggle"
            onClick={toggleCamera}
          >
            {cameraEnabled ? '📷 Hide Cam' : '📷 Enable Cam'}
          </button>
          <span className="distance-pill" title="Estimated distance from camera">
            📏 {distance === 'far' ? 'Far' : 'Near'}
          </span>
        </div>

        {error && <p className="gesture-error-text">⚠️ {error}</p>}
      </div>

      {/* Right: Gesture Guide (recognition over recall — Nielsen) */}
      <div className="gesture-guide">
        <div className="gesture-guide-title">
          ✋ Hand Gestures {highlightGuide && <span className="guide-badge">Recommended now!</span>}
        </div>
        <ul className="gesture-guide-list">
          <li>
            <strong>👉 Swipe Right:</strong> Next step
          </li>
          <li>
            <strong>👈 Swipe Left:</strong> Previous step
          </li>
          <li>
            <strong>✋ Hold Open Palm (0.6s):</strong> Pause / Resume timer
          </li>
          <li>
            <strong>👍 Hold Thumbs Up (0.6s):</strong> Mark recipe done
          </li>
        </ul>
      </div>
    </div>
  );
}

export default GesturePanel;
