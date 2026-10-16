import { useState } from "react";
import { INGREDIENTS_BY_ID, PREP_STATIONS, ingredientName } from "../../data/ingredients.js";
import { MAX_FILLINGS, validateRecipe } from "../../game/menu.js";
import {
  adjustPrice, appealOf, describePrice, fairPrice, fillingsOf, findPairings, ingredientCost, isSauce, PRICE_STEP,
} from "../../game/pizza.js";
import { formatEuro } from "../../utils/format.js";
import { AppealStars } from "../../components/AppealStars.jsx";
import { IngredientIcon } from "../../components/IngredientIcon.jsx";
import { Pizza } from "../../components/Pizza.jsx";
import { PriceStepper } from "../../components/PriceStepper.jsx";

const STARTING_INGREDIENTS = ["pate", "tomate", "mozza"];

const lowerName = (id) => ingredientName(id).toLowerCase();

function IngredientPicker({ state, ingredients, onToggle }) {
  return (
    <div className="picker">
      {PREP_STATIONS.filter((station) => station.id !== "base").map((station) => {
        const available = station.ingredientIds.filter((id) => state.unlocked[id]);
        if (!available.length) return null;
        return (
          <div key={station.id}>
            <div className="binlabel">
              {station.label}
              {station.id === "sauce" ? " (une seule, ou aucune pour une pizza blanche)" : ""}
            </div>
            <div className="bins">
              {available.map((id) => {
                const isChosen = ingredients.includes(id);
                return (
                  <button key={id} className={`bin${isChosen ? " on" : ""}`} aria-pressed={isChosen} onClick={() => onToggle(id)}>
                    <IngredientIcon id={id} />
                    <span className="bn">{INGREDIENTS_BY_ID[id].name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RecipeEditor({ state, dispatch, onClose }) {
  const [ingredients, setIngredients] = useState(STARTING_INGREDIENTS);
  const [name, setName] = useState("");
  const [customPrice, setCustomPrice] = useState(null);
  const [error, setError] = useState("");

  const suggestedPrice = fairPrice(ingredients);
  const price = customPrice ?? suggestedPrice;
  const pairings = findPairings(ingredients);

  const toggleIngredient = (id) => {
    setError("");
    if (ingredients.includes(id)) return setIngredients(ingredients.filter((x) => x !== id));
    if (isSauce(id)) return setIngredients([...ingredients.filter((x) => !isSauce(x)), id]);
    if (fillingsOf(ingredients).length >= MAX_FILLINGS) return setError(`${MAX_FILLINGS} garnitures maximum : la pâte ne tiendrait pas.`);
    setIngredients([...ingredients, id]);
  };

  const save = () => {
    const trimmedName = name.trim();
    const validationError = validateRecipe(state.recipes, trimmedName, ingredients);
    if (validationError) return setError(validationError);
    dispatch({ type: "addRecipe", name: trimmedName, ingredients, price });
    onClose();
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Nouvelle recette">
      <div className="card pad modal" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="row">
          <h2 className="h grow">Nouvelle recette</h2>
          <button className="btn sm ghost" onClick={onClose}>Fermer</button>
        </div>
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
          <div className="peel" style={{ padding: 10 }}>
            <Pizza ingredients={ingredients} baked size={150} />
          </div>
          <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
            <label htmlFor="recipe-name" className="binlabel">Nom</label>
            <input
              id="recipe-name"
              type="text"
              value={name}
              maxLength={28}
              placeholder="La Fellows, la Belsize…"
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
            />
            <div className="row">
              <AppealStars appeal={appealOf(ingredients, false)} />
              <span className="hint">attrait</span>
            </div>
            {pairings.good.map(([a, b]) => (
              <div key={a + b} className="pair">Bon accord : {lowerName(a)} et {lowerName(b)}</div>
            ))}
            {pairings.bad.map(([a, b]) => (
              <div key={a + b} className="clash">Drôle de mariage : {lowerName(a)} et {lowerName(b)}</div>
            ))}
            <dl className="kv">
              <dt>Coût des ingrédients</dt>
              <dd>{formatEuro(ingredientCost(ingredients))}</dd>
              <dt>Prix conseillé</dt>
              <dd>{formatEuro(suggestedPrice)}</dd>
            </dl>
            <div className="row">
              <span className="binlabel" style={{ margin: 0 }}>Prix</span>
              <PriceStepper
                price={price}
                decreaseLabel="Baisser le prix"
                increaseLabel="Monter le prix"
                onDecrease={() => setCustomPrice(adjustPrice(price, -PRICE_STEP))}
                onIncrease={() => setCustomPrice(adjustPrice(price, PRICE_STEP))}
              />
            </div>
            <div className="hint">{describePrice(price, suggestedPrice)}</div>
          </div>
        </div>
        <IngredientPicker state={state} ingredients={ingredients} onToggle={toggleIngredient} />
        {error && <div className="clash" role="alert">{error}</div>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={save}>Ajouter au carnet</button>
        </div>
      </div>
    </div>
  );
}
