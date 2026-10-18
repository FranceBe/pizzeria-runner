import { moodForWait, hasSpecialRequest } from "../../game/customers";
import { useTranslation } from "../../i18n/I18nContext";
import { CustomerFace } from "../../components/CustomerFace";
import { IngredientIcon } from "../../components/IngredientIcon";
import { DELIVERY_EXPRESS_SECONDS } from "../../data/progression";
import type { IngredientId } from "../../data/ingredients";
import type { Customer, TableProgress } from "../../game/types";
import { DrinkGlass } from "../../components/DrinkGlass";

type ChipStatus = "" | "ok" | "miss" | "extra";

interface OrderTicketProps {
  customer: Customer;
  isSelected: boolean;
  isRegular: boolean;
  showIngredients: boolean;
  board: readonly IngredientId[];
  /** The table this customer sits at, if they came in with others. */
  table?: TableProgress;
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

// Delivery orders have a scooter instead of a face.
function Scooter() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="scooter">
      <circle cx="20" cy="20" r="18" fill="var(--surface2)" />
      <path d="M11 25h12l4-8h4" stroke="var(--accent)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 25v-5h7" stroke="var(--accent)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="9" y="15" width="8" height="6" rx="1.5" fill="var(--gold)" />
      <circle cx="13" cy="27" r="3.2" fill="var(--ink)" />
      <circle cx="28" cy="27" r="3.2" fill="var(--ink)" />
    </svg>
  );
}

function ticketClassName(customer: Customer, table: TableProgress | undefined): string {
  if (customer.critic) return "ticket critic";
  if (customer.delivery) return "ticket delivery";
  if (customer.birthday) return "ticket birthday";
  if (table) return `ticket at-table tb-${table.color}`;
  return "ticket";
}

export function OrderTicket({ customer, isSelected, isRegular, showIngredients, board, table, onSelect }: OrderTicketProps) {
  const t = useTranslation();
  const mood = moodForWait(customer.waitedSeconds);
  const expressSecondsLeft = Math.ceil(DELIVERY_EXPRESS_SECONDS - customer.waitedSeconds);
  return (
    <button className={ticketClassName(customer, table)} aria-pressed={isSelected} onClick={onSelect} title={customer.critic ? t("service.criticTitle") : undefined}>
      <span className="price">{t.money(customer.price)}</span>
      <div className="who">
        {customer.delivery ? <Scooter /> : <CustomerFace customer={customer} mood={mood} />}
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
          <div className="say">
            {customer.delivery ? t("service.delivery") : t(`customerLines.${mood}.${customer.lineIndex}`)}
          </div>
        </div>
      </div>
      <div className="pz">{customer.asUsual ? t("service.asUsual") : t.recipe({ id: customer.recipeId, name: customer.recipeName })}</div>
      {(customer.critic || customer.birthday || (customer.delivery && expressSecondsLeft > 0)) && (
        <div className="mods">
          {customer.critic && <span className="mod critic-tag">★ {t("service.critic")}</span>}
          {customer.birthday && <span className="mod birthday-tag">🎂 {t("service.birthday")}</span>}
          {customer.delivery && expressSecondsLeft > 0 && (
            <span className="mod express">{t("service.express", { seconds: expressSecondsLeft })}</span>
          )}
        </div>
      )}
      {hasSpecialRequest(customer) && (
        <div className="mods">
          {customer.extraIngredient && <span className="mod add">{t("service.extra", { id: customer.extraIngredient })}</span>}
          {customer.removedIngredient && <span className="mod rem">{t("service.without", { id: customer.removedIngredient })}</span>}
          {customer.diet && <span className="mod diet">{t(`diets.${customer.diet}`)}</span>}
        </div>
      )}
      {customer.drink && (
        <div className={`drink-order${customer.drinkServed ? " served" : ""}`}>
          <DrinkGlass id={customer.drink} />
          <span>{t.drink(customer.drink)}{customer.drinkOffered && ` · ${t("service.offered")}`}</span>
          {customer.drinkServed ? <span aria-hidden="true">✓</span> : isSelected && <kbd className="kbd">D</kbd>}
        </div>
      )}
      {showIngredients && !customer.asUsual && (
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
