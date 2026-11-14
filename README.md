# 🍳 SmartCook – Hands-Free Multimodal Recipe Assistant

A university HCI project: a web app that lets users cook with messy hands using **voice**, **hand gestures**, or **touch**. An AI assistant answers cooking questions, and an adaptation engine adjusts the UI based on context.

## Project Structure

```
smartcook/
├── client/               # React frontend (Vite)
│   ├── src/
│   │   ├── main.jsx      # Entry point – renders <App />
│   │   ├── App.jsx       # Root component, reads ?mode= param
│   │   ├── App.css        # App layout styles
│   │   └── index.css      # Global reset & base styles
│   ├── index.html         # HTML shell
│   ├── vite.config.js     # Vite config with /api proxy
│   └── package.json
├── server/               # Express backend (API proxy)
│   ├── server.js          # Express app with /api/health and /api/chat
│   ├── .env.example       # Template for environment variables
│   └── package.json
├── .gitignore
├── .env.example           # Top-level env template
└── README.md              # ← You are here
```

## Prerequisites

- **Node.js** ≥ 18
- **Google Chrome** (for webcam/mic access)
- A **Gemini API key** (get one at https://aistudio.google.com/app/apikey)

## Setup & Run

### 1. Install dependencies

```bash
# From the project root
cd client && npm install
cd ../server && npm install
```

### 2. Configure the API key

```bash
cd server
cp .env.example .env
# Edit .env and paste your GEMINI_API_KEY
```

### 3. Start the backend

```bash
cd server
npm run dev
# → Server runs on http://localhost:3001
```

### 4. Start the frontend (in a separate terminal)

```bash
cd client
npm run dev
# → App runs on http://localhost:5173
```

### 5. Open in Chrome

- **SmartCook mode** (default): http://localhost:5173
- **Baseline mode**: http://localhost:5173?mode=baseline

## Study Modes

| Mode | URL | Features |
|------|-----|----------|
| **SmartCook** | `?mode=smartcook` | Voice, gestures, AI chat, adaptation |
| **Baseline** | `?mode=baseline` | Touch only, no AI/voice/gesture/adaptation |

## Privacy

- No video or audio is stored or uploaded
- Camera frames are processed locally in the browser
- Only anonymous event logs are kept

