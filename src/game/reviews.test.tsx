import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createTranslator } from "../i18n";
import { I18nProvider } from "../i18n/I18nContext";
import { makeCustomer, makeState, play, serviceOf, stateInService, toggle, toJson, MARGHERITA_INGREDIENTS as MARGHERITA } from "../test/helpers";
import { Header } from "../views/Header";
import { DaySummary } from "../views/DaySummary";
import { JournalView } from "../views/JournalView";
import { averageRating, rateOrder, toneOf, writeReviews } from "./reviews";
import { hydrateState } from "./state";
import type { OrderRecord, ReadyPizza } from "./types";

afterEach(() => vi.restoreAllMocks());

const pizza = (overrides: Partial<ReadyPizza> = {}): ReadyPizza => ({ id: "p", ingredients: MARGHERITA, waitingSeconds: 0, ...overrides });
const order = (stars: number): OrderRecord => ({
  customerName: "Luca", recipeId: "margherita", recipeName: null, ingredients: MARGHERITA, price: 7, tip: 0, stars, reason: stars >= 4 ? "perfect" : "cold",
});

describe("online reviews", () => {
  it("rate each order on the wait and on how hot the pizza still was, and talk about the worst of it", () => {
    const normal = () => 0.5;
    expect(rateOrder(makeCustomer(), pizza(), normal)).toEqual({ stars: 5, reason: "perfect" });
    expect(rateOrder(makeCustomer(), pizza({ woodFired: true }), normal)).toEqual({ stars: 5, reason: "woodFired" });
    expect(rateOrder(makeCustomer({ waitedSeconds: 30 }), pizza(), normal)).toEqual({ stars: 4, reason: "wait" });
    expect(rateOrder(makeCustomer(), pizza({ waitingSeconds: 30 }), normal)).toEqual({ stars: 4, reason: "lukewarm" });
    expect(rateOrder(makeCustomer({ waitedSeconds: 60 }), pizza(), normal)).toEqual({ stars: 3, reason: "wait" });
    // Long wait and a cold pizza: the cold pizza is what they write about.
    expect(rateOrder(makeCustomer({ waitedSeconds: 120 }), pizza({ waitingSeconds: 60 }), normal)).toEqual({ stars: 1, reason: "cold" });
  });

  it("depend on the customer's temper: some forgive a lot, some forgive nothing", () => {
    const easyGoing = () => 0.1;
    const harsh = () => 0.9;
    const badEvening = { customer: makeCustomer({ waitedSeconds: 120 }), pizza: pizza({ waitingSeconds: 60 }) };
    expect(rateOrder(badEvening.customer, badEvening.pizza, easyGoing)).toEqual({ stars: 3, reason: "cold" });
    // Five stars, but they still mention it: a kind review about the wait.
    expect(rateOrder(makeCustomer(), pizza({ waitingSeconds: 30 }), easyGoing)).toEqual({ stars: 5, reason: "lukewarm" });
    expect(rateOrder(makeCustomer({ waitedSeconds: 60 }), pizza(), harsh).stars).toBe(2);
    // A perfect evening pleases everyone.
    expect(rateOrder(makeCustomer(), pizza(), harsh).stars).toBe(5);
    expect([5, 4, 3, 2, 1].map(toneOf)).toEqual(["kind", "kind", "mixed", "harsh", "harsh"]);
  });

  it("are written far more often by unhappy customers", () => {
    // 0.4: above the happy customers' chance to write, below the unhappy ones'.
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    const state = makeState({ day: 7 });
    const written = writeReviews(state, [order(5), order(5), order(1), order(2), order(4)]);
    expect(written.map((review) => review.stars)).toEqual([1, 2]);
    expect(state.reviews).toHaveLength(2);
    expect(state.reviews[0]).toMatchObject({ day: 7, name: "Luca", stars: 1, reason: "cold" });
    expect(averageRating(state.reviewScore)).toBe(1.5);
  });

  it("make an overall rating that moves slowly: every review ever written counts", () => {
    expect(averageRating({ count: 0, total: 0 })).toBeNull();
    expect(averageRating({ count: 40, total: 190 })).toBe(4.8);
    expect(averageRating({ count: 41, total: 191 })).toBe(4.7);
  });

  it("are written at closing time, shown on the receipt and in the journal, and change nothing else", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const baked = play(stateInService([makeCustomer()]), ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
    const closed = play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
    expect(closed.phase).toBe("summary");
    expect(closed.summary?.reviews).toEqual([expect.objectContaining({ name: "Luca", stars: 5, reason: "perfect" })]);
    const html = renderToString(
      <I18nProvider value={createTranslator("en")}>
        <JournalView state={closed} />
      </I18nProvider>,
    );
    expect(html).toContain("Online reviews");
    expect(html).toContain("1 review");
    expect(html).toMatch(/« (Perfect, served piping hot|Best pizza in the neighbourhood|Quick, friendly, delicious)/);
  });

  it("start empty in an older save", () => {
    const { reviews, reviewScore, ...older } = makeState();
    expect(reviews).toEqual([]);
    expect(hydrateState(toJson(older)).reviewScore).toEqual(reviewScore);
  });

  it("come from the papers for food critics, shown in the journal", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const baked = play(stateInService([makeCustomer({ name: "Mme Sato", critic: true })]), ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
    const served = play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
    expect(served.press).toEqual([expect.objectContaining({ critic: "Mme Sato", stars: 5, paper: 0 })]);
    // A critic never writes an online review.
    expect(served.summary?.reviews).toEqual([]);
    const html = renderToString(
      <I18nProvider value={createTranslator("en")}>
        <JournalView state={served} />
      </I18nProvider>,
    );
    expect(html).toContain("In the papers");
    expect(html).toContain("Le Petit Gourmet");
    expect(html).toContain("Day 1 · Food critic");
    expect(html).toContain("— Mme Sato");
  });

  it("show in the header as five stars filled as far as the rating goes, empty before the first review", () => {
    const header = (reviewScore: { count: number; total: number }) =>
      renderToString(
        <I18nProvider value={createTranslator("en")}>
          <Header state={makeState({ reviewScore })} dispatch={() => undefined} />
        </I18nProvider>,
      );
    expect(header({ count: 0, total: 0 })).toMatch(/aria-label="No online reviews yet"[\s\S]*width:0%/);
    expect(header({ count: 10, total: 39 })).toMatch(/aria-label="3.9 out of 5 · 10 online reviews"[\s\S]*width:78%/);
  });

  it("are shown three at a time in the journal, newest first, with pages to turn", () => {
    const state = makeState();
    state.reviews = Array.from({ length: 7 }, (_, index) => ({
      day: index + 1, name: `Guest ${index + 1}`, stars: 5, reason: "perfect" as const, line: 0, recipeId: "margherita" as const, recipeName: null,
    }));
    const html = renderToString(
      <I18nProvider value={createTranslator("en")}>
        <JournalView state={state} />
      </I18nProvider>,
    );
    expect(html.match(/class="review"/g)).toHaveLength(3);
    expect(html).toContain("Guest 7");
    expect(html).not.toContain("Guest 4");
    expect(html).toContain("Page 1 / 3");
  });
});

describe("the day's receipt", () => {
  it("marks the people who came as a table", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = stateInService([makeCustomer({ tableId: "t" }), makeCustomer({ id: "c2", name: "Zoé", tableId: "t" })]);
    serviceOf(state).tables = { t: { size: 2, served: 0, allHappy: true, color: 2 } };
    const serveOne = (current: typeof state) => {
      const baked = play(current, ...toggle(...MARGHERITA), { type: "bake" }, { type: "tick", seconds: 10 });
      return play(baked, { type: "servePizza", pizzaId: serviceOf(baked).ready[0].id });
    };
    const closed = serveOne(serveOne(state));
    expect(closed.summary?.orders?.map((order) => order.table)).toEqual([{ size: 2, color: 2 }, { size: 2, color: 2 }]);
    const html = renderToString(
      <I18nProvider value={createTranslator("en")}>
        {closed.summary && <DaySummary summary={closed.summary} pizzeriaName="Chez Fran" onNextDay={() => undefined} />}
      </I18nProvider>,
    );
    expect(html.match(/receipt-order at-table tb-2/g)).toHaveLength(2);
    expect(html).toContain("Table of 2");
  });
});
