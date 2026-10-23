import { useState } from "react";
import { INGREDIENTS_BY_ID } from "../../data/ingredients";
import { CLASSIC_RECIPES } from "../../data/recipes";
import { activeMenu, canCook, isNewRecipe, knowsRecipe, recipeAppeal, signatureLevel } from "../../game/menu";
import { seasonalRecipe } from "../../game/seasons";
import { FESTIVALS } from "../../data/festivals";
import { festivalOfRecipe } from "../../game/calendar";
import { fairPrice, ingredientCost, PRICE_STEP } from "../../game/pizza";
import { levelForXp, menuCapacity } from "../../game/progression";
import { useTranslation } from "../../i18n/I18nContext";
import { AppealStars } from "../../components/AppealStars";
import { Pizza } from "../../components/Pizza";
import { PriceStepper } from "../../components/PriceStepper";
import { RecipeEditor } from "./RecipeEditor";
import type { Recipe, RecipeId } from "../../game/types";
import type { ScreenProps } from "../types";

interface RecipeCardProps extends ScreenProps {
  recipe: Recipe;
  isConfirmingDelete: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
}

const RecipeCard = ({ state, recipe, dispatch, isConfirmingDelete, onAskDelete, onCancelDelete }: RecipeCardProps) => {
  const t = useTranslation();
  const name = t.recipe(recipe);
  const isSpecial = state.chefSpecial === recipe.id;
  const festive = festivalOfRecipe(recipe.id);
  const changePrice = (delta: number) => dispatch({ type: "changePrice", recipeId: recipe.id, delta });
  return (
    <div className={`card recipe${isSpecial ? " special" : ""}${recipe.onMenu ? "" : " off-menu"}`}>
      {isSpecial && <span className="special-ribbon">{t("menu.chefSpecial")}</span>}
      <Pizza ingredients={recipe.ingredients} baked className="pz" />
      <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="rname">{name}</span>
          {recipe.custom && <span className="tag">{t("menu.homemade")}</span>}
          {isNewRecipe(state, recipe) && <span className="tag">{t("common.new")}</span>}
          {signatureLevel(recipe.id) && <span className="tag nonna-tag">{t("menu.nonna")}</span>}
          {seasonalRecipe(state)?.id === recipe.id && <span className="tag seasonal">{t("menu.seasonal")}</span>}
          {festive && <span className="tag festive-tag">{`${FESTIVALS[festive].emoji} ${t("menu.festive", { festival: festive })}`}</span>}
        </div>
        <div className="hint">{t.toppings(recipe.ingredients)}</div>
        <div className="row">
          <AppealStars appeal={recipeAppeal(recipe)} />
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
          {recipe.onMenu && (
            <button
              className={`btn sm ${isSpecial ? "special-on" : "ghost"}`}
              aria-pressed={isSpecial}
              title={t("menu.specialHint")}
              onClick={() => dispatch({ type: "setChefSpecial", recipeId: recipe.id })}
            >
              {isSpecial ? `★ ${t("menu.chefSpecial")}` : `☆ ${t("menu.makeSpecial")}`}
            </button>
          )}
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
};

const ClassicsToDiscover = ({ state }: Pick<ScreenProps, "state">) => {
  const t = useTranslation();
  // Festival recipes show up with their festival, not as something to work towards.
  const undiscovered = CLASSIC_RECIPES.filter((classic) => !knowsRecipe(state, classic.id) && !classic.festival);
  if (!undiscovered.length) return null;
  return (
    <>
      <h3 className="h" style={{ marginTop: 24 }}>{t("menu.toDiscover")}</h3>
      <div className="grid2">
        {undiscovered.map((classic) => {
          const missing = classic.ingredients.filter((id) => !state.unlocked[id]);
          const items = t.list(missing.map((id) => t("menu.missingItem", { id, level: INGREDIENTS_BY_ID[id].requiredLevel })));
          return (
            <div key={classic.id} className="card pad locked row" style={{ flexWrap: "nowrap" }}>
              <div className="grow">
                <strong>{t.recipe(classic)}</strong>
                {classic.signatureLevel && <span className="tag nonna-tag" style={{ marginLeft: 6 }}>{t("menu.nonna")}</span>}
                {classic.signatureLevel && <div className="hint">{t("menu.nonnaLocked", { level: classic.signatureLevel })}</div>}
                {missing.length > 0 && <div className="hint">{t("menu.missing", { items })}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export const MenuView = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [recipeIdToDelete, setRecipeIdToDelete] = useState<RecipeId | null>(null);
  const level = levelForXp(state.xp);
  const cookableRecipes = state.recipes.filter((recipe) => canCook(state, recipe));
  return (
    <>
      <div className="chalkboard">
        <div className="grow">
          <h2 className="chalk-title">{t("menu.title")}</h2>
          <p className="chalk-sub">{t("menu.capacity", { count: activeMenu(state).length, capacity: menuCapacity(level) })}</p>
        </div>
        <ul className="chalk-list">
          {activeMenu(state).map((recipe) => (
            <li key={recipe.id}>
              <span>{recipe.id === state.chefSpecial && "★ "}{t.recipe(recipe)}</span>
              <span className="chalk-dots" />
              <span>{t.money(recipe.price)}</span>
            </li>
          ))}
        </ul>
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
};
