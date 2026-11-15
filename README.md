# 🍳 SmartCook
### A Hands-Free Multimodal Recipe Assistant

**Created with dedication by Muhammad Anwar and Syed Musawir Ali Shah.**

![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4.19-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518.0.0-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18.2-000000?logo=express&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks_Vision_0.10.34-00A699?logo=google&logoColor=white)
![Groq API](https://img.shields.io/badge/Groq-OpenAI_Compatible_API-F55036)
![Python](https://img.shields.io/badge/Python-Pandas_%26_SciPy-3776AB?logo=python&logoColor=white)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Application Modes](#application-modes)
5. [Project Structure](#project-structure)
6. [Installation and Setup](#installation-and-setup)
7. [Environment Variables](#environment-variables)
8. [Study and Evaluation](#study-and-evaluation)
9. [Screenshots](#screenshots)
10. [Future Improvements](#future-improvements)
11. [Contributors](#contributors)

---

## Project Overview

**SmartCook** is a full-stack, multimodal recipe assistant built as a university Human-Computer Interaction (HCI) research project by **Muhammad Anwar** and **Syed Musawir Ali Shah**. Cooking in a real kitchen frequently leaves a user's hands wet, flour-coated, or occupied with utensils, making traditional touchscreens inconvenient and unhygienic to operate.

SmartCook addresses this problem by combining five coordinated interaction and adaptation layers into a single web workspace:

- **Touch Interactions**: Large, high-contrast buttons for navigating steps, controlling countdown timers, confirming risky actions, and undoing recent actions.
- **Voice Commands**: Continuous speech recognition via the browser's Web Speech API (`SpeechRecognition`) paired with text-to-speech (`speechSynthesis`) step read-aloud.
- **Hand Gesture Recognition**: Real-time, client-side webcam hand tracking powered by `@mediapipe/tasks-vision` (`GestureRecognizer`) supporting static pose holds and horizontal hand swipes without uploading video frames to any server.
- **AI-Powered Cooking Assistant**: Context-aware question answering backed by an Express proxy to the Groq Chat Completions API, automatically enriched with the active recipe title and current step instruction.
- **Adaptive User Interface**: A deterministic, rule-based adaptation engine (`adaptationEngine.js`) that monitors user distance from the webcam, ambient microphone noise level (via the Web Audio API `AnalyserNode`), consecutive input failures, and time spent on a step to dynamically adjust UI sizing and surface contextual guidance.

### Baseline Mode vs. SmartCook Mode

To support controlled within-subject HCI evaluation, the application operates in two distinct modes selectable via URL parameter (`?mode=baseline` or `?mode=smartcook`) or through the built-in Study Control Bar:

- **Baseline Mode (`?mode=baseline`)**: Restricts interaction strictly to standard touch/mouse controls and countdown timers. Voice recognition, camera gesture recognition, the AI cooking assistant, and the adaptive UI engine are completely disabled.
- **SmartCook Mode (`?mode=smartcook`)**: Enables the full multimodal and adaptive experience—touch, voice commands, text-to-speech read-aloud, MediaPipe hand gestures, the Groq AI cooking assistant, and real-time context adaptation.

---

## Features

### Recipe Selection & Discovery
- **Curated Recipe Catalog**: Includes three structured multi-step recipes in `client/src/data/recipes.json`:
  - **Classic Omelette** (7 steps, 1 serving, timed steps)
  - **Pasta Aglio e Olio** (8 steps, 2 servings, timed steps)
  - **Chicken Karahi** (8 steps, 4 servings, timed steps)
- **Search & Servings Filter**: Filter recipes on the homepage in real time by recipe title or ingredient keyword, and filter by serving size (`All Recipes`, `Quick Single (1 Serving)`, `2+ Servings`, `Family Size (4+ Servings)`).
- **Rich Recipe Cards**: Displays total step count, serving count, ingredient count, and total active timer duration computed from each recipe's `timerSeconds` metadata.

### Step-by-Step Cooking Instructions & Progress Tracking
- **Segmented Progress Bar**: Visualizes completed steps, the currently active step, and upcoming steps, alongside a remaining-step counter.
- **Contextual Ingredient Strip**: Collapsible ingredient drawer that automatically highlights ingredients mentioned in the currently active step text.
- **Countdown Timer with Web Audio Alert**: Steps with `timerSeconds` automatically initialize the step timer; users can also start custom timers by voice (e.g., *"start a 3 minute timer"*). When a timer reaches `00:00`, the browser synthesizes a triple-beep alert using the Web Audio API (`AudioContext`).
- **Safety Confirmation & Undo Stack**: Destructive or premature actions—such as restarting a recipe mid-way or marking a recipe done before the final step—trigger an explicit confirmation bar (`Yes, confirm` / `Cancel`). A 10-entry history stack supports one-step `Undo` across touch and voice.

### Voice-Based Navigation & Speech Synthesis
- **Forgiving Command Parser (`parseVoiceCommand.js`)**: Matches natural spoken phrases using keyword and regex rules:
  - **Navigation**: `"next"`, `"next step"`, `"back"`, `"previous"`, `"go back"`, `"repeat"`, `"read again"`
  - **Timers**: `"start timer"`, `"set a 3 minute timer"`, `"timer for 45 seconds"`, `"pause timer"`, `"stop timer"`
  - **Session & Safety**: `"undo"`, `"restart"`, `"start over"`, `"done"`, `"finish"`, `"yes"` / `"confirm"`, `"no"` / `"cancel"`
- **Spoken Question Routing**: Utterances starting with question words (`how`, `what`, `why`, `can I`, `should I`, `instead of`, etc.) are automatically routed to the AI Cooking Assistant and answered aloud.
- **Self-Trigger Prevention**: When `Read Aloud` (TTS) is enabled, the microphone automatically pauses while the browser speaks and resumes 500 ms after speech synthesis ends.
- **One-Click Voice Recovery**: If an utterance is not recognized as a command, a recovery button (`"Ask AI: ..."` / `"Send to AI Assistant instead"`) lets the user forward the exact transcript to the AI assistant.

### Gesture-Based Navigation
- **Local MediaPipe Hand Tracking (`useGesture.js`)**: Runs Google's `GestureRecognizer` (`@mediapipe/tasks-vision`) entirely in the browser at ~15 frames per second with a mirrored webcam preview and landmark skeleton overlay.
- **Supported Hand Gestures**:

| Gesture | Detection Method | Action Triggered |
|---|---|---|
| **Swipe Right** (`👋 →`) | Wrist (`landmark[0].x`) horizontal displacement > 22% of frame width within 500 ms | Next Step (`nextStep`) |
| **Swipe Left** (`← 👋`) | Wrist (`landmark[0].x`) horizontal displacement > 22% of frame width within 500 ms | Previous Step (`prevStep`) |
| **Open Palm** (`✋`) | Static pose held for 600 ms with circular SVG progress ring | Start / Pause / Resume Timer |
| **Thumbs Up** (`👍`) | Static pose held for 600 ms with circular SVG progress ring | Mark Recipe Done (`markDone`) |

- **False-Positive Guardrails**: Enforces a minimum confidence threshold (`0.65`), a 600 ms pose hold duration (`POSE_HOLD_MS`), and a 1500 ms post-trigger cooldown (`GESTURE_COOLDOWN_MS`).
- **Hand-Size Distance Estimation**: Estimates whether the user is `"near"` or `"far"` from the screen using the 2D bounding-box span of the 21 hand landmarks (`FAR_HAND_SIZE_THRESHOLD = 0.14`, `NEAR_HAND_SIZE_THRESHOLD = 0.18`).

### AI Cooking Assistant
- **Context-Aware Q&A (`useAskAI.js` + `server/server.js`)**: Sends the user's question along with `recipeTitle` and `currentStep` to `POST /api/ask`.
- **Resilient Backend Proxy**: Uses Node's built-in `fetch` to call Groq's OpenAI-compatible endpoint (`https://api.groq.com/openai/v1/chat/completions`) with a 10-second `AbortController` timeout, per-client rate limiting (10 requests per 60 seconds), and automatic retry with backoff (up to 2 retries after 1 s and 2 s on HTTP 429 or 5xx errors).

### Context-Aware Adaptive Interface
- **Five Plain `if-then` Rules (`adaptationEngine.js`)**:

| Rule Key | Trigger Condition | UI Adaptation |
|---|---|---|
| `largeUi` | User distance estimated as `"far"` | Enlarges step instruction font size and control button dimensions (`.cooking-view--large`) |
| `suggestGestures` | Ambient noise level ≥ 35 (`isNoisy`) OR consecutive voice failures ≥ 2 | Displays an adaptation pill suggesting hand gestures and highlights the Gesture Guide card |
| `suggestVoiceOrTouch` | Consecutive gesture failures ≥ 3 OR `lowLight` flag active | Displays an adaptation pill recommending voice commands or touch controls |
| `showHelpCard` | Total recent input failures (`voiceFailures + gestureFailures`) ≥ 4 | Opens the Quick Command Reference card listing voice and gesture commands |
| `offerStepHelp` | Time spent on the current step ≥ 45 seconds (`LONG_STEP_SECONDS`) | Surfaces a prompt offering to pre-fill a question for the AI Cooking Assistant |

- **Anti-Flicker Hysteresis & User Control**: Active adaptations remain latched for a minimum of 4000 ms (`ADAPTATION_HOLD_MS`) after a sensor condition clears, and ambient noise detection applies a 2000 ms hold (`NOISE_HOLD_MS`) with dual thresholds (`35` high / `25` low). Users can toggle **Adaptive Mode: ON/OFF** at any time, and examiners can simulate sensor states using the collapsible **Viva Test Controls** panel.

### Task Management & Study Event Logging
- **Built-In Study Control Bar (`StudyControlPanel.jsx`)**: Allows researchers to set a `Participant ID`, switch between `SmartCook` and `Baseline` modes, select one of three standardized evaluation tasks, and record task execution times with `Start Task` and `End Task` buttons.
- **Privacy-Preserving Telemetry (`logger.js`)**: Logs structured JSON events (`action`, `input_failure`, `adaptation_triggered`, `ai_question`, `task_start`, `task_end`, `mode_change`, `recipe_selected`) to `sessionStorage` and exports them via a one-click **Download logs (JSON)** button. Raw audio and video are never recorded or transmitted.

---

## Technology Stack

All technologies listed below are verified from `client/package.json`, `server/package.json`, and `analysis/requirements.txt`:

| Category | Technology | Version / Details | Purpose |
|---|---|---|---|
| **Frontend Framework** | React (`react`, `react-dom`) | `^18.2.0` | Component UI, custom hooks, and state management |
| **Build Tool & Dev Server** | Vite (`vite`, `@vitejs/plugin-react`) | `^5.4.19` | Frontend bundling, HMR, and `/api` proxy to port `3001` |
| **Backend Runtime & Framework** | Node.js (ES Modules) + Express (`express`) | Node `≥ 18`, Express `^4.18.2` | REST API server (`GET /api/health`, `POST /api/ask`) |
| **Backend Utilities** | `cors`, `dotenv`, built-in `fetch` | `cors ^2.8.5`, `dotenv ^16.3.1` | Cross-origin support, `.env` loading, and HTTP requests |
| **AI Integration** | Groq Chat Completions API | Default model: `llama-3.1-8b-instant` | Concise 1–3 sentence cooking answers with recipe context |
| **Voice Recognition & TTS** | Web Speech API | Browser native (`SpeechRecognition`, `speechSynthesis`) | Continuous speech-to-text command parsing and step read-aloud |
| **Ambient Noise Sensing** | Web Audio API | Browser native (`AudioContext`, `AnalyserNode`, `OscillatorNode`) | Local RMS microphone volume metering (0–100) and timer alert beeps |
| **Gesture Recognition** | MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) | `^0.10.34` | In-browser hand landmark detection, pose classification, and wrist swipe tracking |
| **Styling** | Plain CSS with Custom Properties | Dark Culinary Design System | Component-scoped stylesheets, responsive layouts, and adaptive `.cooking-view--large` scaling |
| **Statistical Analysis** | Python 3, `pandas`, `scipy` | `pandas >= 2.0.0`, `scipy >= 1.10.0` | Paired t-test, Wilcoxon signed-rank test, and SUS score calculation (`analysis/analyze.py`) |

---

## Application Modes

SmartCook supports two runtime modes controlled by `client/src/config.js` and the Study Control Bar:

| Capability | Baseline Mode (`?mode=baseline`) | SmartCook Mode (`?mode=smartcook`) |
|---|---|---|
| **Touch / Mouse Step Navigation** | Enabled | Enabled |
| **Recipe Search & Servings Filter** | Enabled | Enabled |
| **Step Countdown Timer & Audio Beep** | Enabled | Enabled |
| **Safety Confirmations & Undo** | Enabled | Enabled |
| **Study Control Bar & JSON Event Logging** | Enabled | Enabled |
| **Web Speech API Voice Commands** | Disabled | Enabled |
| **Text-to-Speech (TTS) Read-Aloud** | Disabled | Enabled |
| **MediaPipe Webcam Hand Gestures** | Disabled | Enabled |
| **Groq AI Cooking Assistant (`/api/ask`)** | Disabled | Enabled |
| **Context-Aware Adaptive UI Engine** | Disabled | Enabled |

- **Baseline Mode**: Designed as the control condition for usability studies. All recipe steps, timers, and touch buttons function identically, while all multimodal and adaptive panels are hidden.
- **SmartCook Mode**: The default experimental condition enabling hands-free voice, webcam gestures, AI Q&A, and automatic UI adaptation.

---

## Project Structure

```text
smartcook/
├── client/                              # React + Vite frontend application
│   ├── index.html                       # HTML entry point & Google Fonts imports
│   ├── package.json                     # Frontend dependencies & Vite scripts
│   ├── vite.config.js                   # Vite config (port 5173, proxies /api -> localhost:3001)
│   └── src/
│       ├── main.jsx                     # React DOM root renderer
│       ├── App.jsx                      # Top-level state, header, Study Bar toggle, and view router
│       ├── App.css                      # Header, mode badge, and main container styles
│       ├── index.css                    # Global CSS custom properties (Dark Culinary theme) & resets
│       ├── config.js                    # Mode detection (?mode=) and gesture/adaptation thresholds
│       ├── data/
│       │   └── recipes.json             # 3 built-in recipes with ingredients, steps, and timerSeconds
│       ├── hooks/
│       │   ├── useCookingActions.js     # Central dispatcher for touch/voice/gesture actions, undo, & safety guards
│       │   ├── useTimer.js              # Countdown timer hook with Web Audio API triple-beep alert
│       │   ├── useVoice.js              # Web Speech API continuous recognition & speechSynthesis TTS hook
│       │   ├── useGesture.js            # MediaPipe GestureRecognizer, swipe tracker, & hand-distance estimator
│       │   ├── useNoiseLevel.js         # Web Audio AnalyserNode local RMS volume meter with hysteresis
│       │   └── useAskAI.js              # Client hook for POST /api/ask requests
│       ├── utils/
│       │   ├── parseVoiceCommand.js     # Keyword/regex voice command parser & question detector
│       │   ├── adaptationEngine.js      # 5-rule context adaptation engine with 4-second hysteresis
│       │   └── logger.js                # Study session manager, JSON event logger, & file exporter
│       └── components/
│           ├── HomeScreen.jsx / .css    # Editorial hero section, search/filter bar, and recipe card grid
│           ├── RecipeCard.jsx / .css    # Recipe preview card with timer badge and metadata
│           ├── CookingView.jsx / .css   # Step workspace, progress track, ingredient strip, timer, & action bar
│           ├── AdaptationBanner.jsx/.css# Adaptive Mode toggle, sensor badges, Viva simulator, & help cards
│           ├── GesturePanel.jsx / .css  # Webcam preview, landmark canvas, SVG hold ring, & Gesture Guide
│           ├── AskPanel.jsx / .css      # AI Cooking Assistant text input and answer card
│           ├── VoiceStatus.jsx / .css   # Bottom voice bar, mic/TTS toggles, transcript, & AI fallback button
│           └── StudyControlPanel.jsx/.css# HCI study toolbar (Participant ID, Mode, Task timer, Results table)
├── server/                              # Node.js + Express backend proxy
│   ├── server.js                        # Express server (GET /api/health, POST /api/ask via Groq API)
│   ├── test-ai-reliability.js           # Automated Node test suite for retry logic & input validation
│   ├── .env.example                     # Server environment variable template
│   └── package.json                     # Backend dependencies & npm scripts (dev, start, test)
├── analysis/                            # Python HCI study evaluation toolkit
│   ├── analyze.py                       # Computes task metrics, paired t-test, Wilcoxon test, & SUS scores
│   ├── sample_logs.json                 # Sample multi-participant JSON event log for testing analyze.py
│   ├── sample_sus.csv                   # Sample 10-item System Usability Scale (SUS) questionnaire CSV
│   └── requirements.txt                 # Python dependencies (pandas, scipy)
├── .env.example                         # Root environment variable template
├── .gitignore                           # Git ignore rules (node_modules, .env, client/dist)
└── README.md                            # Project documentation
```

---

## Installation and Setup

### Prerequisites
- **Node.js** `>= 18.0.0` (required for built-in `fetch` and ES Modules) and **npm**
- **Google Chrome** (recommended for full `webkitSpeechRecognition` Web Speech API and webcam `getUserMedia` support)
- **Groq API Key** (free developer key from [https://console.groq.com/keys](https://console.groq.com/keys)) for the AI Cooking Assistant
- **Python 3.9+** *(optional, required only if running `analysis/analyze.py` for statistical study analysis)*

### 1. Clone the Repository
```bash
git clone <repository-url>
cd smartcook
```

### 2. Install Frontend Dependencies
```bash
cd client
npm install
```

### 3. Install Backend Dependencies
```bash
cd ../server
npm install
```

### 4. Configure Environment Variables
Copy the example environment file in `server/` and add your Groq API key:
```bash
cd server
cp .env.example .env
```
Open `server/.env` in your editor and replace `your_groq_key_here` with your actual key (see [Environment Variables](#environment-variables) below).

### 5. Start the Backend Server
From the `server/` directory:
```bash
npm run dev
```
The Express server will start on **`http://localhost:3001`** (with `node --watch server.js` for automatic reloading).

### 6. Start the Frontend Development Server
Open a second terminal and run from the `client/` directory:
```bash
cd client
npm run dev
```
The Vite development server will start on **`http://localhost:5173`** and automatically proxy `/api` requests to `http://localhost:3001`.

### 7. Open the Application in Google Chrome
- **SmartCook Mode (Default)**: `http://localhost:5173` (or `http://localhost:5173?mode=smartcook`)
- **Baseline Mode**: `http://localhost:5173?mode=baseline`

### 8. Run Backend Verification Tests (Optional)
```bash
cd server
npm test
```

---

## Environment Variables

The backend reads its configuration from `server/.env` using `dotenv`. Both `server/.env.example` and the root `.env.example` provide the following template:

```env
# Copy this file to server/.env and fill in your Groq API key
# Get your key from: https://console.groq.com/keys
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=
PORT=3001
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | **Yes** (for AI Q&A) | None | Secret API key authenticating requests to `https://api.groq.com/openai/v1/chat/completions`. Never sent to the browser. |
| `GROQ_MODEL` | No | `llama-3.1-8b-instant` | Groq model identifier used for cooking Q&A responses. |
| `PORT` | No | `3001` | Local TCP port on which the Express backend listens. |

> **Security Note**: `.env` is listed in `.gitignore` so credentials are never committed to version control. If `GROQ_API_KEY` is missing or left as a placeholder (`your_groq_key_here` or `PASTE_YOUR_KEY_HERE`), the server logs a startup warning instead of crashing and returns an informative error if `/api/ask` is called.

---

## Study and Evaluation

SmartCook includes an end-to-end HCI evaluation workflow designed for within-subject comparisons between **Baseline Mode** and **SmartCook Mode**.

### 1. In-App Study Control Bar (`StudyControlPanel.jsx`)
Located below the main navigation bar (can be collapsed/expanded via the **Study Bar** button in the header):
- **Participant ID**: Text field (e.g., `P01`, `P02`) tagged onto every logged event.
- **Mode Selector**: Switches live between `SmartCook (Multimodal)` and `Baseline (Touch Only)` without losing study session data.
- **Standardized Study Tasks**:
  - `Task 1: Find step 5`
  - `Task 2: Set a 3 minute timer`
  - `Task 3: Ask the AI a question`
- **Task Timing (`Start Task` / `End Task`)**: Records `task_start` and `task_end` events with elapsed duration (`durationSeconds`, `durationMs`) and counts all `input_failure` events that occurred during the task window.
- **In-App Study Results Table**: Clicking **Results (N)** opens a live summary table comparing completed tasks by Participant, Mode, Task Name, Duration (s), and Errors.

### 2. Event Log Schema & JSON Export (`logger.js`)
Clicking **Download logs (JSON)** downloads a timestamped file (`smartcook-logs-<participantId>-<timestamp>.json`) containing:
- `exportedAt`: ISO-8601 export timestamp
- `studySession`: Active participant metadata and array of `completedTasks`
- `totalEvents`: Total count of recorded events
- `events`: Array of structured event objects containing `id`, `timestamp`, `participantId`, `mode`, `taskName`, `eventType`, `inputSource` (`touch` | `voice` | `gesture` | `ai` | `system`), `action`, `success`, and `adaptation` details.

### 3. Statistical Analysis Script (`analysis/analyze.py`)
The `analysis/` directory provides a Python script that ingests exported JSON logs and System Usability Scale (SUS) questionnaire CSVs:
- Computes **Mean and Standard Deviation** of task completion time (seconds) and input error count per mode (`baseline` vs. `smartcook`), overall and per task.
- Runs a **Paired t-test** (`scipy.stats.ttest_rel`) and a non-parametric **Wilcoxon signed-rank test** (`scipy.stats.wilcoxon`) across paired participant means.
- Computes standard **System Usability Scale (SUS)** scores (0–100 Brooke formula) per participant and per mode from a 10-item Likert CSV (`q1`–`q10`).

Run the analysis script on the included sample dataset or your own exported logs:
```bash
pip install -r analysis/requirements.txt
python3 analysis/analyze.py --logs analysis/sample_logs.json --sus analysis/sample_sus.csv
```

---

## Screenshots

No screenshot image files are currently stored in the repository. Add your captured images and replace `<path-to-image>` in the Markdown placeholders below:

| View | Markdown Placeholder | Description |
|---|---|---|
| **Homepage & Hero** | `![SmartCook Homepage](<path-to-image>)` | Editorial hero section, search/servings filter bar, and recipe cards (`Classic Omelette`, `Pasta Aglio e Olio`, `Chicken Karahi`). |
| **Cooking Workspace** | `![Cooking Workspace](<path-to-image>)` | Segmented step-progress bar, highlighted ingredient reference strip, active step card, and tabular countdown timer. |
| **Gesture & Adaptive UI** | `![Gesture and Adaptive UI](<path-to-image>)` | Mirrored MediaPipe hand-landmark overlay, SVG pose-hold ring, and context-aware Adaptation Banner with Viva Test Controls. |
| **HCI Study Control Bar** | `![Study Control Bar](<path-to-image>)` | Researcher toolbar with Participant ID input, Mode switcher, Task stopwatch, and Study Results summary table. |

---

## Future Improvements

The following enhancements represent proposed future work beyond the currently implemented system:

- **Custom Recipe Import & Persistence**: Allow users to import recipes from external URLs or create custom recipes stored in a database rather than the static `client/src/data/recipes.json` catalog.
- **Expanded Custom Gesture Vocabulary**: Train custom MediaPipe gesture classifiers for additional kitchen actions such as repeating a step aloud or scrolling the ingredient list.
- **True Ambient Luminance Estimation**: Compute average pixel luminance directly from webcam video frames to drive the `lowLight` adaptation input automatically alongside the existing Viva simulation toggle.
- **Wake-Word Activation**: Add a local wake-word detector (e.g., *"Hey SmartCook"*) before processing voice commands to further reduce accidental speech triggers in multi-person kitchens.
- **Multi-Timer Concurrency**: Support running multiple named timers simultaneously when preparing complex multi-dish meals.

---

## Contributors

This project was designed, engineered, and documented equally by its two creators:

### Muhammad Anwar
Project Co-Creator

### Syed Musawir Ali Shah
Project Co-Creator
