import { formatEveningTime } from "../../game/clock";
import { useEffect, useRef, useState } from "react";
import { COMMIS_FADES_PANS } from "../../data/progression";
import { revealInList } from "../../utils/scroll";
import { isRegularCustomer } from "../../game/customers";
import { barmanTarget, isStuck, ovenSlots, ovenWithRoom, selectedCustomer as findSelectedCustomer } from "../../game/service";
import { PauseMenu, ServiceWayOut } from "./PauseMenu";
import { cooksInOven, dishOf, hasBase, haveSameIngredients, type Dish } from "../../game/pizza";
import { tutorialStep } from "../../game/tutorial";
import { useTranslation } from "../../i18n/I18nContext";
import { formatClock } from "../../utils/format";
import { challengeRecipe } from "../../game/challenge";
import { BATCH_ID, nextBatchRecipe, openBatch } from "../../game/batch";
import { STREAK_SHOWN_FROM, streakMultiplier } from "../../game/streak";
import { BatchTicket } from "./BatchTicket";
import { isStillComing } from "../../game/evening";
import { CoachTip } from "../../components/CoachTip";
import { MessageTicker } from "../../components/MessageTicker";
import { Pizza } from "../../components/Pizza";
import { BarCounter } from "./BarCounter";
import { OrderTicket } from "./OrderTicket";
import { OvenAndPass } from "./OvenAndPass";
import { PrepLine, type SecretJarState } from "./PrepLine";
import { INGREDIENTS, type IngredientId } from "../../data/ingredients";
import { activeMenu } from "../../game/menu";
import type { CoachTarget, Customer, GameState, Service } from "../../game/types";
import type { ServiceScreenProps } from "../types";
import { useMultiplayer } from "../../multiplayer/MultiplayerContext";
import { TRAP_EVERY_SERVED, trapsEarned } from "../../multiplayer/protocol";
import { commisLevel } from "../../game/commis";
import { barmanProfile } from "../../game/staff";
import { onTap } from "../../components/tap";
import { PASTA_STATIONS, PREP_STATIONS } from "../../data/ingredients";
import { ranking } from "../MultiplayerView";

// What the board is compared with: a customer's order, or the group order's next pizza.
interface BoardTarget {
  name: string;
  ingredients: readonly IngredientId[];
}

interface WorkBoardProps extends ServiceScreenProps {
  selectedCustomer: Customer | undefined;
  target: BoardTarget | undefined;
  coachTarget: CoachTarget | null;
}

// The usual is for the player to remember, with a way to give up and see the recipe.
const UsualReminder = ({ customer, dispatch }: { customer: Customer; dispatch: ServiceScreenProps["dispatch"] }) => {
  const t = useTranslation();
  return (
    <span className="match usual">
      <span className="usual-t">{t("service.asUsualCheck", { name: customer.name })} </span>
      <button className="link-btn" title={t("service.revealUsualTitle")} {...onTap(() => dispatch({ type: "revealUsualOrder", customerId: customer.id }))}>
        {t("service.revealUsual")}
      </button>
    </span>
  );
};

// With help on: tells how the pizza being built compares to the selected order.
const BoardCheck = ({ customer, board }: { customer: BoardTarget; board: readonly IngredientId[] }) => {
  const t = useTranslation();
  if (haveSameIngredients(customer.ingredients, board)) return <span className="match good">{t("service.readyFor", { name: customer.name })}</span>;
  const missing = customer.ingredients.filter((id) => !board.includes(id)).length;
  const extra = board.filter((id) => !customer.ingredients.includes(id)).length;
  return <span className="match">{t("service.boardCheck", { name: customer.name, missing, extra })}</span>;
};

