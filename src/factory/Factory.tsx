// Forno Infinito's page: the counter, the sales, the kitchen, the chain, the upgrades and the journal; the goal of the
// moment always in view, and a guided tour for the first steps. On a computer every part shows at once; on a phone,
// tabs at the bottom keep each part to one screen.
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  advance, AUTOMATION_OWNERS, clickPower, buyCrate, buyMarketing, buyUpgrade, changePrice, cookCapacity, cookCost, crateCost, crateSize, demandRate,
  fairPrice, hireCooks, hiringPlan, isForSale, makePizza, marketingCost, newFactory, openRestaurant, productionRate, readFactory, restaurantCost, tick, toggleAutomation,
  UPGRADE_IDS, UPGRADES, type Automation, type FactoryState,
} from "./engine";
import { acknowledge, bubbleFor, goalFor, newCoach, readCoach, settle, STEP_IDS, type Bubble, type Coach, type Section } from "./coach";
import type { FactoryTexts } from "./texts";

export const STORAGE_KEY = "forno-lento-factory-v1";
const TICK_MS = 200;
const SAVE_EVERY_MS = 5000;
/** Away for longer than this, the page says what happened meanwhile. */
const AWAY_REPORT_SECONDS = 60;
const POP_MS = 800;
const NARROW = "(max-width: 700px)";

// --- Saving ---------------------------------------------------------------------------------------------------------

interface Saved {
  state: FactoryState;
  savedAt: number;
  coach: Coach;
}

export const loadFactory = (raw: string | null): Saved | null => {
  try {
    const saved = JSON.parse(raw ?? "null") as { state?: unknown; savedAt?: unknown; coach?: unknown } | null;
    const state = readFactory(saved?.state);
    if (!state || typeof saved?.savedAt !== "number" || !Number.isFinite(saved.savedAt)) return null;
    return { state, savedAt: saved.savedAt, coach: readCoach(saved.coach) };
  } catch {
    return null;
  }
};

const readStorage = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStorage = (state: FactoryState, coach: Coach) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, savedAt: Date.now(), coach } satisfies Saved));
  } catch {
    // Private browsing or full storage: the factory simply isn't kept.
  }
};

// --- Numbers --------------------------------------------------------------------------------------------------------

export const formatters = (locale: string) => {
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const rate = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const euros = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const compactEuros = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 });
  const huge = (n: number) => n.toExponential(2).replace("e+", "e");
  return {
    count: (n: number) => (n >= 1e15 ? huge(n) : n >= 10_000 ? compact.format(n) : whole.format(Math.floor(n))),
    rate: (n: number) => (n >= 1e15 ? huge(n) : n >= 10_000 ? compact.format(n) : rate.format(n)),
    money: (n: number) => (n >= 1e15 ? `${huge(n)} €` : n >= 10_000 ? compactEuros.format(n) : euros.format(n)),
    time: (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return h ? `${h} h ${String(m).padStart(2, "0")}` : `${Math.max(1, m)} min`;
    },
  };
};

// --- Layout ---------------------------------------------------------------------------------------------------------

export type Tab = "counter" | "kitchen" | "upgrades" | "journal";
export const TABS: readonly Tab[] = ["counter", "kitchen", "upgrades", "journal"];

/** Which phone tab each part of the page sits in. */
export const TAB_OF: Record<Section | "journal", Tab> = {
  counter: "counter",
  stats: "counter",
  sales: "counter",
  supplies: "counter",
  kitchen: "kitchen",
  chain: "kitchen",
  automations: "upgrades",
  upgrades: "upgrades",
  journal: "journal",
};

const TAB_ICONS: Record<Tab, string> = { counter: "🍕", kitchen: "🔥", upgrades: "⭐", journal: "📜" };

/** The parts in each tab, side by side on a computer, one under the other on a phone. Every part is always there (the
 * chain and the automations locked until they open), so nothing moves when something new shows up. */
