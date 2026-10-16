import { moodForWait, hasSpecialRequest } from "../../game/customers.js";
import { useTranslation } from "../../i18n/I18nContext.jsx";
import { CustomerFace } from "../../components/CustomerFace.jsx";
import { IngredientIcon } from "../../components/IngredientIcon.jsx";

// On the selected ticket, chips show what is already on the board (ok), still missing (miss)
// and on the board but not ordered (extra).
function ingredientChips(customer, board, isSelected) {
  const ordered = customer.ingredients.filter((id) => id !== "pate");
  if (!isSelected || !board.length) return ordered.map((id) => ({ id, status: "" }));
  const extras = board.filter((id) => id !== "pate" && !customer.ingredients.includes(id));
  return [
    ...ordered.map((id) => ({ id, status: board.includes(id) ? "ok" : "miss" })),
    ...extras.map((id) => ({ id, status: "extra" })),
  ];
}

export function OrderTicket({ customer, isSelected, showIngredients, board, onSelect }) {
  const t = useTranslation();
  const mood = moodForWait(customer.waitedSeconds);
  return (
    <button className="ticket" aria-pressed={isSelected} onClick={onSelect}>
      <span className="price">{t.money(customer.price)}</span>
      <div className="who">
        <CustomerFace customer={customer} mood={mood} />
        <div>
          <div className="nm">{customer.name}</div>
          <div className="say">{t(`customerLines.${mood}.${customer.lineIndex}`)}</div>
        </div>
      </div>
      <div className="pz">{t.recipe({ id: customer.recipeId, name: customer.recipeName })}</div>
      {hasSpecialRequest(customer) && (
        <div className="mods">
          {customer.extraIngredient && <span className="mod add">{t("service.extra", { id: customer.extraIngredient })}</span>}
          {customer.removedIngredient && <span className="mod rem">{t("service.without", { id: customer.removedIngredient })}</span>}
        </div>
      )}
      {showIngredients && (
        <div className="chips">
          {ingredientChips(customer, board, isSelected).map(({ id, status }) => (
            <span key={id} className={`chip ${status}`} title={t.ingredient(id)}>
              <IngredientIcon id={id} />
              <span className="chip-t">{t.ingredient(id)}</span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
