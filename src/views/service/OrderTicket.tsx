import { moodForWait, hasSpecialRequest } from "../../game/customers";
import { useTranslation } from "../../i18n/I18nContext";
import { CustomerFace } from "../../components/CustomerFace";
import { IngredientIcon } from "../../components/IngredientIcon";
import type { IngredientId } from "../../data/ingredients";
import type { Customer } from "../../game/types";

type ChipStatus = "" | "ok" | "miss" | "extra";

interface OrderTicketProps {
  customer: Customer;
  isSelected: boolean;
  isRegular: boolean;
  showIngredients: boolean;
  board: readonly IngredientId[];
  onSelect: () => void;
}

// On the selected ticket, chips show what is already on the board (ok), still missing (miss)
// and on the board but not ordered (extra).
function ingredientChips(
  customer: Customer,
  board: readonly IngredientId[],
  isSelected: boolean,
): { id: IngredientId; status: ChipStatus }[] {
  const ordered = customer.ingredients.filter((id) => id !== "pate");
  if (!isSelected || !board.length) return ordered.map((id) => ({ id, status: "" as const }));
  const extras = board.filter((id) => id !== "pate" && !customer.ingredients.includes(id));
  return [
    ...ordered.map((id) => ({ id, status: board.includes(id) ? ("ok" as const) : ("miss" as const) })),
    ...extras.map((id) => ({ id, status: "extra" as const })),
  ];
}

export function OrderTicket({ customer, isSelected, isRegular, showIngredients, board, onSelect }: OrderTicketProps) {
  const t = useTranslation();
  const mood = moodForWait(customer.waitedSeconds);
  return (
    <button className="ticket" aria-pressed={isSelected} onClick={onSelect}>
      <span className="price">{t.money(customer.price)}</span>
      <div className="who">
        <CustomerFace customer={customer} mood={mood} />
        <div>
          <div className="nm">
            {customer.name}
            {customer.visitNumber !== undefined && customer.visitNumber > 1 && (
              <span className={`visit${isRegular ? " regular" : ""}`} title={isRegular ? t("service.regular") : undefined}>
                {isRegular && <span aria-hidden="true">★ </span>}
                <span className="visit-t">{t("service.visit", { number: customer.visitNumber })}</span>
              </span>
            )}
          </div>
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
          {ingredientChips(customer, board, isSelected).map(({ id, status }, index) => (
            <span key={id} className={`chip ${status}`} title={t.ingredient(id)}>
              <IngredientIcon id={id} />
              <span className="chip-t">{t.ingredient(id)}</span>
              {/* Keyboard hint, matching game/shortcuts.js; only the ordered ingredients are numbered. */}
              {isSelected && status !== "extra" && index < 9 && <kbd className="kbd">{index + 1}</kbd>}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
