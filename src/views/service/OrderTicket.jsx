import { CUSTOMER_LINES_BY_MOOD } from "../../data/customers.js";
import { ingredientName } from "../../data/ingredients.js";
import { moodForWait, hasSpecialRequest } from "../../game/customers.js";
import { formatEuro } from "../../utils/format.js";
import { CustomerFace } from "../../components/CustomerFace.jsx";
import { IngredientIcon } from "../../components/IngredientIcon.jsx";

export function OrderTicket({ customer, isSelected, showIngredients, onSelect }) {
  const mood = moodForWait(customer.waitedSeconds);
  return (
    <button className="ticket" aria-pressed={isSelected} onClick={onSelect}>
      <span className="price">{formatEuro(customer.price)}</span>
      <div className="who">
        <CustomerFace customer={customer} mood={mood} />
        <div>
          <div className="nm">{customer.name}</div>
          <div className="say">{CUSTOMER_LINES_BY_MOOD[mood][customer.lineIndex]}</div>
        </div>
      </div>
      <div className="pz">{customer.recipeName}</div>
      {hasSpecialRequest(customer) && (
        <div className="mods">
          {customer.extraIngredient && <span className="mod add">+ {ingredientName(customer.extraIngredient)}</span>}
          {customer.removedIngredient && <span className="mod rem">sans {ingredientName(customer.removedIngredient).toLowerCase()}</span>}
        </div>
      )}
      {showIngredients && (
        <div className="chips">
          {customer.ingredients
            .filter((id) => id !== "pate")
            .map((id) => (
              <span key={id} className="chip">
                <IngredientIcon id={id} />
                {ingredientName(id)}
              </span>
            ))}
        </div>
      )}
    </button>
  );
}
