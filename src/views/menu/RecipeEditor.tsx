import { useState } from "react";
import { Overlay } from "../../components/Overlay";
import { PREP_STATIONS, type IngredientId } from "../../data/ingredients";
import { MAX_FILLINGS, validateRecipe } from "../../game/menu";
import {
  adjustPrice, appealOf, fairPrice, fillingsOf, findPairings, ingredientCost, isSauce, priceLevel, PRICE_STEP,
} from "../../game/pizza";
import { useTranslation } from "../../i18n/I18nContext";
import { AppealStars } from "../../components/AppealStars";
import { IngredientIcon } from "../../components/IngredientIcon";
import { Pizza } from "../../components/Pizza";
import { PriceStepper } from "../../components/PriceStepper";
import { visiblePairings } from "../../game/pairings";
import type { GameState } from "../../game/types";
import type { ScreenProps } from "../types";

interface IngredientPickerProps {
  state: GameState;
  ingredients: readonly IngredientId[];
  onToggle: (id: IngredientId) => void;
}

const STARTING_INGREDIENTS: readonly IngredientId[] = ["pate", "tomate", "mozza"];

const IngredientPicker = ({ state, ingredients, onToggle }: IngredientPickerProps) => {
  const t = useTranslation();
  return (
    <div className="picker">
      {PREP_STATIONS.filter((station) => station.id !== "base").map((station) => {
        const available = station.ingredientIds.filter((id) => state.unlocked[id]);
        if (!available.length) return null;
        return (
          <div key={station.id}>
            <div className="binlabel">
              {t(`stations.${station.id}`)}
              {station.id === "sauce" ? t("editor.sauceHint") : ""}
            </div>
            <div className="bins">
              {available.map((id) => {
                const isChosen = ingredients.includes(id);
                return (
                  <button key={id} className={`bin${isChosen ? " on" : ""}`} aria-pressed={isChosen} onClick={() => onToggle(id)}>
                    <IngredientIcon id={id} />
                    <span className="bn">{t.ingredient(id)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const RecipeEditor = ({ state, dispatch, onClose }: ScreenProps & { onClose: () => void }) => {
  const t = useTranslation();
  const [ingredients, setIngredients] = useState(STARTING_INGREDIENTS);
  const [name, setName] = useState("");
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  // Translated message, shown under the picker.
  const [error, setError] = useState("");

  const suggestedPrice = fairPrice(ingredients);
  const price = customPrice ?? suggestedPrice;
  const pairings = findPairings(ingredients);
  const { known, hasSecret } = visiblePairings(state, ingredients);

  const toggleIngredient = (id: IngredientId) => {
    setError("");
    if (ingredients.includes(id)) return setIngredients(ingredients.filter((x) => x !== id));
    if (isSauce(id)) return setIngredients([...ingredients.filter((x) => !isSauce(x)), id]);
    if (fillingsOf(ingredients).length >= MAX_FILLINGS) return setError(t("editor.tooManyFillings", { max: MAX_FILLINGS }));
    setIngredients([...ingredients, id]);
  };

  const save = () => {
    const trimmedName = name.trim();
    const errorKey = validateRecipe(state.recipes, trimmedName, ingredients, t.recipe);
    if (errorKey) return setError(t(`editor.errors.${errorKey}`));
    dispatch({ type: "addRecipe", name: trimmedName, ingredients, price });
    onClose();
  };

  return (
    // No closing by tapping outside: a recipe being written would be lost.
    <Overlay label={t("editor.title")}>
      <div className="card pad modal" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="row">
          <h2 className="h grow">{t("editor.title")}</h2>
          <button className="btn sm ghost" onClick={onClose}>{t("editor.close")}</button>
        </div>
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
          <div className="peel" style={{ padding: 10 }}>
            <Pizza ingredients={ingredients} baked size={150} />
          </div>
          <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
            <label htmlFor="recipe-name" className="binlabel">{t("editor.name")}</label>
            <input
              id="recipe-name"
              type="text"
              value={name}
              maxLength={28}
              placeholder={t("editor.namePlaceholder")}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
            />
            <div className="row">
              <AppealStars appeal={appealOf(ingredients, false)} />
              <span className="hint">{t("editor.appeal")}</span>
            </div>
            {known.map(([a, b]) => (
              <div key={a + b} className="pair">{t("editor.goodPairing", { a, b })}</div>
            ))}
            {hasSecret && (
              <div className="pair secret">✨ {t("editor.secretPairing")}</div>
            )}
            {pairings.bad.map(([a, b]) => (
              <div key={a + b} className="clash">{t("editor.badPairing", { a, b })}</div>
            ))}
            <dl className="kv">
              <dt>{t("editor.ingredientCost")}</dt>
              <dd>{t.money(ingredientCost(ingredients))}</dd>
              <dt>{t("editor.suggestedPrice")}</dt>
              <dd>{t.money(suggestedPrice)}</dd>
            </dl>
            <div className="row">
              <span className="binlabel" style={{ margin: 0 }}>{t("editor.price")}</span>
              <PriceStepper
                price={price}
                decreaseLabel={t("editor.lowerPrice")}
                increaseLabel={t("editor.raisePrice")}
                onDecrease={() => setCustomPrice(adjustPrice(price, -PRICE_STEP))}
                onIncrease={() => setCustomPrice(adjustPrice(price, PRICE_STEP))}
              />
            </div>
            <div className="hint">{t(`editor.priceNote.${priceLevel(price, suggestedPrice)}`)}</div>
          </div>
        </div>
        <IngredientPicker state={state} ingredients={ingredients} onToggle={toggleIngredient} />
        {error && <div className="clash" role="alert">{error}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn primary" onClick={save}>{t("editor.save")}</button>
        </div>
      </div>
    </Overlay>
  );
};
