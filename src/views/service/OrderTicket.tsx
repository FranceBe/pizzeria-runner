import type { CSSProperties } from "react";
import { moodForWait, hasSpecialRequest } from "../../game/customers";
import { useTranslation } from "../../i18n/I18nContext";
import { CustomerFace } from "../../components/CustomerFace";
import { IngredientIcon } from "../../components/IngredientIcon";
import { DELIVERY_EXPRESS_SECONDS } from "../../data/progression";
import type { IngredientId } from "../../data/ingredients";
import type { Customer, TableProgress } from "../../game/types";
import { DrinkGlass } from "../../components/DrinkGlass";
import { DRINKS } from "../../data/drinks";

type ChipStatus = "" | "ok" | "miss" | "extra";

interface OrderTicketProps {
  customer: Customer;
  isSelected: boolean;
  isRegular: boolean;
  showIngredients: boolean;
  board: readonly IngredientId[];
  /** The table this customer sits at, if they came in with others. */
  table?: TableProgress;
  /** How full the barman has poured this customer's drink, from 0 to 1, while he is on it. */
  pour?: number;
  onSelect: () => void;
}

// On the selected ticket, chips show what is already on the board (ok), still missing (miss)
// and on the board but not ordered (extra).
const ingredientChips = (
  customer: Customer,
  board: readonly IngredientId[],
  isSelected: boolean,): { id: IngredientId; status: ChipStatus }[] => {
  const ordered = customer.ingredients.filter((id) => id !== "pate");
  if (!isSelected || !board.length) return ordered.map((id) => ({ id, status: "" as const }));
  const extras = board.filter((id) => id !== "pate" && !customer.ingredients.includes(id));
  return [
    ...ordered.map((id) => ({ id, status: board.includes(id) ? ("ok" as const) : ("miss" as const) })),
    ...extras.map((id) => ({ id, status: "extra" as const })),
  ];
};

// Delivery orders have a scooter instead of a face.
const Scooter = () => {
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
};

const ticketClassName = (customer: Customer, table: TableProgress | undefined): string => {
  if (customer.pizzaServed) return "ticket served-pizza";
  if (customer.critic) return "ticket critic";
  if (customer.celebrity) return "ticket celebrity";
  if (customer.delivery) return "ticket delivery";
  if (customer.birthday) return "ticket birthday";
  if (table) return `ticket at-table tb-${table.color}`;
  return "ticket";
};

export const OrderTicket = ({ customer, isSelected, isRegular, showIngredients, board, table, pour, onSelect }: OrderTicketProps) => {
  const t = useTranslation();
  const mood = moodForWait(customer.waitedSeconds);
  const expressSecondsLeft = Math.ceil(DELIVERY_EXPRESS_SECONDS - customer.waitedSeconds);
  const hasExpress = Boolean(customer.delivery) && expressSecondsLeft > 0;
  return (
    <button className={ticketClassName(customer, table)} aria-pressed={isSelected} onClick={onSelect} title={customer.critic ? t("service.criticTitle") : customer.celebrity ? t("service.celebrityTitle") : undefined}>
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
      <div className="pz">
        {customer.pizzaServed
          ? t("service.pizzaDone")
          : customer.asUsual
            ? t("service.asUsual")
            : t.recipe({ id: customer.recipeId, name: customer.recipeName })}
      </div>
      {/* Every tag of the order on one line: who they are, what they asked for, and their drink. */}
      {(customer.critic || customer.celebrity || customer.birthday || customer.charmed || customer.forDessert || hasExpress || hasSpecialRequest(customer) || customer.drink) && (
        <div className="mods">
          {customer.critic && <span className="mod critic-tag">★ {t("service.critic")}</span>}
          {customer.celebrity && <span className="mod celebrity-tag">{`⭐ ${t("service.celebrity")}`}</span>}
          {customer.birthday && <span className="mod birthday-tag">🎂 {t("service.birthday")}</span>}
          {customer.forDessert && <span className="mod dessert-tag" title={t("service.forDessertTitle")}>{`🍰 ${t("service.forDessert")}`}</span>}
          {customer.charmed && <span className="mod charmed-tag" title={t("service.charmedTitle")}>{`💛 ${t("service.charmed")}`}</span>}
          {hasExpress && <span className="mod express">{t("service.express", { seconds: expressSecondsLeft })}</span>}
          {customer.extraIngredient && <span className="mod add">{t("service.extra", { id: customer.extraIngredient })}</span>}
          {customer.removedIngredient && <span className="mod rem">{t("service.without", { id: customer.removedIngredient })}</span>}
          {customer.diet && <span className="mod diet">{t(`diets.${customer.diet}`)}</span>}
          {customer.drink && (
            <span
              className={`drink-order${customer.drinkServed ? " served" : pour !== undefined ? " pouring" : ""}`}
              style={pour !== undefined ? ({ "--pour": `${Math.round(pour * 100)}%` } as CSSProperties) : undefined}
              title={pour !== undefined ? t("service.barmanPouring") : undefined}
            >
              <DrinkGlass id={customer.drink} />
              <span className="drink-name">
                {`${t.drink(customer.drink)} · ${customer.drinkOffered ? t("service.offered") : t.money(DRINKS[customer.drink].price)}`}
              </span>
              {customer.drinkServed && <span aria-hidden="true">✓</span>}
            </span>
          )}
        </div>
      )}
      {customer.pizzaServed && <div className="say waiting-drink">{t("service.waitingDrink")}</div>}
      {showIngredients && !customer.asUsual && !customer.pizzaServed && (
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
};
