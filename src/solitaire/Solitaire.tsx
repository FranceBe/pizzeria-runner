// The solitaire's page: the scores, the buttons, the table, the options and the win.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { autoTarget, canFinish, cardsAt, deal, draw, finishStep, move, timeBonus, type Card, type DrawCount, type Game, type Place, type Source } from "./klondike";
import { dropPlace, layoutFor, locate, type Location } from "./layout";
import { loadSave, recordsKey, withWin, writeSave, type SolitaireSave } from "./storage";
import type { SolitaireTexts } from "./texts";
import { CardBack, CardFace, Pip } from "./CardFace";

const UNDO_KEPT = 200;
const DOUBLE_CLICK_MS = 400;
const DRAG_THRESHOLD = 6;
const FINISH_STEP_MS = 90;
const LIFT_MS = 260;

export const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

interface Drag {
  cardIds: string[];
  from: Source | null;
  /** A card of the stock (or its empty spot): a tap draws. */
  isStock: boolean;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
  pointerType: string;
  cardId: string | null;
}

const toSource = (location: Location): Source | null => (location.pile === "stock" ? null : location);

// Only the top of the waste and of a foundation can be picked up; in a column, any face-up card that heads a run.
const pickable = (game: Game, location: Location, cardId: string): boolean => {
  if (location.pile === "waste") return game.waste.at(-1)?.id === cardId;
  if (location.pile === "foundation") return game.foundations[location.index].at(-1)?.id === cardId;
  if (location.pile === "tableau") return Boolean(cardsAt(game, location));
  return false;
};

