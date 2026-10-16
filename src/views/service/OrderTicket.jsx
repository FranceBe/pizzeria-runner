import { moodForWait, hasSpecialRequest } from "../../game/customers.js";
import { useTranslation } from "../../i18n/I18nContext.jsx";
import { CustomerFace } from "../../components/CustomerFace.jsx";
import { IngredientIcon } from "../../components/IngredientIcon.jsx";

export function OrderTicket({ customer, isSelected, showIngredients, onSelect }) {
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
          {customer.ingredients
            .filter((id) => id !== "pate")
            .map((id) => (
              <span key={id} className="chip">
                <IngredientIcon id={id} />
                {t.ingredient(id)}
              </span>
            ))}
        </div>
      )}
    </button>
  );
}
