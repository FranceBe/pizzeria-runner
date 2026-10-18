import { COMMIS_ASSEMBLES_ORDER } from "../../data/progression";
import { isRegularCustomer } from "../../game/customers";
import { isStuck, ovenSlots, selectedCustomer as findSelectedCustomer } from "../../game/service";
import { PauseMenu, ServiceWayOut } from "./PauseMenu";
import { hasBase, haveSameIngredients } from "../../game/pizza";
import { tutorialStep } from "../../game/tutorial";
import { useTranslation } from "../../i18n/I18nContext";
import { formatClock } from "../../utils/format";
import { challengeRecipe } from "../../game/challenge";
import { CoachTip } from "../../components/CoachTip";
import { MessageTicker } from "../../components/MessageTicker";
import { Pizza } from "../../components/Pizza";
import { OrderTicket } from "./OrderTicket";
import { OvenAndPass } from "./OvenAndPass";
import { PrepLine } from "./PrepLine";
import type { IngredientId } from "../../data/ingredients";
import type { CoachTarget, Customer } from "../../game/types";
import type { ServiceScreenProps } from "../types";

interface WorkBoardProps extends ServiceScreenProps {
  selectedCustomer: Customer | undefined;
  coachTarget: CoachTarget | null;
}

// The usual is for the player to remember, with a way to give up and see the recipe.
function UsualReminder({ customer, dispatch }: { customer: Customer; dispatch: ServiceScreenProps["dispatch"] }) {
  const t = useTranslation();
  return (
    <span className="match usual">
      <span className="usual-t">{t("service.asUsualCheck", { name: customer.name })} </span>
      <button className="link-btn" title={t("service.revealUsualTitle")} onClick={() => dispatch({ type: "revealUsualOrder", customerId: customer.id })}>
        {t("service.revealUsual")}
      </button>
    </span>
  );
}

// With help on: tells how the pizza being built compares to the selected order.
function BoardCheck({ customer, board }: { customer: Customer; board: readonly IngredientId[] }) {
  const t = useTranslation();
  if (haveSameIngredients(customer.ingredients, board)) return <span className="match good">{t("service.readyFor", { name: customer.name })}</span>;
  const missing = customer.ingredients.filter((id) => !board.includes(id)).length;
  const extra = board.filter((id) => !customer.ingredients.includes(id)).length;
  return <span className="match">{t("service.boardCheck", { name: customer.name, missing, extra })}</span>;
}

function WorkBoard({ state, service, dispatch, selectedCustomer, coachTarget }: WorkBoardProps) {
  const t = useTranslation();
  const { board, oven } = service;
  const ovenIsFull = oven.length >= ovenSlots(state);
  return (
    <section className="a-peel peel" aria-label={t("service.workBoard")}>
      <div className="peel-pz">
        {board.length ? <Pizza ingredients={board} className="pizza" /> : <div className="empty">{t("service.emptyBoard")}</div>}
        {service.secretOnBoard && <span className="secret-sparkle" aria-hidden="true">✨</span>}
        {selectedCustomer?.asUsual && <UsualReminder customer={selectedCustomer} dispatch={dispatch} />}
        {selectedCustomer && !selectedCustomer.asUsual && board.length > 0 && state.settings.showHelp && (
          <BoardCheck customer={selectedCustomer} board={board} />
        )}
      </div>
      <div className="peel-btns">
        {state.upgrades.commis >= COMMIS_ASSEMBLES_ORDER && selectedCustomer && (
          <button className="btn sm" onClick={() => dispatch({ type: "assembleOrder" })}>
            {t("service.commisAssemble", { recipe: t.recipe({ id: selectedCustomer.recipeId, name: selectedCustomer.recipeName }) })}
          </button>
        )}
        <button className="btn sm" disabled={!board.length} onClick={() => dispatch({ type: "trashBoard" })}>{t("common.trash")}</button>
        <button
          className={`btn primary${coachTarget === "bake" ? " coach-target" : ""}`}
          disabled={!hasBase(board) || ovenIsFull}
          onClick={() => dispatch({ type: "bake" })}
        >
          {ovenIsFull ? t("service.ovenFull") : t("service.bake")}
        </button>
      </div>
      <p className="kbd-legend">{t("service.shortcuts")}</p>
    </section>
  );
}