export const TAB_SECTIONS: Record<Tab, readonly (Section | "journal")[]> = {
  counter: ["counter", "sales", "supplies"],
  kitchen: ["kitchen", "chain"],
  upgrades: ["upgrades", "automations"],
  journal: ["journal"],
};

const isNarrowScreen = () => typeof window !== "undefined" && window.matchMedia?.(NARROW).matches === true;

const useIsNarrow = (): boolean => {
  const [isNarrow, setNarrow] = useState(isNarrowScreen);
  useEffect(() => {
    const query = window.matchMedia?.(NARROW);
    if (!query) return;
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isNarrow;
};

// --- Pieces ---------------------------------------------------------------------------------------------------------

const PizzaArt = () => (
  <svg viewBox="-50 -50 100 100" className="fi-pizza-svg" aria-hidden="true">
    <circle r="47" fill="#d9a35b" />
    <circle r="40" fill="#cf4a2a" />
    {[[-14, -12, 9], [13, -16, 8], [16, 10, 9], [-12, 15, 8], [0, 0, 7]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="#f6e3b4" />
    ))}
    {[[-24, 0], [2, -27], [26, -4], [3, 26], [-6, 12]].map(([x, y], i) => (
      <g key={i} transform={`translate(${x} ${y}) rotate(${i * 70})`}>
        <path d="M0,-6 C4,-3 4,3 0,6 C-4,3 -4,-3 0,-6Z" fill="#3c8c37" />
      </g>
    ))}
    {[[-22, -22], [24, 22], [-26, 24], [22, -28]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="5.5" fill="#a52a24" />
    ))}
  </svg>
);

// The circuit at the top: ingredients, through the kitchen, to the display, through the customers, to the till.
const FlowNode = ({ icon, label, value, sub, isBlocked = false }: { icon: string; label: string; value: string; sub?: string; isBlocked?: boolean }) => (
  <div className={`fi-node${isBlocked ? " blocked" : ""}`}>
    <span className="fi-node-icon" aria-hidden="true">{icon}</span>
    <span className="fi-node-label">{label}</span>
    <span className="fi-node-value">{value}</span>
    {sub && <span className="fi-node-sub">{sub}</span>}
  </div>
);

const FlowLink = ({ icon, label, rate, isBlocked }: { icon: string; label: string; rate: string; isBlocked: boolean }) => (
  <div className={`fi-link${isBlocked ? " blocked" : ""}`}>
    <span className="fi-link-rate"><span aria-hidden="true">{icon}</span> {rate}</span>
    <span className="fi-link-arrow" aria-hidden="true" />
    <span className="fi-link-label">{label}</span>
  </div>
);

// Small drawings, so each part shows what it holds at a glance. Past a few, one icon stands for many.
const MAX_ICONS = 20;

const IconRow = ({ filled, empty = 0, icon, emptyIcon, label, more }: { filled: number; empty?: number; icon: ReactNode; emptyIcon?: ReactNode; label: string; more?: string }) => (
  <div className="fi-icons" role="img" aria-label={label}>
    {Array.from({ length: filled }, (_, i) => <span key={`f${i}`} className="fi-icon">{icon}</span>)}
    {Array.from({ length: empty }, (_, i) => <span key={`e${i}`} className="fi-icon empty">{emptyIcon ?? icon}</span>)}
    {more && <span className="fi-icons-more">{more}</span>}
  </div>
);

const ChefHat = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 15h12v-3.2a3.6 3.6 0 0 0-1.4-6.6 4.2 4.2 0 0 0-7.2 0A3.6 3.6 0 0 0 6 11.8z" fill="currentColor" />
    <rect x="6" y="16" width="12" height="4" rx="1" fill="currentColor" />
  </svg>
);

