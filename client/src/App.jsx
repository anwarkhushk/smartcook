import { useState } from 'react';
import config from './config.js';
import recipes from './data/recipes.json';
import HomeScreen from './components/HomeScreen.jsx';
import CookingView from './components/CookingView.jsx';
import StudyControlPanel from './components/StudyControlPanel.jsx';
import './App.css';

/**
 * App — root component for SmartCook.
 *
 * Simple state-based routing:
 *   - selectedRecipe is null → show HomeScreen
 *   - selectedRecipe is set  → show CookingView
 *
 * Includes the Phase 6 StudyControlPanel for setting Participant ID,
 * switching between "baseline" and "smartcook" modes, timing tasks,
 * and downloading JSON event logs.
 */
function App() {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [mode, setMode] = useState(config.mode);
  const [showStudyBar, setShowStudyBar] = useState(true);

  const handleModeChange = (newMode) => {
    config.setMode(newMode);
    setMode(newMode);
  };

  return (
    <div className="app">
      {/* Header bar — always visible */}
      <header className="app-header">
        <h1
          className="app-logo"
          onClick={() => setSelectedRecipe(null)}
          title="Back to home"
        >
          🍳 SmartCook
        </h1>

        <div className="header-right">
          <button
            type="button"
            className="btn-study-header"
            onClick={() => setShowStudyBar((s) => !s)}
          >
            📋 {showStudyBar ? 'Hide Study Bar' : 'Show Study Bar'}
          </button>
          <span className="mode-badge">
            {mode === 'baseline' ? 'Baseline Mode' : 'SmartCook Mode'}
          </span>
        </div>
      </header>

      {/* Within-Subject User Study Control Screen / Bar */}
      {showStudyBar && (
        <StudyControlPanel
          currentMode={mode}
          onModeChange={handleModeChange}
        />
      )}

      {/* Main content area */}
      <main className="app-main">
        {selectedRecipe ? (
          <CookingView
            key={`${selectedRecipe.id}-${mode}`}
            recipe={selectedRecipe}
            onExit={() => setSelectedRecipe(null)}
          />
        ) : (
          <HomeScreen
            recipes={recipes}
            onSelectRecipe={setSelectedRecipe}
          />
        )}
      </main>
    </div>
  );
}

export default App;
