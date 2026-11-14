import './RecipeCard.css';

/**
 * RecipeCard — displays a recipe preview on the home screen.
 * Tapping it opens the cooking view.
 */
function RecipeCard({ recipe, onSelect }) {
  return (
    <button className="recipe-card" onClick={() => onSelect(recipe)}>
      <span className="recipe-card-emoji">{recipe.emoji}</span>
      <h2 className="recipe-card-title">{recipe.title}</h2>
      <p className="recipe-card-desc">{recipe.description}</p>
      <p className="recipe-card-meta">
        {recipe.steps.length} steps · {recipe.servings} serving{recipe.servings > 1 ? 's' : ''}
      </p>
    </button>
  );
}

export default RecipeCard;

