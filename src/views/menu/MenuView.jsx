import { useState } from "react";
import { INGREDIENTS_BY_ID } from "../../data/ingredients.js";
import { CLASSIC_RECIPES } from "../../data/recipes.js";
import { activeMenu, canCook, isNewRecipe, knowsRecipe } from "../../game/menu.js";
import { appealOf, fairPrice, ingredientCost, PRICE_STEP } from "../../game/pizza.js";
import { levelForXp, menuCapacity } from "../../game/progression.js";
import { useTranslation } from "../../i18n/I18nContext.jsx";
import { AppealStars } from "../../components/AppealStars.jsx";
import { Pizza } from "../../components/Pizza.jsx";
import { PriceStepper } from "../../components/PriceStepper.jsx";
import { RecipeEditor } from "./RecipeEditor.jsx";

function RecipeCard({ state, recipe, dispatch, isConfirmingDelete, onAskDelete, onCancelDelete }) {
  const t = useTranslation();
  const name = t.recipe(recipe);
  const changePrice = (delta) => dispatch({ type: "changePrice", recipeId: recipe.id, delta });
  return (
    <div className="card recipe">
      <Pizza ingredients={recipe.ingredients} baked className="pz" />
      <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="rname">{name}</span>
          {recipe.custom && <span className="tag">{t("menu.homemade")}</span>}
          {isNewRecipe(state, recipe) && <span className="tag">{t("common.new")}</span>}
        </div>
        <div className="hint">{t.toppings(recipe.ingredients)}</div>
        <div className="row">
          <AppealStars appeal={appealOf(recipe.ingredients, recipe.classic)} />
          <span className="hint">
            {t("menu.costAndAdvice", { cost: ingredientCost(recipe.ingredients), fair: fairPrice(recipe.ingredients) })}
          </span>
        </div>
        <div className="row">
          <PriceStepper
            price={recipe.price}
            decreaseLabel={t("menu.lowerPriceOf", { name })}
            increaseLabel={t("menu.raisePriceOf", { name })}
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
            {t("menu.onMenu")}
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
                  {t("menu.delete")}
                </button>
                <button className="btn sm ghost" onClick={onCancelDelete}>{t("menu.keep")}</button>
              </>
            ) : (
              <button className="btn sm ghost" onClick={onAskDelete}>{t("menu.confirmDelete")}</button>
            ))}
        </div>
      </div>
    </div>
  );
}

function ClassicsToDiscover({ state }) {
  const t = useTranslation();
  const undiscovered = CLASSIC_RECIPES.filter((classic) => !knowsRecipe(state, classic.id));
  if (!undiscovered.length) return null;
  return (
    <>
      <h3 className="h" style={{ marginTop: 24 }}>{t("menu.toDiscover")}</h3>
      <div className="grid2">
        {undiscovered.map((classic) => {
          const missing = classic.ingredients.filter((id) => !state.unlocked[id]);
          const items = missing.map((id) => t("menu.missingItem", { id, level: INGREDIENTS_BY_ID[id].requiredLevel })).join(", ");
          return (
            <div key={classic.id} className="card pad locked row" style={{ flexWrap: "nowrap" }}>
              <div className="grow">
                <strong>{t.recipe(classic)}</strong>
                <div className="hint">{t("menu.missing", { items })}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function MenuView({ state, dispatch }) {
  const t = useTranslation();
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [recipeIdToDelete, setRecipeIdToDelete] = useState(null);
  const level = levelForXp(state.xp);
  const cookableRecipes = state.recipes.filter((recipe) => canCook(state, recipe));
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow">
          <h2 className="h" style={{ margin: 0 }}>{t("menu.title")}</h2>
          <p className="sub">{t("menu.capacity", { count: activeMenu(state).length, capacity: menuCapacity(level) })}</p>
        </div>
        <button className="btn primary" onClick={() => setEditorOpen(true)}>{t("menu.createRecipe")}</button>
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