const WorkBoard = ({ state, service, dispatch, selectedCustomer, target, coachTarget }: WorkBoardProps) => {
  const t = useTranslation();
  const { board, oven } = service;
  // Full: no room where this dish cooks (the oven, or the trattoria's stove for pasta).
  const ovenIsFull = hasBase(board) ? !ovenWithRoom(state, service) : oven.length >= ovenSlots(state);
  const onStove = hasBase(board) && !cooksInOven(board);
  return (
    <section className="a-peel peel" aria-label={t("service.workBoard")}>
      <div className="peel-pz">
        {board.length ? <Pizza ingredients={board} className="pizza" /> : <div className="empty">{t("service.emptyBoard")}</div>}
        {(service.secretOnBoard || service.mammaOnBoard) && (
          <span className="secret-sparkle" aria-hidden="true">{`${service.secretOnBoard ? "✨" : ""}${service.mammaOnBoard ? "💛" : ""}`}</span>
        )}
        {selectedCustomer?.asUsual && !selectedCustomer.pizzaServed && <UsualReminder customer={selectedCustomer} dispatch={dispatch} />}
        {target && board.length > 0 && state.settings.showHelp && <BoardCheck customer={target} board={board} />}
      </div>
      <BarCounter state={state} service={service} dispatch={dispatch} />
      <div className="peel-btns">
        <button className="btn sm" disabled={!board.length} {...onTap(() => dispatch({ type: "trashBoard" }))}>{t("common.trash")}</button>
        <button
          className={`btn primary${coachTarget === "bake" ? " coach-target" : ""}`}
          disabled={!hasBase(board) || ovenIsFull}
          {...onTap(() => dispatch({ type: "bake" }))}
        >
          {onStove ? (ovenIsFull ? t("service.stoveFull") : t("service.cook")) : ovenIsFull ? t("service.ovenFull") : t("service.bake")}
        </button>
      </div>
      {/* The secrets' keys only once they are shared: the legend mustn't give them away. */}
      <p className="kbd-legend">
        {[
          t("service.shortcuts"),
          state.secretIngredient ? t("service.shortcutSecret") : "",
          state.mammaSecret ? t("service.shortcutMamma") : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </section>
  );
};

// With the tidy prep line: the unlocked ingredients no pizza on tonight's menu uses.
const drawerIngredients = (state: GameState): IngredientId[] => {
  if (state.upgrades.drawer < 1 || !state.settings.useDrawer) return [];
  const onMenu = new Set(activeMenu(state).flatMap((recipe) => recipe.ingredients));
  return INGREDIENTS.map(({ id }) => id).filter((id) => state.unlocked[id] && !onMenu.has(id));
};

// The secret ingredients shared so far, as jars at the end of the prep line.
const secretJars = (state: GameState, service: Service, dispatch: ServiceScreenProps["dispatch"]): SecretJarState[] => {
  const jars: SecretJarState[] = [];
  const hasDough = hasBase(service.board);
  if (state.secretIngredient) {
    jars.push({
      id: "nonna",
      isOnBoard: Boolean(service.secretOnBoard),
      canAdd: hasDough && state.secretStock > 0,
      stock: state.secretStock,
      onToggle: () => dispatch({ type: "toggleSecret" }),
    });
  }
  if (state.mammaSecret) {
    jars.push({
      id: "mamma",
      isOnBoard: Boolean(service.mammaOnBoard),
      canAdd: hasDough && state.mammaStock > 0,
      stock: state.mammaStock,
      onToggle: () => dispatch({ type: "toggleMamma" }),
    });
  }
  return jars;
};

// Customers in order, with the people of a table kept together (they arrive together, but this keeps them so).
const groupByTable = (customers: readonly Customer[]): { tableId: string | null; customers: Customer[] }[] => {
  const groups: { tableId: string | null; customers: Customer[] }[] = [];
  customers.forEach((customer) => {
    const group = customer.tableId ? groups.find((candidate) => candidate.tableId === customer.tableId) : undefined;
    if (group) group.customers.push(customer);
    else groups.push({ tableId: customer.tableId ?? null, customers: [customer] });
  });
  return groups;
};

// Tonight's goal in the message line, in a few characters: how far it is, or how it ended.
const tonightMark = (state: GameState): string => {
  const goal = state.tonightGoal;
  if (!goal || goal.day !== state.day) return "";
  if (goal.status !== "open") return `🎯 ${goal.status === "done" ? "✓" : "✗"}`;
  return goal.kind === "onTime" ? "🎯 23:00" : `🎯 ${goal.progress}/${goal.target}`;
};

// Layout (see .svc in styles.css): orders on the left, message line and work board in the middle,
// oven and pass on the right, prep line along the bottom. Re-flows on tablets and phones.
// Pizza Royale: a tricky customer for whoever leads among the others still in. Earned by pizzas served, as the server
// counts them; the server checks again.
const TrapButton = () => {
  const t = useTranslation();
  const { room, you, sendTrap } = useMultiplayer();
  const me = room?.players.find((player) => player.id === you);
  if (!room || !me) return null;
  const left = trapsEarned(me.served) - (me.traps ?? 0);
  const target = room.players
    .filter((player) => player.id !== you && player.out === undefined && !player.done && player.connected)
    .sort((a, b) => b.score - a.score)[0];
  return (
    <button
      className="btn trap-btn"
      disabled={left <= 0 || !target}
      title={target ? `${t("service.trapTitle", { name: target.name })} · ${t("service.trapHint", { every: TRAP_EVERY_SERVED })}` : t("service.trapHint", { every: TRAP_EVERY_SERVED })}
      {...onTap(() => target && sendTrap(target.id))}
    >
      {t("service.trap", { count: Math.max(0, left) })}
    </button>
  );
};

export const ServiceView = ({ state, service, dispatch }: ServiceScreenProps) => {
  const t = useTranslation();
  const selectedCustomer = findSelectedCustomer(service);
  const { challenge } = service;
  const streak = service.stats.streak ?? 0;
  const { room, you } = useMultiplayer();
  // In a match against friends, the message line also shows where everyone stands.
  const standings =
    challenge?.multiplayer && !challenge.coop && room
      ? ranking(room)
          .map((player, index) => `${index + 1}. ${player.id === you ? t("multi.youRanked") : player.name} ${player.out !== undefined ? "✗" : player.score}`)
          .join(" · ")
      : "";
  const progress = challenge
    ? [t(challenge.coop ? "service.coop" : challenge.royale ? "service.royale" : challenge.multiplayer ? "service.match" : "service.challenge", { clock: formatClock(challenge.secondsLeft), score: challenge.score }), standings]
        .filter(Boolean)
        .join(" · ")
    : service.rush
      ? t("service.rush", { clock: formatClock(service.rush.secondsLeft) })
      : [
          t("service.progress", { served: service.stats.served, remaining: service.customersToCome + service.customers.length }),
          streak >= STREAK_SHOWN_FROM ? t("service.streak", { count: streak, multiplier: t.number(streakMultiplier(streak)) }) : "",
          service.rushAtMinutes != null ? `🔥 ${formatEveningTime(service.rushAtMinutes)}` : "",
          tonightMark(state),
        ]
          .filter(Boolean)
          .join(" · ");
  const batchQuest = openBatch(state, service);
  const isBatchSelected = Boolean(batchQuest) && service.selectedCustomerId === BATCH_ID;
  const batchRecipe = isBatchSelected ? nextBatchRecipe(state, service) : undefined;
  // What the board is being built for: the selected customer, or the group order's next pizza.
  const target = isBatchSelected
    ? batchRecipe ? { name: t("service.theBatch"), ingredients: batchRecipe.ingredients } : undefined
    : selectedCustomer && !selectedCustomer.asUsual && !selectedCustomer.pizzaServed ? selectedCustomer : undefined;
  const tutorial = tutorialStep(state);
  const coachTarget = tutorial?.target ?? null;
  // The trattoria: the prep line shows what the order being made is (or what is on the board), pizzas or pasta, and
  // can be switched by hand. Never in challenges (pizzas only).
  const hasTrattoria = state.upgrades.trattoria > 0 && !challenge;
  // The selected ticket picks the tab (each time a ticket is picked); without one, what is on the board.
  const followed: Dish = target ? dishOf(target.ingredients) : service.board.length ? dishOf(service.board) : "pizza";
  const [railDish, setRailDish] = useState<Dish>(followed);
  // Unless switched off in the settings: then the tabs are only moved by hand.
  const autoDish = state.settings.autoDish;
  useEffect(() => {
    if (autoDish) setRailDish(followed);
  }, [autoDish, followed, service.selectedCustomerId]);
  // A tab picked by hand: the commis swaps the base they laid for the other dish's.
  const pickDish = (dish: Dish) => {
    setRailDish(dish);
    if (dish !== railDish) dispatch({ type: "switchDish", dish });
  };
  const shownDish: Dish = hasTrattoria ? railDish : "pizza";

  // Keeps the selected ticket on screen as tickets come and go (a phone shows only two or three at a time).
  const ticketList = useRef<HTMLDivElement>(null);
  const customerCount = service.customers.length;
  useEffect(() => {
    // Next frame: the page has switched to its fixed service layout by then, so the list knows its size.
    const frame = requestAnimationFrame(() => {
      const selectedTicket = ticketList.current?.querySelector<HTMLElement>(".ticket[aria-pressed='true']");
      if (ticketList.current && selectedTicket) revealInList(ticketList.current, selectedTicket);
    });
    return () => cancelAnimationFrame(frame);
  }, [service.selectedCustomerId, customerCount]);
  // Messages come first; the tutorial hint takes the message line otherwise.
  const showCoach = tutorial !== null && !state.toasts.length;
  const pouringFor = barmanTarget(state, service);
  return (
    <div className={`svc${challenge ? " in-challenge" : ""}${service.rush ? " in-rush" : ""}${service.role ? ` role-${service.role}` : ""}`}>
      <div className="a-ticker">
        {/* A match against friends runs on a shared clock: no pause. */}
        {challenge?.royale && <TrapButton />}
        {service.role && <span className="role-badge">{t(service.role === "cook" ? "service.roleCook" : "service.rolePass")}</span>}
        {!challenge?.multiplayer && (
          <button className="btn pause-btn" aria-label={t("service.pause")} title={`${t("service.pause")} (P)`} {...onTap(() => dispatch({ type: "togglePause" }))}>
            ⏸
          </button>
        )}
        {isStuck(state, service) ? (
          <div className="stuck" role="alert">
            <strong>{t("service.stuck")}</strong>
            <ServiceWayOut state={state} service={service} dispatch={dispatch} />
          </div>
        ) : showCoach ? (
          <CoachTip step={tutorial} dispatch={dispatch} className="ticker" />
        ) : (
          <MessageTicker toasts={state.toasts} dispatch={dispatch} idleText={progress} log={state.messageLog} />
        )}
      </div>
      {service.paused && <PauseMenu state={state} service={service} dispatch={dispatch} />}
      <section className="a-tickets" aria-label={t("service.orders")}>
        <h3 className="h dsk">{t("service.orders")}</h3>
        <div className="tickets" ref={ticketList}>
          {service.customers.length === 0 && !batchQuest && <div className="card pad hint ticket-empty">{t("service.doorOpening")}</div>}
          {batchQuest && service.batch && (
            <BatchTicket quest={batchQuest} elapsed={service.batch.elapsed} isSelected={isBatchSelected} onSelect={() => dispatch({ type: "selectBatch" })} />
          )}
          {groupByTable(service.customers).map((group) => {
            const tickets = group.customers.map((customer) => (
              <OrderTicket
                key={customer.id}
                customer={customer}
                isSelected={customer.id === service.selectedCustomerId}
                showIngredients={state.settings.showHelp}
                board={service.board}
                isRegular={isRegularCustomer(state, customer)}
                table={group.tableId ? service.tables?.[group.tableId] : undefined}
                pour={customer.id === pouringFor?.id ? Math.min(1, (service.barmanSeconds ?? 0) / (barmanProfile(state)?.pourSeconds ?? 1)) : undefined}
                onSelect={() => dispatch({ type: "selectCustomer", customerId: customer.id })}
                partner={service.partner?.selectedCustomerId === customer.id ? service.partner : undefined}
              />
            ));
            const table = group.tableId ? service.tables?.[group.tableId] : undefined;
            if (!table) return tickets;
            // A table's tickets sit together in one frame: each person has their own order.
            return (
              <div key={group.tableId} className={`table-group tb-${table.color}`} role="group" aria-label={t("service.table", { size: table.size })}>
                <div className="table-head">{t("service.tableHead", { size: table.size })}</div>
                <div className="table-tickets">{tickets}</div>
              </div>
            );
          })}
        </div>
      </section>
      <WorkBoard state={state} service={service} dispatch={dispatch} selectedCustomer={selectedCustomer} target={target} coachTarget={coachTarget} />
      <OvenAndPass state={state} service={service} dispatch={dispatch} coachTarget={coachTarget} />
      <div className="a-rail">
        {hasTrattoria && (
          <div className="rail-tabs" role="tablist" aria-label={t("service.railLabel")}>
            {(["pizza", "pasta"] as const).map((dish) => (
              <button key={dish} role="tab" aria-selected={dish === shownDish} className={`rail-tab${dish === shownDish ? " on" : ""}`} {...onTap(() => pickDish(dish))}>
                {t(dish === "pizza" ? "service.railPizza" : "service.railPasta")}
              </button>
            ))}
          </div>
        )}
        <PrepLine
          stations={shownDish === "pasta" ? PASTA_STATIONS : PREP_STATIONS}
          state={state}
          isBottomless={Boolean(challenge)}
          stillComing={state.lateIngredient && isStillComing(state, service, state.lateIngredient) ? state.lateIngredient : null}
          extraIngredients={challenge ? challenge.menu.flatMap((id) => challengeRecipe(id).ingredients) : []}
          board={service.board}
          neededIngredients={state.settings.showHelp && target ? target.ingredients : []}
          orderIngredients={target?.ingredients ?? []}
          fadeLevel={challenge || !state.settings.commisFade ? 0 : Math.max(0, commisLevel(state) - COMMIS_FADES_PANS + 1)}
          drawerIds={challenge || shownDish === "pasta" ? [] : drawerIngredients(state)}
          coachTarget={coachTarget}
          onPickIngredient={(id) => dispatch({ type: "toggleIngredient", ingredientId: id })}
          secrets={challenge ? [] : secretJars(state, service, dispatch)}
        />
      </div>
    </div>
  );
};