// Watches the table's width and how much height is left under it on the screen.
const useTableSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const top = node.getBoundingClientRect().top + window.scrollY;
      setSize({ width: node.clientWidth, height: Math.max(320, window.innerHeight - top - 12) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return { ref, ...size };
};

interface CardViewProps {
  card: Card;
  texts: SolitaireTexts;
}

const CardView = ({ card, texts }: CardViewProps) =>
  card.faceUp ? <CardFace suit={card.suit} rank={card.rank} label={texts.ranks[card.rank - 1]} /> : <CardBack />;

export const Solitaire = ({ texts }: { texts: SolitaireTexts }) => {
  const [save, setSave] = useState<SolitaireSave>(loadSave);
  const [game, setGame] = useState<Game>(() => save.game ?? deal(save.drawCount));
  const [history, setHistory] = useState<Game[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [lifted, setLifted] = useState<ReadonlySet<string>>(new Set());
  const [isOptionsOpen, setOptionsOpen] = useState(false);
  const [isConfirmingNew, setConfirmingNew] = useState(false);
  const [win, setWin] = useState<{ score: number; bonus: number; moves: number; seconds: number; isNewBest: boolean } | null>(null);
  const lastTap = useRef<{ cardId: string; at: number } | null>(null);
  const table = useTableSize();
  const layout = useMemo(() => layoutFor(game, table.width || 320, table.height || 600), [game, table.width, table.height]);

  // The latest game and save, for the timer and for saving as the page goes away.
  const latest = useRef({ game, save });
  latest.current = { game, save };

  const play = useCallback((next: Game | null) => {
    if (!next) return false;
    setHistory((past) => [...past.slice(-(UNDO_KEPT - 1)), latest.current.game]);
    setGame(next);
    return true;
  }, []);

  // Cards that just changed piles fly above the others for a moment.
  const previousPiles = useRef(new Map<string, string>());
  useLayoutEffect(() => {
    const piles = new Map<string, string>();
    const record = (prefix: string, pile: Card[]) => pile.forEach((card) => piles.set(card.id, prefix));
    record("s", game.stock);
    record("w", game.waste);
    game.foundations.forEach((pile, i) => record(`f${i}`, pile));
    game.tableau.forEach((pile, i) => record(`t${i}`, pile));
    const changed = [...piles].filter(([id, pile]) => previousPiles.current.has(id) && previousPiles.current.get(id) !== pile).map(([id]) => id);
    previousPiles.current = piles;
    if (!changed.length) return;
    setLifted(new Set(changed));
    const timer = window.setTimeout(() => setLifted(new Set()), LIFT_MS);
    return () => window.clearTimeout(timer);
  }, [game.stock, game.waste, game.foundations, game.tableau]);

  // The clock runs from the first move until the win, only while the page is in view.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = latest.current.game;
      if (document.visibilityState !== "visible" || current.won || current.moves === 0) return;
      setGame((g) => (g.won || g.moves === 0 ? g : { ...g, seconds: g.seconds + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Everything left showing goes up on its own, one card after the other.
  useEffect(() => {
    if (!canFinish(game) || drag) return;
    const timer = window.setTimeout(() => setGame((g) => finishStep(g) ?? g), FINISH_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [game, drag]);

  // A win goes into the records once.
  const hasRecordedWin = useRef(game.won);
  useEffect(() => {
    if (!game.won || hasRecordedWin.current) return;
    hasRecordedWin.current = true;
    const key = recordsKey(game.drawCount);
    const { records, isNewBest } = withWin(save.records[key], game);
    setSave((s) => ({ ...s, records: { ...s.records, [key]: records } }));
    setWin({ score: game.score, bonus: timeBonus(game.seconds), moves: game.moves, seconds: game.seconds, isNewBest });
  }, [game, save.records]);

  // Kept after every move and option change, and as the page goes away (the clock too).
  const persist = useCallback(() => {
    const { game: current, save: saved } = latest.current;
    writeSave({ ...saved, game: current.won ? null : current });
  }, []);
  useEffect(persist, [persist, game.moves, game.won, save]);
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && persist();
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persist]);

  const startNewGame = (drawCount: DrawCount = save.drawCount) => {
    hasRecordedWin.current = false;
    setGame(deal(drawCount));
    setHistory([]);
    setWin(null);
    setConfirmingNew(false);
  };

  const onNewGame = () => {
    if (game.moves === 0 || game.won || isConfirmingNew) return startNewGame();
    setConfirmingNew(true);
  };
  useEffect(() => {
    if (!isConfirmingNew) return;
    const timer = window.setTimeout(() => setConfirmingNew(false), 3000);
    return () => window.clearTimeout(timer);
  }, [isConfirmingNew]);

  const undo = () => {
    const previous = history.at(-1);
    if (!previous || game.won) return;
    setHistory(history.slice(0, -1));
    setGame({ ...previous, seconds: game.seconds });
  };

  const setDrawCount = (drawCount: DrawCount) => {
    setSave((s) => ({ ...s, drawCount }));
    // A game not started yet is dealt again the new way; one under way keeps its own.
    if (game.moves === 0 && game.drawCount !== drawCount) startNewGame(drawCount);
  };

  const send = (location: Location) => {
    const from = toSource(location);
    const to = from && autoTarget(game, from);
    if (from && to) play(move(game, from, to));
  };

  const onCardDown = (event: ReactPointerEvent, cardId: string | null) => {
    if (event.button !== 0 || drag || game.won) return;
    const location = cardId ? locate(game, cardId) : { pile: "stock" as const };
    if (!location) return;
    const isStock = location.pile === "stock";
    if (!isStock && (!cardId || !pickable(game, location, cardId))) return;
    const source = toSource(location);
    const cards = source ? cardsAt(game, source) : null;
    event.preventDefault();
    setDrag({
      cardIds: isStock ? [] : (cards ?? []).map((card) => card.id),
      from: source,
      isStock,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      moved: false,
      pointerType: event.pointerType,
      cardId,
    });
  };

  // While a card is held: it follows the pointer; let go, it goes where it was dropped (or back), or a tap sends it.
  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const moved = drag.moved || Math.hypot(dx, dy) > DRAG_THRESHOLD;
      if (drag.isStock) {
        if (moved !== drag.moved) setDrag({ ...drag, moved });
        return;
      }
      setDrag({ ...drag, dx, dy, moved });
    };
    const onUp = () => {
      setDrag(null);
      const { game: current } = latest.current;
      if (drag.isStock) {
        if (!drag.moved) play(draw(current));
        return;
      }
      if (!drag.from || !drag.cardId) return;
      if (drag.moved) {
        const top = layout.spots.get(drag.cardIds[0]);
        if (!top) return;
        const to: Place | null = dropPlace(layout, top.x + drag.dx + layout.cardWidth / 2, top.y + drag.dy + layout.cardHeight / 2);
        if (to) play(move(current, drag.from, to));
        return;
      }
      if (!latest.current.save.tapToSend) return;
      // A finger sends the card with one tap; a mouse with a double click.
      if (drag.pointerType !== "mouse") return send(drag.from);
      const now = performance.now();
      const isDouble = lastTap.current?.cardId === drag.cardId && now - lastTap.current.at < DOUBLE_CLICK_MS;
      lastTap.current = isDouble ? null : { cardId: drag.cardId, at: now };
      if (isDouble) send(drag.from);
    };
    const onCancel = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  });

  const records = save.records[recordsKey(game.drawCount)];
  const allCards = [game.stock, game.waste, ...game.foundations, ...game.tableau].flat();
  const draggedIds = drag?.moved ? new Set(drag.cardIds) : null;
  // Cards buried in a pile (the stock, the waste under its fan, the foundations) cast no shadow: piled up, the
  // shadows would darken into a thick edge.
  const buried = new Set(
    [game.stock.slice(0, -1), game.waste.slice(0, -(game.drawCount === 3 ? 3 : 1)), ...game.foundations.map((pile) => pile.slice(0, -1))]
      .flat()
      .map((card) => card.id),
  );
  const slot = (x: number, y: number) => ({ transform: `translate(${x}px, ${y}px)`, width: layout.cardWidth, height: layout.cardHeight });

  return (
    <div className="sol">
      <header className="sol-head">
        <a className="sol-back" href="../">{texts.backToGame}</a>
        <h1 className="sol-title">{texts.title}</h1>
        <button className="sol-btn ghost" onClick={() => setOptionsOpen(true)} aria-label={texts.options}>⚙︎</button>
      </header>
      <div className="sol-bar">
        <dl className="sol-stats">
          <div><dt>{texts.score}</dt><dd>{game.score}</dd></div>
          <div><dt>{texts.moves}</dt><dd>{game.moves}</dd></div>
          <div><dt>{texts.time}</dt><dd>{formatTime(game.seconds)}</dd></div>
          <div><dt>{texts.best}</dt><dd>{records.bestScore || texts.none}</dd></div>
        </dl>
        <div className="sol-actions">
          <button className="sol-btn" onClick={undo} disabled={!history.length || game.won}>{texts.undo}</button>
          <button className={`sol-btn primary${isConfirmingNew ? " confirm" : ""}`} onClick={onNewGame}>
            {isConfirmingNew ? texts.confirmNewGame : texts.newGame}
          </button>
        </div>
      </div>

      <div className="sol-table" ref={table.ref} style={{ height: layout.height }}>
        {table.width > 0 && (
          <>
            <button
              className={`sol-slot stock-slot${game.stock.length ? "" : " empty"}`}
              style={slot(layout.columnX(0), 0)}
              aria-label={game.stock.length ? texts.stock : texts.emptyStock}
              onPointerDown={(event) => onCardDown(event, null)}
            >
              {!game.stock.length && game.waste.length > 0 && <span className="sol-recycle">↻</span>}
            </button>
            {game.foundations.map((_, i) => (
              <div key={i} className="sol-slot" style={slot(layout.columnX(3 + i), 0)}><span className="sol-slot-mark">A</span></div>
            ))}
            {game.tableau.map((_, i) => (
              <div key={i} className="sol-slot" style={slot(layout.columnX(i), layout.tableauTop)}><span className="sol-slot-mark">{texts.ranks[12]}</span></div>
            ))}
            {allCards.map((card) => {
              const spot = layout.spots.get(card.id);
              if (!spot) return null;
              const isDragged = draggedIds?.has(card.id) ?? false;
              const x = spot.x + (isDragged ? drag!.dx : 0);
              const y = spot.y + (isDragged ? drag!.dy : 0);
              const z = spot.z + (isDragged ? 2000 : lifted.has(card.id) ? 1000 : 0);
              return (
                <div
                  key={card.id}
                  className={`sol-card${isDragged ? " dragging" : ""}${card.faceUp ? "" : " down"}${buried.has(card.id) && !lifted.has(card.id) ? " buried" : ""}`}
                  style={{ transform: `translate(${x}px, ${y}px)`, zIndex: z, width: layout.cardWidth, height: layout.cardHeight }}
                  role="img"
                  aria-label={card.faceUp ? texts.cardName(texts.ranks[card.rank - 1], texts.suits[card.suit]) : texts.stock}
                  onPointerDown={(event) => onCardDown(event, card.id)}
                >
                  <CardView card={card} texts={texts} />
                </div>
              );
            })}
          </>
        )}
      </div>

      {isOptionsOpen && (
        <div className="sol-modal" role="dialog" aria-modal="true" aria-label={texts.options} onClick={() => setOptionsOpen(false)}>
          <div className="sol-panel" onClick={(event) => event.stopPropagation()}>
            <div className="sol-panel-head">
              <h2>{texts.options}</h2>
              <button className="sol-btn ghost" onClick={() => setOptionsOpen(false)}>{texts.close}</button>
            </div>
            <div className="sol-field">
              <span>{texts.drawLabel}</span>
              <div className="sol-segment" role="radiogroup" aria-label={texts.drawLabel}>
                {([1, 3] as const).map((count) => (
                  <button key={count} role="radio" aria-checked={save.drawCount === count} className={save.drawCount === count ? "on" : ""} onClick={() => setDrawCount(count)}>
                    {count === 1 ? texts.drawOne : texts.drawThree}
                  </button>
                ))}
              </div>
            </div>
            {game.moves > 0 && save.drawCount !== game.drawCount && <p className="sol-note">{texts.drawNextGame}</p>}
            <label className="sol-check">
              <input type="checkbox" checked={save.tapToSend} onChange={() => setSave((s) => ({ ...s, tapToSend: !s.tapToSend }))} />
              {texts.tapToSend}
            </label>
            <h3>{texts.records}</h3>
            <table className="sol-records">
              <thead>
                <tr><th /><th>{texts.recordsFor(1)}</th><th>{texts.recordsFor(3)}</th></tr>
              </thead>
              <tbody>
                {([
                  [texts.wins, (r) => String(r.wins)],
                  [texts.bestScore, (r) => (r.wins ? String(r.bestScore) : texts.none)],
                  [texts.fewestMoves, (r) => (r.fewestMoves === null ? texts.none : String(r.fewestMoves))],
                  [texts.fastest, (r) => (r.fastest === null ? texts.none : formatTime(r.fastest))],
                ] as const satisfies readonly (readonly [string, (r: SolitaireSave["records"]["draw1"]) => string])[]).map(([label, value]) => (
                  <tr key={label}><th>{label}</th><td>{value(save.records.draw1)}</td><td>{value(save.records.draw3)}</td></tr>
                ))}
              </tbody>
            </table>
            <h3>{texts.rulesTitle}</h3>
            <ul className="sol-rules">{texts.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          </div>
        </div>
      )}

      {win && (
        <div className="sol-modal" role="dialog" aria-modal="true" aria-label={texts.won}>
          <div className="sol-confetti" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <svg key={i} viewBox="-10 -10 20 20" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.35}s`, animationDuration: `${2.6 + (i % 4) * 0.5}s` }}>
                <Pip suit={(["tomato", "salami", "basil", "olive"] as const)[i % 4]} />
              </svg>
            ))}
          </div>
          <div className="sol-panel sol-win">
            <h2>{texts.won}</h2>
            {win.isNewBest && <p className="sol-new-best">{texts.newRecord}</p>}
            <p className="sol-win-score">{win.score}</p>
            <dl className="sol-stats center">
              {win.bonus > 0 && <div><dt>{texts.timeBonus}</dt><dd>+{win.bonus}</dd></div>}
              <div><dt>{texts.moves}</dt><dd>{win.moves}</dd></div>
              <div><dt>{texts.time}</dt><dd>{formatTime(win.seconds)}</dd></div>
            </dl>
            <button className="sol-btn primary big" onClick={() => startNewGame()}>{texts.playAgain}</button>
          </div>
        </div>
      )}
    </div>
  );
};
