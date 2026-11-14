import { useState, useEffect } from 'react';
import config from '../config.js';
import {
  STUDY_TASKS,
  getStudySession,
  updateStudySession,
  startStudyTask,
  endStudyTask,
  getEventLogs,
  clearEventLogs,
  downloadLogsJson,
  subscribeLogger,
} from '../utils/logger.js';
import './StudyControlPanel.css';

/**
 * StudyControlPanel — Within-Subject User Study Controller (Phase 6)
 *
 * Lets the experimenter / student:
 *  - Enter a Participant ID (e.g. "P01")
 *  - Switch between "baseline" and "smartcook" modes
 *  - Select the active study task:
 *      * Task 1: Find step 5
 *      * Task 2: Set a 3 minute timer
 *      * Task 3: Ask the AI a question
 *  - Click "Start Task" and "End Task" to record task completion time & errors
 *  - Download all recorded JSON event logs ("Download logs (JSON)")
 */
function StudyControlPanel({ currentMode, onModeChange }) {
  const [session, setSession] = useState(getStudySession);
  const [logs, setLogs] = useState(getEventLogs);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Subscribe to logger updates
  useEffect(() => {
    return subscribeLogger(() => {
      setSession(getStudySession());
      setLogs(getEventLogs());
    });
  }, []);

  // Live stopwatch while a task is running
  useEffect(() => {
    if (!session.isTaskRunning || !session.taskStartTime) {
      setElapsedSec(0);
      return;
    }

    const interval = setInterval(() => {
      const sec = (Date.now() - session.taskStartTime) / 1000;
      setElapsedSec(sec);
    }, 100);

    return () => clearInterval(interval);
  }, [session.isTaskRunning, session.taskStartTime]);

  const handleParticipantChange = (e) => {
    updateStudySession({ participantId: e.target.value });
  };

  const handleTaskChange = (e) => {
    updateStudySession({ taskName: e.target.value });
  };

  const handleModeSelect = (e) => {
    const newMode = e.target.value;
    config.setMode(newMode);
    onModeChange(newMode);
  };

  return (
    <section className="study-panel" aria-label="User Study Control Panel">
      <div className="study-bar-main">
        {/* Participant ID */}
        <label className="study-field">
          <span className="study-label">Participant ID:</span>
          <input
            type="text"
            className="study-input"
            value={session.participantId}
            onChange={handleParticipantChange}
            placeholder="e.g. P01"
            disabled={session.isTaskRunning}
          />
        </label>

        {/* Mode Selector */}
        <label className="study-field">
          <span className="study-label">Mode:</span>
          <select
            className="study-select"
            value={currentMode}
            onChange={handleModeSelect}
            disabled={session.isTaskRunning}
          >
            <option value="smartcook">smartcook (Multimodal + Adaptive)</option>
            <option value="baseline">baseline (Touch Only)</option>
          </select>
        </label>

        {/* Task Selector */}
        <label className="study-field">
          <span className="study-label">Task:</span>
          <select
            className="study-select"
            value={session.taskName}
            onChange={handleTaskChange}
            disabled={session.isTaskRunning}
          >
            {STUDY_TASKS.map((task) => (
              <option key={task} value={task}>
                {task}
              </option>
            ))}
          </select>
        </label>

        {/* Start / End Task buttons + Live Stopwatch */}
        <div className="study-task-controls">
          {!session.isTaskRunning ? (
            <button
              type="button"
              className="btn-study btn-task-start"
              onClick={startStudyTask}
            >
              ▶ Start Task
            </button>
          ) : (
            <button
              type="button"
              className="btn-study btn-task-end"
              onClick={endStudyTask}
            >
              ⏹ End Task ({elapsedSec.toFixed(1)}s)
            </button>
          )}
        </div>

        {/* Download Logs (JSON) & Details toggle */}
        <div className="study-actions">
          <button
            type="button"
            className="btn-study btn-download-logs"
            onClick={downloadLogsJson}
            title="Download anonymous JSON event logs"
          >
            ⬇ Download logs (JSON) ({logs.length})
          </button>

          <button
            type="button"
            className="btn-study btn-toggle-logs"
            onClick={() => setShowDetails((prev) => !prev)}
          >
            {showDetails ? '▲ Hide Log Table' : '📊 View Study Results'}
          </button>
        </div>
      </div>

      {/* Expandable Study Results & Event Inspector */}
      {showDetails && (
        <div className="study-details-drawer">
          <div className="study-details-header">
            <h3>📋 Recorded Task Runs ({session.completedTasks.length})</h3>
            {logs.length > 0 && (
              <button
                type="button"
                className="btn-clear-logs"
                onClick={() => {
                  if (window.confirm('Clear all recorded study logs?')) {
                    clearEventLogs();
                  }
                }}
              >
                🗑 Clear All Logs
              </button>
            )}
          </div>

          {session.completedTasks.length === 0 ? (
            <p className="study-empty">
              No completed tasks yet. Click <strong>▶ Start Task</strong>, perform the task, and click <strong>⏹ End Task</strong>.
            </p>
          ) : (
            <table className="study-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Mode</th>
                  <th>Task</th>
                  <th>Time (s)</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {session.completedTasks.map((t, idx) => (
                  <tr key={idx}>
                    <td>{t.participantId}</td>
                    <td>
                      <span className={`tag-mode tag-${t.mode}`}>{t.mode}</span>
                    </td>
                    <td>{t.taskName}</td>
                    <td>
                      <strong>{t.durationSeconds}s</strong>
                    </td>
                    <td>{t.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

export default StudyControlPanel;