// Layout (see .svc in styles.css): orders on the left, message line and work board in the middle,
// oven and pass on the right, prep line along the bottom. Re-flows on tablets and phones.
export function ServiceView({ state, service, dispatch }: ServiceScreenProps) {
  const t = useTranslation();
  const selectedCustomer = findSelectedCustomer(service);
  const { challenge } = service;
  const progress = challenge
    ? t("service.challenge", { clock: formatClock(challenge.secondsLeft), score: challenge.score })
    : t("service.progress", { served: service.stats.served, remaining: service.customersToCome + service.customers.length });
  const tutorial = tutorialStep(state);
  const coachTarget = tutorial?.target ?? null;
  // Messages come first; the tutorial hint takes the message line otherwise.
  const showCoach = tutorial !== null && !state.toasts.length;
  return (
    <div className={`svc${challenge ? " in-challenge" : ""}`}>
      <div className="a-ticker">
        <button className="btn pause-btn" aria-label={t("service.pause")} title={`${t("service.pause")} (P)`} onClick={() => dispatch({ type: "togglePause" })}>
          ⏸
        </button>
        {isStuck(state, service) ? (
          <div className="stuck" role="alert">
            <strong>{t("service.stuck")}</strong>
            <ServiceWayOut state={state} service={service} dispatch={dispatch} />
          </div>
        ) : showCoach ? (
          <CoachTip step={tutorial} dispatch={dispatch} className="ticker" />
        ) : (
          <MessageTicker toasts={state.toasts} dispatch={dispatch} idleText={progress} />
        )}
      </div>
      {service.paused && <PauseMenu state={state} service={service} dispatch={dispatch} />}
      <section className="a-tickets" aria-label={t("service.orders")}>
        <h3 className="h dsk">{t("service.orders")}</h3>
        <div className="tickets">
          {service.customers.length === 0 && <div className="card pad hint ticket-empty">{t("service.doorOpening")}</div>}
          {service.customers.map((customer) => (
            <OrderTicket
              key={customer.id}
              customer={customer}
              isSelected={customer.id === service.selectedCustomerId}
              showIngredients={state.settings.showHelp}
              board={service.board}
              isRegular={isRegularCustomer(state, customer)}
              table={customer.tableId ? service.tables?.[customer.tableId] : undefined}
              onSelect={() => dispatch({ type: "selectCustomer", customerId: customer.id })}
            />
          ))}
        </div>
      </section>
      <WorkBoard state={state} service={service} dispatch={dispatch} selectedCustomer={selectedCustomer} coachTarget={coachTarget} />
      <OvenAndPass state={state} service={service} dispatch={dispatch} coachTarget={coachTarget} />
      <div className="a-rail">
        <PrepLine
          state={state}
          isBottomless={Boolean(challenge)}
          extraIngredients={challenge ? challenge.menu.flatMap((id) => challengeRecipe(id).ingredients) : []}
          board={service.board}
          neededIngredients={state.settings.showHelp && selectedCustomer && !selectedCustomer.asUsual ? selectedCustomer.ingredients : []}
          coachTarget={coachTarget}
          onPickIngredient={(id) => dispatch({ type: "toggleIngredient", ingredientId: id })}
          secret={
            state.secretIngredient && !challenge
              ? {
                  isOnBoard: Boolean(service.secretOnBoard),
                  canAdd: hasBase(service.board) && state.secretStock > 0,
                  stock: state.secretStock,
                  onToggle: () => dispatch({ type: "toggleSecret" }),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
