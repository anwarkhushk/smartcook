import config from '../config.js';

/**
 * logger.js — Central Study & Event Logger for SmartCook (Phase 6)
 *
 * Records structured JSON events with:
 *   - timestamp (ISO 8601)
 *   - participantId (e.g. "P01")
 *   - mode ("baseline" | "smartcook")
 *   - taskName ("Task 1: Find step 5" | "Task 2: Set a 3 minute timer" | "Task 3: Ask the AI a question")
 *   - inputSource ("touch" | "voice" | "gesture" | "ai" | "system")
 *   - action (e.g. "nextStep", "startTimer", "ai_question", "task_start", "task_end", "adaptation_triggered")
 *   - success (boolean: true for valid actions, false for recognition failures/errors)
 *   - adaptation (null or { rule, active, reason })
 *
 * PRIVACY: Never records or stores video or audio. Only anonymous interaction metadata.
 */

export const STUDY_TASKS = [
  'Task 1: Find step 5',
  'Task 2: Set a 3 minute timer',
  'Task 3: Ask the AI a question',
];

const STORAGE_KEY = 'smartcook_study_logs_v1';

// Load any existing session logs from sessionStorage
function loadSavedLogs() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

function saveLogs(logs) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (_e) {
    // Ignore storage quota errors
  }
}

const eventLogs = loadSavedLogs();
const listeners = new Set();

// Current study session metadata
const studySession = {
  participantId: 'P01',
  taskName: STUDY_TASKS[0],
  isTaskRunning: false,
  taskStartTime: null, // ms epoch when Start Task was clicked
  completedTasks: [],  // summary list of { participantId, mode, taskName, durationSeconds, errorCount }
};

function notifyListeners() {
  for (const fn of listeners) {
    fn();
  }
}

/** Subscribe to logger state changes (returns unsubscribe function) */
export function subscribeLogger(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Get current study session state */
export function getStudySession() {
  return { ...studySession, completedTasks: [...studySession.completedTasks] };
}

/** Update participantId or taskName from the Study Control Screen */
export function updateStudySession(updates) {
  Object.assign(studySession, updates);
  notifyListeners();
}

/**
 * Record an anonymous JSON event.
 *
 * @param {string} type — Event category ('action', 'input_failure', 'adaptation_triggered', 'adaptation_cleared', 'task_start', 'task_end', etc.)
 * @param {object} details — Additional event fields
 */
export function logEvent(type, details = {}) {
  // Determine standardized inputSource ('touch' | 'voice' | 'gesture' | 'ai' | 'system')
  const inputSource =
    details.inputSource ||
    details.source ||
    details.modality ||
    (type.startsWith('ai_') ? 'ai' : 'system');

  // Determine standardized action name
  const action =
    details.action ||
    details.rule ||
    type;

  // Determine success boolean (false on input_failure or error, true otherwise)
  const success =
    typeof details.success === 'boolean'
      ? details.success
      : type !== 'input_failure' && type !== 'ai_error';

  // Include structured adaptation info when an adaptation event occurs
  const adaptation =
    type === 'adaptation_triggered' || type === 'adaptation_cleared'
      ? {
          rule: details.rule,
          active: type === 'adaptation_triggered',
          reason: details.reason || null,
        }
      : null;

  const entry = {
    id: eventLogs.length + 1,
    timestamp: new Date().toISOString(),
    participantId: studySession.participantId || 'anonymous',
    mode: config.mode,
    taskName: studySession.taskName,
    eventType: type,
    inputSource,
    action,
    success,
    adaptation,
    ...details,
  };

  eventLogs.push(entry);
  saveLogs(eventLogs);
  notifyListeners();

  console.debug('[SmartCook Log]', entry);
  return entry;
}

/** Start timing the currently selected study task */
export function startStudyTask() {
  if (studySession.isTaskRunning) return;
  studySession.isTaskRunning = true;
  studySession.taskStartTime = Date.now();

  logEvent('task_start', {
    inputSource: 'system',
    action: 'task_start',
    success: true,
    taskName: studySession.taskName,
  });
}

/** End timing the active study task and record its completion time & errors */
export function endStudyTask() {
  if (!studySession.isTaskRunning || !studySession.taskStartTime) return null;

  const endTime = Date.now();
  const durationMs = endTime - studySession.taskStartTime;
  const durationSeconds = Number((durationMs / 1000).toFixed(2));
  const startIso = new Date(studySession.taskStartTime).toISOString();

  // Count how many failures occurred during this task window
  const taskErrors = eventLogs.filter(
    (e) =>
      e.timestamp >= startIso &&
      e.participantId === studySession.participantId &&
      e.mode === config.mode &&
      e.taskName === studySession.taskName &&
      e.success === false
  ).length;

  studySession.isTaskRunning = false;
  studySession.taskStartTime = null;

  const summary = {
    participantId: studySession.participantId,
    mode: config.mode,
    taskName: studySession.taskName,
    durationSeconds,
    durationMs,
    errorCount: taskErrors,
    completedAt: new Date(endTime).toISOString(),
  };

  studySession.completedTasks.push(summary);

  logEvent('task_end', {
    inputSource: 'system',
    action: 'task_end',
    success: true,
    durationSeconds,
    durationMs,
    errorCount: taskErrors,
  });

  return summary;
}

/** Return a copy of all logged events */
export function getEventLogs() {
  return [...eventLogs];
}

/** Clear all stored logs and completed task summaries */
export function clearEventLogs() {
  eventLogs.length = 0;
  studySession.completedTasks = [];
  studySession.isTaskRunning = false;
  studySession.taskStartTime = null;
  saveLogs(eventLogs);
  notifyListeners();
}

/**
 * Trigger a browser download of all logged events as a formatted JSON file.
 */
export function downloadLogsJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    participantId: studySession.participantId,
    completedTasks: studySession.completedTasks,
    totalEvents: eventLogs.length,
    events: eventLogs,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safePid = (studySession.participantId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '');
  a.href = url;
  a.download = `smartcook-logs-${safePid}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
