import { useState } from 'react';
import RecipeCard from './RecipeCard.jsx';
import './HomeScreen.css';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80';

/**
 * HomeScreen — displays the editorial hero section, recipe discovery search/filter,
 * and all available recipes as cards.
 * User taps/clicks a card to start cooking via onSelectRecipe(recipe).
 */
function HomeScreen({ recipes, onSelectRecipe }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Filter recipes purely for visual discovery without mutating underlying recipe objects
  const filteredRecipes = recipes.filter((recipe) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      recipe.title.toLowerCase().includes(query) ||
      recipe.description.toLowerCase().includes(query) ||
      (recipe.ingredients &&
        recipe.ingredients.some((ing) => ing.toLowerCase().includes(query)));

    const matchesCategory =
      activeFilter === 'all' ||
      (activeFilter === 'single' && recipe.servings === 1) ||
      (activeFilter === 'sharing' && recipe.servings >= 2);

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="home-screen">
      {/* Editorial Hero Section */}
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-content">
            <span className="hero-eyebrow">
              Hands-Free Multimodal Culinary Assistant
            </span>
            <h2 className="hero-headline">Cook something remarkable.</h2>
            <p className="hero-subtext">
              Discover recipes, follow guided instructions, and experience a
              smarter way to cook.
            </p>

            <div className="hero-capabilities">
              <span className="capability-pill">🎤 Voice Navigation</span>
              <span className="capability-pill">✋ Air Gestures</span>
              <span className="capability-pill">🧑‍🍳 AI Sous-Chef</span>
              <span className="capability-pill">⚙️ Context-Adaptive UI</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-image-frame">
              <img
                src={HERO_IMAGE}
                alt="Chef preparing fresh ingredients in a warm kitchen"
                className="hero-image"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="hero-image-caption">
                <span className="caption-dot" />
                <span>Designed for messy hands &amp; active kitchens</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recipe Discovery Section */}
      <section className="discovery-section">
        <div className="discovery-header">
          <div className="discovery-titles">
            <span className="discovery-eyebrow">Recipe Collection</span>
            <h2 className="home-title">Choose a Recipe</h2>
          </div>

          {/* Search & Filter Controls */}
          <div className="discovery-controls">
            <div className="search-box">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                className="search-input"
                placeholder="Search recipes or ingredients…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search recipes or ingredients"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn-clear-search"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="filter-pills" role="group" aria-label="Filter recipes by servings">
              <button
                type="button"
                className={`filter-pill ${activeFilter === 'all' ? 'filter-pill-active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                All ({recipes.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${activeFilter === 'single' ? 'filter-pill-active' : ''}`}
                onClick={() => setActiveFilter('single')}
              >
                Single Serving
              </button>
              <button
                type="button"
                className={`filter-pill ${activeFilter === 'sharing' ? 'filter-pill-active' : ''}`}
                onClick={() => setActiveFilter('sharing')}
              >
                Mains &amp; Sharing (2+)
              </button>
            </div>
          </div>
        </div>

        {/* Recipe Card Grid */}
        {filteredRecipes.length > 0 ? (
          <div className="recipe-grid">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onSelect={onSelectRecipe}
              />
            ))}
          </div>
        ) : (
          <div className="empty-discovery">
            <p>No recipes matched &ldquo;{searchQuery}&rdquo;.</p>
            <button
              type="button"
              className="btn-reset-discovery"
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
              }}
            >
              Show All Recipes
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default HomeScreen;
