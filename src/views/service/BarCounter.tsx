import { DRINKS, DRINK_IDS } from "../../data/drinks";
import { isRegularCustomer } from "../../game/customers";
import { selectedCustomer } from "../../game/service";
import { DrinkGlass } from "../../components/DrinkGlass";
import { useTranslation } from "../../i18n/I18nContext";
import type { ServiceScreenProps } from "../types";

// The bar, in the board's corners. On the left, the fridge: a tap pours that drink (it costs the glass). It goes straight
// to the selected customer if it is theirs; otherwise it lands on the tray, on the right, until someone who ordered it
// gets it, or the tray is cleared. Nothing says which drink is wanted besides the tickets: a wrong pour is possible.
export function BarCounter({ state, service, dispatch }: ServiceScreenProps) {
  const t = useTranslation();
  const drinks = DRINK_IDS.filter((id) => DRINKS[id].barLevel <= state.upgrades.bar);
  if (!drinks.length || service.challenge) return null;
  const tray = service.tray ?? [];
  const selected = selectedCustomer(service);
  const canOffer = selected?.drink && !selected.drinkServed && !selected.pizzaServed && isRegularCustomer(state, selected);
  return (
    <>
      <div className="bar-fridge" role="group" aria-label={t("service.bar")}>
        {drinks.map((id) => (
          <button
            key={id}
            className="glass-btn"
            title={t("service.pourTitle", { drink: t.drink(id), cost: DRINKS[id].cost })}
            onClick={() => dispatch({ type: "pourDrink", drinkId: id })}
          >
            <DrinkGlass id={id} />
            <span className="glass-n">{t.drink(id)}</span>
          </button>
        ))}
        {canOffer && selected.drink && (
          <button
            className="glass-btn offer"
            title={t("service.offerDrink", { drink: t.drink(selected.drink).toLowerCase(), name: selected.name })}
            onClick={() => dispatch({ type: "offerDrink" })}
          >
            <span aria-hidden="true">🎁</span>
            <span className="glass-n">{t("service.offerShort")}</span>
          </button>
        )}
      </div>
      {tray.length > 0 && (
        <div className="bar-tray" role="group" aria-label={t("service.tray")}>
          {tray.map((id, index) => (
            <button
              key={index}
              className="glass-btn on-tray"
              title={t("service.trayTitle", { drink: t.drink(id) })}
              onClick={() => dispatch({ type: "serveTrayDrink", index })}
            >
              <DrinkGlass id={id} />
            </button>
          ))}
          <button className="glass-btn tray-bin" title={t("service.binTray")} onClick={() => dispatch({ type: "binTray" })}>
            <span aria-hidden="true">🗑️</span>
          </button>
        </div>
      )}
    </>
  );
}
