import RecipeCard from './RecipeCard.jsx';
import './HomeScreen.css';

/**
 * HomeScreen — displays all available recipes as cards.
 * User taps a card to start cooking.
 */
function HomeScreen({ recipes, onSelectRecipe }) {
  return (
    <div className="home-screen">
      <h2 className="home-title">Choose a Recipe</h2>
      <div className="recipe-grid">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onSelect={onSelectRecipe}
          />
        ))}
      </div>
    </div>
  );
}

export default HomeScreen;