/** The kitchen crew: a hat for each cook, an outline for each free place (scaled down when there are many). */
const Brigade = ({ cooks, capacity, label }: { cooks: number; capacity: number; label: string }) => {
  const scale = Math.max(1, capacity / MAX_ICONS);
  const shown = Math.round(capacity / scale);
  const filled = Math.min(shown, Math.round(cooks / scale));
  return <IconRow filled={filled} empty={shown - filled} icon={<ChefHat />} label={label} more={scale > 1 ? `×${Math.round(scale)}` : undefined} />;
};

const Crates = ({ kits, crateSize, label }: { kits: number; crateSize: number; label: string }) => {
  const crates = Math.ceil(kits / crateSize);
  return <IconRow filled={Math.min(crates, 10)} icon="📦" label={label} more={crates > 10 ? `+${crates - 10}` : undefined} />;
};

const SHELF_ICONS = 8;

const Shelf = ({ pizzas, label }: { pizzas: number; label: string }) => {
  const count = Math.floor(pizzas);
  return count < 1 ? <div className="fi-icons empty-shelf" role="img" aria-label={label} /> : <IconRow filled={Math.min(count, SHELF_ICONS)} icon="🍕" label={label} more={count > SHELF_ICONS ? `+${count - SHELF_ICONS}` : undefined} />;
};

// A little pizzeria: a red and white awning over a shop front.
const Shopfront = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="1" fill="#f3e2c4" stroke="#9e6b3a" strokeWidth="1" />
    <rect x="10" y="14" width="4" height="7" fill="#9e6b3a" />
    <path d="M3 6h18l-1 5H4z" fill="#c63a21" />
    <path d="M7.5 6l-.6 5M12 6v5M16.5 6l.6 5" stroke="#fff" strokeWidth="1.6" />
  </svg>
);

const Storefronts = ({ restaurants, label }: { restaurants: number; label: string }) => (
  <IconRow filled={Math.min(restaurants, MAX_ICONS)} icon={<Shopfront />} label={label} more={restaurants > MAX_ICONS ? `+${restaurants - MAX_ICONS}` : undefined} />
);

interface CardProps {
  section: Section | "journal";
  title: string;
  /** What this part is for, in a line: behind a "?", shown when the tour points here. */
  help?: string;
  helpLabel: string;
  children: ReactNode;
  className?: string;
  /** The guided tour points at this part. */
  isTarget: boolean;
}

const Card = ({ section, title, help, helpLabel, children, className = "", isTarget }: CardProps) => {
  const [isHelpOpen, setHelpOpen] = useState(false);
  return (
    <section className={`fi-card ${className}${isTarget ? " coach-target" : ""}`} data-section={section}>
      <div className="fi-card-head">
        <h2 className="fi-card-title">{title}</h2>
        {help && (
          <button className={`fi-help-btn${isHelpOpen ? " on" : ""}`} onClick={() => setHelpOpen(!isHelpOpen)} aria-expanded={isHelpOpen} aria-label={helpLabel}>?</button>
        )}
      </div>
      {help && (isHelpOpen || isTarget) && <p className="fi-card-help">{help}</p>}
      {children}
    </section>
  );
};

const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// The bubble never hides what it points at: when they would overlap, it moves to the other end of the screen (the top
// on a phone, the left on a computer), and back when the way is clear.
const useBubbleSide = (target: Section | null, bubbleKey: string, isNarrow: boolean) => {
  const ref = useRef<HTMLElement>(null);
  const [isFlipped, setFlipped] = useState(false);
  useEffect(() => {
    setFlipped(false);
    if (!target) return;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bubble = ref.current;
        const part = document.querySelector(`[data-section="${target}"]`);
        if (!bubble || !part) return;
        // Where the bubble sits when not flipped: the bottom of the screen (above the tabs on a phone), on the right.
        const { width, height } = bubble.getBoundingClientRect();
        const bottom = window.innerHeight - (isNarrow ? 70 : 20);
        const home = new DOMRect(isNarrow ? 12 : window.innerWidth - 20 - width, bottom - height, width, height);
        setFlipped(overlaps(home, part.getBoundingClientRect()));
      });
    };
    const timer = window.setTimeout(check, 450);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [target, bubbleKey, isNarrow]);
  return { ref, isFlipped };
};

