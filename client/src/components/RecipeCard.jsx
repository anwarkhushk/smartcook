import './RecipeCard.css';

// Curated food photography mapped to existing recipe IDs
const RECIPE_IMAGES = {
  omelette:
    'https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=900&q=80',
  'pasta-aglio':
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80',
  'chicken-karahi':
    'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80',
};

/**
 * RecipeCard — displays an editorial recipe preview on the home screen.
 * Tapping or clicking it opens the cooking view via onSelect(recipe).
 */
function RecipeCard({ recipe, onSelect }) {
  // Derive total timed seconds from existing step data without altering recipe object
  const totalTimedSeconds = recipe.steps.reduce(
    (sum, step) => sum + (step.timerSeconds || 0),
    0
  );
  const timedMinutes = Math.max(1, Math.round(totalTimedSeconds / 60));
  const imageUrl = RECIPE_IMAGES[recipe.id];

  return (
    <button
      type="button"
      className="recipe-card"
      onClick={() => onSelect(recipe)}
    >
      {/* Visual media header */}
      <div className="recipe-card-media">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={recipe.title}
            className="recipe-card-img"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="recipe-card-media-overlay" />
        <span className="recipe-card-emoji" aria-hidden="true">
          {recipe.emoji}
        </span>
        {totalTimedSeconds > 0 && (
          <span className="recipe-card-time-badge">
            ⏱ ~{timedMinutes} min active timer
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="recipe-card-body">
        <h2 className="recipe-card-title">{recipe.title}</h2>
        <p className="recipe-card-desc">{recipe.description}</p>

        {/* Metadata pills derived strictly from existing recipe data */}
        <div className="recipe-card-meta">
          <span className="meta-item">
            <strong>{recipe.steps.length}</strong> steps
          </span>
          <span className="meta-dot" aria-hidden="true">·</span>
          <span className="meta-item">
            <strong>{recipe.servings}</strong> serving
            {recipe.servings > 1 ? 's' : ''}
          </span>
          {recipe.ingredients && (
            <>
              <span className="meta-dot" aria-hidden="true">·</span>
              <span className="meta-item">
                <strong>{recipe.ingredients.length}</strong> ingredients
              </span>
            </>
          )}
        </div>

        {/* Call to action */}
        <div className="recipe-card-cta">
          <span className="cta-label">Begin Guided Cooking</span>
          <span className="cta-arrow" aria-hidden="true">→</span>
        </div>
      </div>
    </button>
  );
}

export default RecipeCard;
