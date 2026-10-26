import { useState } from "react";
import { INGREDIENTS_BY_ID } from "../../data/ingredients";
import { CLASSIC_RECIPES } from "../../data/recipes";
import { activeMenu, canCook, isNewRecipe, knowsRecipe, menuCapacityOf, recipeAppeal, signatureLevel } from "../../game/menu";
import { seasonalRecipe } from "../../game/seasons";
import { canChooseSpecial, isSpecial } from "../../game/special";
import { FESTIVALS } from "../../data/festivals";
import { festivalOfRecipe } from "../../game/calendar";
import { dishOf, fairPrice, ingredientCost, PRICE_STEP, type Dish } from "../../game/pizza";
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
  const isTheSpecial = isSpecial(state, recipe.id);
  const canChoose = canChooseSpecial(state);
  const festive = festivalOfRecipe(recipe.id);
  const changePrice = (delta: number) => dispatch({ type: "changePrice", recipeId: recipe.id, delta });
  return (
    <div className={`card recipe${isTheSpecial ? " special" : ""}${recipe.onMenu ? "" : " off-menu"}`}>
      {isTheSpecial && <span className="special-ribbon">{t("menu.special")}</span>}
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
          {/* One special a week: once chosen (and the day is over), the others can't take its place. */}
          {recipe.onMenu && (isTheSpecial || canChoose) && (
            <button
              className={`btn sm ${isTheSpecial ? "special-on" : "ghost"}`}
              aria-pressed={isTheSpecial}
              title={t("menu.specialHint")}
              disabled={!canChoose}
              onClick={() => dispatch({ type: "setSpecial", recipeId: isTheSpecial ? null : recipe.id })}
            >
              {isTheSpecial ? `★ ${t("menu.special")}` : `☆ ${t("menu.makeSpecial")}`}
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
  const cookableRecipes = state.recipes.filter((recipe) => canCook(state, recipe));
  // With the trattoria open, the menu comes in two parts: the pizzas, then the pasta.
  const hasTrattoria = state.upgrades.trattoria > 0;
  const parts: readonly (Dish | null)[] = hasTrattoria ? ["pizza", "pasta"] : [null];
  const inPart = (part: Dish | null) => (recipe: Recipe) => part === null || dishOf(recipe.ingredients) === part;
  const partTitle = (part: Dish) => t(part === "pizza" ? "menu.pizzas" : "menu.pasta");
  const capacity = { count: activeMenu(state).length, capacity: menuCapacityOf(state) };
  return (
    <>
      <div className="chalkboard">
        <div className="grow">
          <h2 className="chalk-title">{t("menu.title")}</h2>
          <p className="chalk-sub">{hasTrattoria ? t("menu.capacityDishes", capacity) : t("menu.capacity", capacity)}</p>
        </div>
        {parts.map((part) => {
          const dishes = activeMenu(state).filter(inPart(part));
          if (part && !dishes.length) return null;
          return (
            <div key={part ?? "all"} className="chalk-part">
              {part && <h3 className="chalk-part-title">{partTitle(part)}</h3>}
              <ul className="chalk-list">
                {dishes.map((recipe) => (
                  <li key={recipe.id}>
                    <span>{isSpecial(state, recipe.id) && "★ "}{t.recipe(recipe)}</span>
                    <span className="chalk-dots" />
                    <span>{t.money(recipe.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <button className="btn primary" onClick={() => setEditorOpen(true)}>{t("menu.createRecipe")}</button>
      </div>
      {parts.map((part) => {
        const recipes = cookableRecipes.filter(inPart(part));
        if (part && !recipes.length) return null;
        return (
          <section key={part ?? "all"} className="menu-part">
            {part && <h3 className="h menu-part-title">{partTitle(part)}</h3>}
            <div className="grid2">
              {recipes.map((recipe) => (
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
          </section>
        );
      })}
      <ClassicsToDiscover state={state} />
      {isEditorOpen && <RecipeEditor state={state} dispatch={dispatch} onClose={() => setEditorOpen(false)} />}
    </>
  );
};