interface CoachBubbleProps {
  bubble: Bubble;
  isNarrow: boolean;
  texts: FactoryTexts;
  onAck: () => void;
  onSkip: () => void;
}

const CoachBubble = ({ bubble, isNarrow, texts, onAck, onSkip }: CoachBubbleProps) => {
  const words = bubble.kind === "step" ? texts.steps[bubble.id] : texts.tips[bubble.id];
  const canAck = bubble.kind === "tip" || bubble.needsAck;
  const { ref, isFlipped } = useBubbleSide(bubble.target, `${bubble.kind}-${bubble.id}`, isNarrow);
  return (
    <aside ref={ref} className={`fi-bubble${isFlipped ? " flipped" : ""}`} role="dialog" aria-live="polite" aria-label={words.title}>
      <span className="fi-bubble-kicker">{bubble.kind === "step" ? texts.stepOf(bubble.index + 1, bubble.count) : texts.tip}</span>
      <strong className="fi-bubble-title">{words.title}</strong>
      <p className="fi-bubble-text">{words.text}</p>
      <div className="fi-bubble-actions">
        {bubble.kind === "step" && bubble.id !== "tourDone" && (
          <button className="fi-btn ghost small" onClick={onSkip}>{texts.skipTour}</button>
        )}
        {canAck && <button className="fi-btn primary small" onClick={onAck}>{texts.gotIt}</button>}
      </div>
    </aside>
  );
};

// --- The page -------------------------------------------------------------------------------------------------------

