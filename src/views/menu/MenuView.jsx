import { useState } from "react";
import { INGREDIENTS_BY_ID } from "../../data/ingredients.js";
import { CLASSIC_RECIPES } from "../../data/recipes.js";
import { activeMenu, canCook, isNewRecipe, knowsRecipe } from "../../game/menu.js";
import { appealOf, fairPrice, ingredientCost, toppingsList, PRICE_STEP } from "../../game/pizza.js";
import { levelForXp, menuCapacity } from "../../game/progression.js";
import { formatEuro } from "../../utils/format.js";
import { AppealStars } from "../../components/AppealStars.jsx";
import { Pizza } from "../../components/Pizza.jsx";
import { PriceStepper } from "../../components/PriceStepper.jsx";
import { RecipeEditor } from "./RecipeEditor.jsx";

function RecipeCard({ state, recipe, dispatch, isConfirmingDelete, onAskDelete, onCancelDelete }) {
  const changePrice = (delta) => dispatch({ type: "changePrice", recipeId: recipe.id, delta });
  return (
    <div className="card recipe">
      <Pizza ingredients={recipe.ingredients} baked className="pz" />
      <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="rname">{recipe.name}</span>
          {recipe.custom && <span className="tag">maison</span>}
          {isNewRecipe(state, recipe) && <span className="tag">nouveau</span>}
        </div>
        <div className="hint">{toppingsList(recipe.ingredients)}</div>
        <div className="row">
          <AppealStars appeal={appealOf(recipe.ingredients, recipe.classic)} />
          <span className="hint">
            coût {formatEuro(ingredientCost(recipe.ingredients))} · conseillé {formatEuro(fairPrice(recipe.ingredients))}
          </span>
        </div>
        <div className="row">
          <PriceStepper
            price={recipe.price}
            decreaseLabel={`Baisser le prix de ${recipe.name}`}
            increaseLabel={`Monter le prix de ${recipe.name}`}
            onDecrease={() => changePrice(-PRICE_STEP)}
            onIncrease={() => changePrice(PRICE_STEP)}
          />
          <label className="switch">
            <input
              id={`menu-${recipe.id}`}
              type="checkbox"
              checked={recipe.onMenu}
              onChange={() => dispatch({ type: "toggleOnMenu", recipeId: recipe.id })}
            />
            À la carte
          </label>
          {recipe.custom &&
            (isConfirmingDelete ? (
              <>
                <button
                  className="btn sm primary"
                  onClick={() => {
                    dispatch({ type: "deleteRecipe", recipeId: recipe.id });
                    onCancelDelete();
                  }}
                >
                  Supprimer
                </button>
                <button className="btn sm ghost" onClick={onCancelDelete}>Garder</button>
              </>
            ) : (
              <button className="btn sm ghost" onClick={onAskDelete}>Supprimer…</button>
            ))}
        </div>
      </div>
    </div>
  );
}

function ClassicsToDiscover({ state }) {
  const undiscovered = CLASSIC_RECIPES.filter((classic) => !knowsRecipe(state, classic.id));
  if (!undiscovered.length) return null;
  return (
    <>
      <h3 className="h" style={{ marginTop: 24 }}>Classiques à découvrir</h3>
      <div className="grid2">
        {undiscovered.map((classic) => {
          const missing = classic.ingredients.filter((id) => !state.unlocked[id]);
          return (
            <div key={classic.id} className="card pad locked row" style={{ flexWrap: "nowrap" }}>
              <div className="grow">
                <strong>{classic.name}</strong>
                <div className="hint">
                  Il manque : {missing.map((id) => `${INGREDIENTS_BY_ID[id].name} (niv. ${INGREDIENTS_BY_ID[id].requiredLevel})`).join(", ")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function MenuView({ state, dispatch }) {
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [recipeIdToDelete, setRecipeIdToDelete] = useState(null);
  const level = levelForXp(state.xp);
  const cookableRecipes = state.recipes.filter((recipe) => canCook(state, recipe));
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow">
          <h2 className="h" style={{ margin: 0 }}>La carte</h2>
          <p className="sub">
            {activeMenu(state).length} / {menuCapacity(level)} pizzas proposées. La carte s'agrandit à chaque niveau.
          </p>
        </div>
        <button className="btn primary" onClick={() => setEditorOpen(true)}>Créer une recette</button>
      </div>
      <div className="grid2">
        {cookableRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            state={state}
            recipe={recipe}
            dispatch={dispatch}
            isConfirmingDelete={recipeIdToDelete === recipe.id}
            onAskDelete={() => setRecipeIdToDelete(recipe.id)}
            onCancelDelete={() => setRecipeIdToDelete(null)}
          />
        ))}
      </div>
      <ClassicsToDiscover state={state} />
      {isEditorOpen && <RecipeEditor state={state} dispatch={dispatch} onClose={() => setEditorOpen(false)} />}
    </>
  );
}
