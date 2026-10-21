import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { UPGRADES, UPGRADE_RESALE_SHARE } from "../data/progression";
import { createTranslator } from "../i18n";
import { I18nProvider } from "../i18n/I18nContext";
import { makeCustomer, makeState, play, stateInService } from "../test/helpers";
import { ServiceView } from "../views/service/ServiceView";
import { dailyCharges } from "./economy";
import type { GameState } from "./types";

const serviceHtml = (state: GameState): string =>
  renderToString(
    <I18nProvider value={createTranslator("en")}>
      {state.service && <ServiceView state={state} service={state.service} dispatch={() => undefined} />}
    </I18nProvider>,
  );

describe("selling an upgrade back", () => {
  it("returns part of what the level cost, one level at a time, and lowers the evening charges", () => {
    const state = makeState({ money: 10, upgrades: { ...makeState().upgrades, commis: 2 }, purchasesToday: 500 });
    const chargesBefore = dailyCharges(state);
    const sold = play(state, { type: "sellUpgrade", upgradeKey: "commis" });
    expect(sold.upgrades.commis).toBe(1);
    expect(sold.money).toBe(10 + UPGRADES.commis.costs[1] * UPGRADE_RESALE_SHARE);
    expect(sold.purchasesToday).toBe(500 - UPGRADES.commis.costs[1] * UPGRADE_RESALE_SHARE);
    expect(dailyCharges(sold)).toBe(chargesBefore - UPGRADES.commis.dailyCharge);
    expect(sold.toasts.at(-1)?.key).toBe("upgradeSold");
  });

  it("returns everything for a comfort upgrade like the drawer", () => {
    const sold = play(makeState({ money: 0, upgrades: { ...makeState().upgrades, drawer: 1 } }), { type: "sellUpgrade", upgradeKey: "drawer" });
    expect(sold).toMatchObject({ money: UPGRADES.drawer.costs[0], upgrades: { drawer: 0 } });
  });

  it("does nothing during service, or without a level to sell", () => {
    const serving = stateInService([makeCustomer()], { upgrades: { ...makeState().upgrades, oven: 2 } });
    expect(play(serving, { type: "sellUpgrade", upgradeKey: "oven" }).upgrades.oven).toBe(2);
    const none = makeState({ money: 10 });
    expect(play(none, { type: "sellUpgrade", upgradeKey: "oven" }).money).toBe(10);
  });
});

describe("the tidy prep line", () => {
  // Origan is unlocked but no pizza on the starting menu (a margherita) uses it.
  const withOregano = (overrides: Partial<GameState> = {}) => {
    const state = stateInService([makeCustomer({ extraIngredient: "origan", ingredients: ["pate", "tomate", "mozza", "basilic", "origan"] })], overrides);
    state.unlocked.origan = true;
    state.stock.origan = 5;
    return state;
  };

  it("puts the pans off the menu in a closed drawer, outlined when the order needs one of them", () => {
    const state = withOregano({ upgrades: { ...makeState().upgrades, drawer: 1 } });
    const html = serviceHtml(state);
    expect(html).toContain("st-drawer");
    expect(html).toMatch(/class="pan drawer-btn need"[^>]*aria-expanded="false"/);
    // Closed: the oregano pan isn't on the line.
    expect(html).not.toMatch(/title="Oregano · 5 in stock"/);
    expect(html).toMatch(/title="Basil · \d+ in stock"/);
  });

  it("keeps every pan on the line without the upgrade, or when switched off in the settings", () => {
    expect(serviceHtml(withOregano())).not.toContain("st-drawer");
    const switchedOff = play(withOregano({ upgrades: { ...makeState().upgrades, drawer: 1 } }), { type: "toggleComfort", option: "useDrawer" });
    expect(switchedOff.settings.useDrawer).toBe(false);
    const html = serviceHtml(switchedOff);
    expect(html).not.toContain("st-drawer");
    expect(html).toMatch(/title="Oregano · 5 in stock"/);
  });

  it("lets the commis fading be switched off too", () => {
    const state = withOregano({ upgrades: { ...makeState().upgrades, commis: 3 } });
    expect(serviceHtml(state)).toContain("fade-2");
    expect(serviceHtml(play(state, { type: "toggleComfort", option: "commisFade" }))).not.toContain("fade-2");
  });
});