export const Factory = ({ texts, initialTab = "counter" }: { texts: FactoryTexts; initialTab?: Tab }) => {
  const f = formatters(texts.locale);
  const [saved] = useState(() => loadFactory(readStorage()));
  const [state, setState] = useState<FactoryState>(() => {
    if (!saved) return newFactory();
    // Time away: the restaurants went on without the player.
    const away = (Date.now() - saved.savedAt) / 1000;
    return away < AWAY_REPORT_SECONDS ? saved.state : advance(saved.state, away);
  });
  const [coach, setCoach] = useState<Coach>(() => saved?.coach ?? newCoach());
  const [awayReport, setAwayReport] = useState<string | null>(() => {
    if (!saved) return null;
    const away = (Date.now() - saved.savedAt) / 1000;
    return away < AWAY_REPORT_SECONDS ? null : "pending";
  });
  const [pops, setPops] = useState<{ id: number; amount: number; x: number }[]>([]);
  const [isConfirmingReset, setConfirmingReset] = useState(false);
  const isNarrow = useIsNarrow();
  const [tab, setTab] = useState<Tab>(initialTab);
  const latest = useRef({ state, coach });
  latest.current = { state, coach };

  // What happened while away, from the save and the catch-up, said once.
  useEffect(() => {
    if (awayReport !== "pending" || !saved) return;
    const sold = state.totalSold - saved.state.totalSold;
    const earned = state.totalEarned - saved.state.totalEarned;
    setAwayReport(sold >= 1 ? texts.away(f.time((Date.now() - saved.savedAt) / 1000), f.count(sold), f.money(earned)) : null);
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Time goes by: small steps while the page is in view, one big catch-up after it was hidden.
  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setState((s) => (dt > 2 ? advance(s, dt) : tick(s, dt)));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Kept every few seconds and as the page goes away.
  useEffect(() => {
    const save = () => writeStorage(latest.current.state, latest.current.coach);
    const timer = window.setInterval(save, SAVE_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && save();
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  // The tour moves on as soon as a step is done.
  useEffect(() => {
    setCoach((c) => settle(c, state));
  }, [state]);

  const bubble = bubbleFor(coach, state);
  const target = bubble?.target ?? null;

  // The part the tour points at comes into view (on a phone, its tab opens first).
  const bubbleKey = bubble ? `${bubble.kind}-${bubble.id}` : "";
  useLayoutEffect(() => {
    if (!target) return;
    setTab(TAB_OF[target]);
    const timer = window.setTimeout(() => {
      document.querySelector(`[data-section="${target}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return () => window.clearTimeout(timer);
    // Each new bubble, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbleKey, isNarrow]);

  const act = useCallback((action: (s: FactoryState) => FactoryState | null) => setState((s) => action(s) ?? s), []);

  const onMakePizza = () => {
    const before = latest.current.state;
    act(makePizza);
    const made = Math.min(clickPower(before), Math.floor(before.kits));
    if (made <= 0) return;
    const id = performance.now();
    setPops((list) => [...list.slice(-6), { id, amount: made, x: Math.round((Math.random() - 0.5) * 80) }]);
    window.setTimeout(() => setPops((list) => list.filter((pop) => pop.id !== id)), POP_MS);
  };

  const reset = () => {
    if (!isConfirmingReset) {
      setConfirmingReset(true);
      window.setTimeout(() => setConfirmingReset(false), 3000);
      return;
    }
    setConfirmingReset(false);
    const fresh = newFactory();
    setState(fresh);
    setCoach(newCoach());
    setTab("counter");
    writeStorage(fresh, newCoach());
  };

  const production = productionRate(state);
  const demand = demandRate(state);
  const capacity = cookCapacity(state);
  const sold = Math.min(demand, production + state.pizzas);
  const forSale = UPGRADE_IDS.filter((id) => isForSale(state, id));
  const affordableUpgrades = forSale.filter((id) => !UPGRADES[id].comingSoon && state.money >= UPGRADES[id].cost).length;
  const automations = Object.keys(AUTOMATION_OWNERS) as Automation[];
  // What holds the circuit back, if anything: no kits, too few customers, or too few cooks.
  const block: "kits" | "customers" | "kitchen" | null =
    state.kits < 1 && (production > 0 || state.totalMade > 0)
      ? "kits"
      : state.pizzas > Math.max(20, production * 30) || (production > demand * 1.3 && state.pizzas > 10)
        ? "customers"
        : demand > production * 1.3 && production > 0 && state.pizzas < 1
          ? "kitchen"
          : null;
  const suggested = production > 0 ? fairPrice(state, production + state.pizzas / 30) : null;
  const isPriceOff = suggested !== null && Math.abs(suggested - state.price) / state.price > 0.15;
  // What hiring would cost, whatever the till holds: one, ten, or every free place. A button is greyed out until it can
  // be paid for in full, but always there, so the kitchen never changes shape.
  const unlimited = { ...state, money: Infinity };
  const freePlaces = capacity - state.cooks;
  const hireOne = hiringPlan(unlimited, 1);
  const hireTen = hiringPlan(unlimited, 10);
  const hireAll = hiringPlan(unlimited, freePlaces);
  const isTourOver = coach.off || coach.step >= STEP_IDS.length;
  const goal = goalFor(state);
  const goalProgress = Math.min(1, goal.current / goal.target);
  // On a phone, only the open tab's parts show.
  const card = (section: Section | "journal") => ({ section, isTarget: target === section, helpLabel: texts.whatFor });

  const parts: Record<Section | "journal", ReactNode> = {
    stats: null,
    counter: (
      <Card {...card("counter")} title={texts.counter} help={texts.help.counter} className="fi-counter">
        <button className="fi-pizza" onClick={onMakePizza} disabled={state.kits < 1} aria-label={texts.makePizza}>
          <PizzaArt />
          {pops.map((pop) => (
            <span key={pop.id} className="fi-pop" style={{ "--x": `${pop.x}px` } as CSSProperties}>+{pop.amount}</span>
          ))}
        </button>
        <p className="fi-pizza-label">{state.kits < 1 ? texts.outOfKits : texts.makePizza}</p>
      </Card>
    ),
    sales: (
      <Card {...card("sales")} title={texts.sales} help={texts.help.sales}>
        <Shelf pizzas={state.pizzas} label={`${texts.flowShop} : ${f.count(state.pizzas)}`} />
        <div className="fi-price">
          <button className="fi-btn round" onClick={() => act((s) => changePrice(s, -1))} disabled={state.autoPrice} aria-label={texts.priceDown}>−</button>
          <div className="fi-price-value">
            <span className="fi-stat-label">{texts.price}</span>
            <strong>{f.money(state.price)}</strong>
          </div>
          <button className="fi-btn round" onClick={() => act((s) => changePrice(s, 1))} disabled={state.autoPrice} aria-label={texts.priceUp}>+</button>
        </div>
        <dl className="fi-rows">
          <div><dt>🙋 {texts.customers}</dt><dd>{f.rate(demand)}{texts.perSecond}</dd></div>
          <div><dt>🔥 {texts.production}</dt><dd>{f.rate(production)}{texts.perSecond}</dd></div>
        </dl>
        {/* Always one line here, whatever it says, so the card never changes height. */}
        <div className={`fi-suggest${isPriceOff && !state.autoPrice ? " off" : ""}`}>
          {state.autoPrice ? (
            <span>{texts.priceAuto}</span>
          ) : suggested === null ? (
            <span>{texts.priceWaiting}</span>
          ) : isPriceOff ? (
            <>
              <span>{texts.suggestedPrice(f.money(suggested))}</span>
              <button className="fi-btn small" onClick={() => act((s) => ({ ...s, price: suggested }))}>{texts.apply}</button>
            </>
          ) : (
            <span>{texts.priceOk}</span>
          )}
        </div>
      </Card>
    ),
    supplies: (
      <Card {...card("supplies")} title={texts.supplies} help={texts.help.supplies}>
        <Crates kits={state.kits} crateSize={crateSize(state)} label={`${texts.kits} : ${f.count(state.kits)}`} />
        <dl className="fi-rows">
          <div><dt>📦 {texts.kits}</dt><dd>{f.count(state.kits)}</dd></div>
          <div><dt>{texts.cratePrice}</dt><dd>{f.money(crateCost(state))}</dd></div>
        </dl>
        <button className="fi-btn primary wide" onClick={() => act(buyCrate)} disabled={state.money < crateCost(state)}>
          {texts.crate(f.count(crateSize(state)))} · {f.money(crateCost(state))}
        </button>
      </Card>
    ),
    kitchen: (
      <Card {...card("kitchen")} title={texts.kitchen} help={texts.help.kitchen}>
        <Brigade cooks={state.cooks} capacity={capacity} label={texts.places(f.count(state.cooks), f.count(capacity))} />
        <dl className="fi-rows">
          <div><dt>{texts.cooks}</dt><dd>{texts.places(f.count(state.cooks), f.count(capacity))}</dd></div>
        </dl>
        <div className="fi-hire">
          <button className="fi-btn primary one" onClick={() => act((s) => hireCooks(s, 1))} disabled={hireOne.count < 1 || state.money < hireOne.cost}>
            {texts.hireN(1, f.money(cookCost(state)))}
          </button>
          <button className="fi-btn" onClick={() => act((s) => hireCooks(s, 10))} disabled={hireTen.count < 10 || state.money < hireTen.cost}>
            {texts.hireN(10, hireTen.count < 10 ? "—" : f.money(hireTen.cost))}
          </button>
          <button className="fi-btn" onClick={() => act((s) => hireCooks(s, freePlaces))} disabled={freePlaces < 1 || state.money < hireAll.cost}>
            {texts.hireFill(freePlaces, freePlaces < 1 ? "—" : f.money(hireAll.cost))}
          </button>
        </div>
        <p className="fi-hint reserved">{state.cooks >= capacity ? (state.era >= 2 ? texts.kitchenFullChain : texts.kitchenFullHint) : ""}</p>
        <dl className="fi-rows">
          <div><dt>📣 {texts.marketing}</dt><dd>{texts.marketingLevel(state.marketing)}</dd></div>
        </dl>
        <button className="fi-btn wide" onClick={() => act(buyMarketing)} disabled={state.money < marketingCost(state)}>
          {texts.advertise} · {f.money(marketingCost(state))}
        </button>
      </Card>
    ),
    chain: (
      <Card {...card("chain")} title={texts.chain} help={texts.help.chain} className={state.era < 2 ? "locked" : ""}>
        <Storefronts restaurants={state.restaurants} label={texts.restaurantsCount(f.count(state.restaurants))} />
        {state.era < 2 ? (
          <p className="fi-hint">🔒 {texts.chainLocked}</p>
        ) : (
          <>
            <dl className="fi-rows">
              <div><dt>{texts.restaurants}</dt><dd>{f.count(state.restaurants)}</dd></div>
            </dl>
            <button className="fi-btn primary wide" onClick={() => act(openRestaurant)} disabled={state.money < restaurantCost(state)}>
              {texts.openRestaurant} · {f.money(restaurantCost(state))}
            </button>
            <p className="fi-hint soon">{texts.era3Soon}</p>
          </>
        )}
      </Card>
    ),
    automations: (
      <Card {...card("automations")} title={texts.automations} help={texts.help.automations}>
        {automations.map((which) => {
          const owner = AUTOMATION_OWNERS[which];
          return state.upgrades.includes(owner) ? (
            <label key={which} className="fi-switch">
              <input type="checkbox" checked={state[which]} onChange={() => act((s) => toggleAutomation(s, which))} />
              <span>{texts[which]}</span>
            </label>
          ) : (
            <div key={which} className="fi-switch off">
              <span aria-hidden="true">🔒</span>
              <span>{texts[which]} · <em>{texts.upgrade[owner].name}</em></span>
            </div>
          );
        })}
      </Card>
    ),
    upgrades: (
      <Card {...card("upgrades")} title={texts.upgrades} help={texts.help.upgrades} className="fi-upgrades">
        {forSale.length === 0 && <p className="fi-hint">{texts.noUpgrades}</p>}
        <ul className="fi-list">
          {forSale.map((id) => {
            const spec = UPGRADES[id];
            return (
              <li key={id} className="fi-upgrade">
                <div className="grow">
                  <strong>{texts.upgrade[id].name}</strong>
                  <span>{texts.upgrade[id].text}</span>
                </div>
                <button className="fi-btn primary" onClick={() => act((s) => buyUpgrade(s, id))} disabled={spec.comingSoon || state.money < spec.cost}>
                  {spec.comingSoon ? texts.comingSoon : f.money(spec.cost)}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    ),
    journal: (
      <Card {...card("journal")} title={texts.journal} className="fi-journal">
        <ol className="fi-log">
          {[...state.log].reverse().map((entry) => (
            <li key={entry.id}>
              {entry.key === "upgradeBought" && entry.upgrade ? `${texts.message.upgradeBought}${texts.upgrade[entry.upgrade].name}.` : texts.message[entry.key]}
            </li>
          ))}
        </ol>
      </Card>
    ),
  };

  // The tabs: along the top on a computer, at the bottom on a phone.
  const tabBar = (
    <nav className={`fi-tabs ${isNarrow ? "bottom" : "top"}`} aria-label={texts.title}>
      {TABS.map((id) => {
        const label = { counter: texts.tabCounter, kitchen: texts.tabKitchen, upgrades: texts.tabUpgrades, journal: texts.tabJournal }[id];
        const badge = id === "upgrades" && affordableUpgrades > 0 ? affordableUpgrades : 0;
        return (
          <button key={id} className={`fi-tab${tab === id ? " on" : ""}${target && TAB_OF[target] === id && tab !== id ? " coach-target" : ""}`} aria-current={tab === id} onClick={() => setTab(id)}>
            <span className="fi-tab-icon" aria-hidden="true">{TAB_ICONS[id]}</span>
            <span className="fi-tab-label">{label}</span>
            {badge > 0 && <span className="fi-tab-badge">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className={`fi ${isNarrow ? "narrow" : "wide"}${bubble ? " coaching" : ""}`}>
      <header className="fi-head">
        <a className="fi-back" href="../">{texts.backToGame}</a>
        <div className="fi-brand">
          <h1 className="fi-title">{texts.title}</h1>
          <p className="fi-tagline">{texts.tagline}</p>
        </div>
        <span className="fi-era">{state.era === 1 ? texts.era1 : texts.era2}</span>
      </header>

      <div className={`fi-top${target === "stats" ? " coach-target" : ""}`} data-section="stats">
        <div className="fi-flow" role="status">
          <FlowNode icon="📦" label={texts.flowKits} value={f.count(state.kits)} isBlocked={block === "kits"} />
          <FlowLink icon="🔥" label={texts.flowKitchen} rate={`${f.rate(production)}${texts.perSecond}`} isBlocked={block === "kitchen"} />
          <FlowNode icon="🍕" label={texts.flowShop} value={f.count(state.pizzas)} isBlocked={block === "customers"} />
          <FlowLink icon="🙋" label={texts.flowCustomers} rate={`${f.rate(sold)}${texts.perSecond}`} isBlocked={block === "customers"} />
          <FlowNode icon="💶" label={texts.flowTill} value={f.money(state.money)} sub={texts.soldSoFar(f.count(state.totalSold))} />
        </div>
        <p className={`fi-flow-status${block ? " blocked" : ""}`}>
          {block === "kits" ? texts.blockKits : block === "customers" ? texts.blockCustomers : block === "kitchen" ? texts.blockKitchen : texts.flowOk}
        </p>
        <div className="fi-goal">
          <span className="fi-goal-label">{texts.goal}</span>
          <span className="fi-goal-text">{texts.goals[goal.id]}</span>
          <div className="fi-goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalProgress * 100)}>
            <i style={{ width: `${goalProgress * 100}%` }} />
          </div>
        </div>
      </div>

      {awayReport && awayReport !== "pending" && (
        <button className="fi-away" onClick={() => setAwayReport(null)}>
          {awayReport} <span aria-hidden="true">✕</span>
        </button>
      )}

      {tabBar}

      <main className={`fi-panel count-${TAB_SECTIONS[tab].length}`}>
        {TAB_SECTIONS[tab].map((section) => (
          <Fragment key={section}>{parts[section]}</Fragment>
        ))}
      </main>

      {tab === "journal" && (
        <footer className="fi-foot">
          {/* While the tour runs, it can be skipped; once over or skipped, it can be replayed (the tips come again too). */}
          <button className="fi-btn ghost" onClick={() => setCoach(isTourOver ? newCoach() : { ...coach, off: true })}>
            {isTourOver ? texts.replayTour : texts.skipTour}
          </button>
          <button className={`fi-btn ghost${isConfirmingReset ? " danger" : ""}`} onClick={reset}>
            {isConfirmingReset ? texts.confirmReset : texts.reset}
          </button>
        </footer>
      )}

      {bubble && (
        <CoachBubble
          bubble={bubble}
          isNarrow={isNarrow}
          texts={texts}
          onAck={() => setCoach((c) => acknowledge(c, bubble))}
          onSkip={() => setCoach((c) => ({ ...c, off: true }))}
        />
      )}

    </div>
  );
};
