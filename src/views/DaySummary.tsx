import type { ReactNode } from "react";
import { menuCapacity } from "../game/progression";
import { Overlay } from "../components/Overlay";
import type { DaySummary as Summary, MysteryVisit, OrderRecord, StarGoals, TonightGoal } from "../game/types";
import { LIGHTNING_SECONDS, TONIGHT_REWARD } from "../data/tonight";
import { INSPECTION_XP } from "../data/events";
import { COMPETITOR_DAYS, COMPETITOR_STARS_TO_WIN } from "../data/competitor";
import { profitTarget } from "../game/stars";
import { useTranslation } from "../i18n/I18nContext";
import { Pizza } from "../components/Pizza";
import { drawReceipt, shareOrDownload, type ReceiptRow } from "../utils/receiptImage";
import type { DayEventId } from "../data/events";
import { EVENT_ICONS } from "./TonightAgenda";

// The end of the day as a till receipt, in three parts under its header (the day's event and stars): the service
// (what was served, the orders folded away), the till (money in, money out, the profit), and the round-up (the
// day's goals, tonight's goal, the mystery guest, reputation).

// A line of the receipt: label, dotted leader, amount. `sub`: a detail of the line above, indented.
const ReceiptLine = ({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) => (
  <div className={`receipt-line ${className}`}>
    <span>{label}</span>
    <span className="leader" />
    <span className="amount">{value}</span>
  </div>
);

const Section = ({ caption, children }: { caption: string; children: ReactNode }) => (
  <section className="receipt-section">
    <div className="receipt-rule" />
    <h3 className="receipt-caption">{caption}</h3>
    {children}
  </section>
);

const Stars = ({ count, out, className }: { count: number; out: number; className: string }) => (
  <span className={className} aria-label={`${count} / ${out}`}>
    {"★".repeat(count)}
    <span className="off">{"★".repeat(out - count)}</span>
  </span>
);

// A line of the round-up: reached or not, what it was, what it brought.
const Check = ({ isOn, children, value }: { isOn: boolean; children: ReactNode; value?: ReactNode }) => (
  <li className={`receipt-check${isOn ? " on" : ""}`}>
    <span className="receipt-check-mark" aria-hidden="true">{isOn ? "✓" : "·"}</span>
    <span className="grow">{children}</span>
    {value !== undefined && <span className="amount">{value}</span>}
  </li>
);

// The three goals behind the day's stars.
const StarChecks = ({ goals, charges }: { goals: StarGoals; charges: number }) => {
  const t = useTranslation();
  return (
    <>
      <Check isOn={goals.happy}>{t("summary.starHappy")}</Check>
      <Check isOn={goals.waste}>{t("summary.starWaste")}</Check>
      <Check isOn={goals.profit}>{t("summary.starProfit", { target: profitTarget(charges) })}</Check>
    </>
  );
};

const TonightCheck = ({ goal }: { goal: TonightGoal }) => {
  const t = useTranslation();
  const isDone = goal.status === "done";
  return (
    <Check isOn={isDone} value={isDone ? `+${t.money(TONIGHT_REWARD)}` : t("tonight.missed")}>
      {`🎯 ${t(`tonight.kinds.${goal.kind}`, { target: goal.target, seconds: LIGHTNING_SECONDS })}`}
    </Check>
  );
};

// The mystery guest unmasked: who it was, their stars, what they bring (or that they never came).
const MysteryCheck = ({ visit }: { visit: MysteryVisit | null }) => {
  const t = useTranslation();
  if (!visit) return <Check isOn={false}>{`🕵️ ${t("summary.mysteryAbsent")}`}</Check>;
  return (
    <li className={`receipt-check receipt-mystery${visit.stars >= 3 ? " on" : ""}`}>
      <span className="receipt-check-mark" aria-hidden="true">🕵️</span>
      <span className="grow">
        <span className="receipt-mystery-head">
          <strong>{t("summary.mysteryTitle")}</strong>
          <Stars count={visit.stars} out={5} className="receipt-stars small" />
        </span>
        <span className="receipt-mystery-who">{t("summary.mysteryWas", { name: visit.name, recipe: t.recipe({ id: visit.recipeId, name: visit.recipeName }) })}</span>
        <span className="receipt-mystery-gain">{t("summary.mysteryReward", { xp: visit.xp, money: visit.money })}</span>
      </span>
    </li>
  );
};

// One row per pizza served today, with its tip; people who came as a table carry its colour.
const OrderLines = ({ orders }: { orders: readonly OrderRecord[] }) => {
  const t = useTranslation();
  return (
    <div className="receipt-orders">
      {orders.map((order, index) => (
        <div key={index} className={`receipt-order${order.table ? ` at-table tb-${order.table.color}` : ""}`}>
          <Pizza ingredients={order.ingredients} baked />
          <span className="grow">
            {t("summary.order", { customer: order.customerName, recipe: t.recipe({ id: order.recipeId, name: order.recipeName }) })}
            {order.table && <span className="receipt-table">{t("service.table", { size: order.table.size })}</span>}
          </span>
          <span className="amount">{t.money(order.price)}</span>
          <span className={`receipt-tip${order.tip ? "" : " none"}`}>{order.tip ? `+${t.money(order.tip)}` : t("summary.noTip")}</span>
        </div>
      ))}
    </div>
  );
};

interface DaySummaryProps {
  summary: Summary;
  pizzeriaName: string;
  /** The incident as it is told (a power cut reads as missing wood when every oven burns wood). */
  shownEventId?: DayEventId | "woodShortage";
  onNextDay: () => void;
}

const average = (stars: readonly number[]): number => Math.round((stars.reduce((total, value) => total + value, 0) / stars.length) * 10) / 10;

export const DaySummary = ({ summary, pizzeriaName, shownEventId, onNextDay }: DaySummaryProps) => {
  const t = useTranslation();
  const isProfit = summary.net >= 0;
  const reachedLevel = summary.levelUps.at(-1);
  const { bestSeller } = summary;
  const eventId = shownEventId ?? summary.event;
  const signed = (amount: number) => `${amount >= 0 ? "+" : "−"} ${t.money(Math.abs(amount))}`;
  // Money in and out, in the order a till prints them; empty lines are left out.
  const moneyIn: [string, number][] = (
    [
      [t("summary.revenue"), summary.revenue],
      [t("summary.tips"), summary.tips],
      [t("summary.quests"), summary.questRewards ?? 0],
      [t("summary.bonuses"), summary.bonuses ?? 0],
      [t("summary.annexe"), summary.annexeIncome ?? 0],
    ] as [string, number][]
  ).filter(([label, amount]) => amount > 0 || label === t("summary.revenue"));
  const moneyOut: [string, number][] = [
    [t("summary.purchases"), summary.purchases],
    [t("summary.charges"), summary.charges],
  ];

  const shareReceipt = async () => {
    const rows: ReceiptRow[] = [
      { label: t("summary.served"), value: String(summary.served) },
      ...moneyIn.map(([label, amount]) => ({ label, value: signed(amount) })),
      ...moneyOut.map(([label, amount]) => ({ label, value: signed(-amount) })),
      { label: t("summary.profit"), value: `${isProfit ? "+" : ""}${t.money(summary.net)}`, isTotal: true },
      { label: t("summary.reputation"), value: `+${summary.xp}` },
    ];
    const blob = await drawReceipt(pizzeriaName, t("summary.title", { day: summary.day }), rows, t("summary.thanks"));
    try {
      if (blob) await shareOrDownload(blob, `forno-lento-day-${summary.day}.png`);
    } catch {
      // Sharing cancelled: nothing to do.
    }
  };

  return (
    <Overlay label={t("summary.dialog")} onClose={onNextDay}>
      <div className="summary-modal">
        <div className="receipt">
          <header className="receipt-head">
            <div className="receipt-name">{pizzeriaName}</div>
            <div>{t("summary.title", { day: summary.day })}</div>
            {eventId && <div className="receipt-event">{`${EVENT_ICONS[eventId] ?? "📣"} ${t(`events.${eventId}.name`)}`}</div>}
            {summary.starGoals && (
              <div className="receipt-day-stars">
                <Stars count={summary.stars ?? 0} out={3} className="receipt-stars" />
                <span className="receipt-day-stars-l">{t("summary.stars")}</span>
              </div>
            )}
          </header>

          <Section caption={t("summary.sectionService")}>
            <ReceiptLine label={t("summary.served")} value={summary.served} />
            {summary.happyServed !== undefined && summary.served > 0 && <ReceiptLine className="sub" label={t("summary.happyServed")} value={summary.happyServed} />}
            {bestSeller && <ReceiptLine className="text" label={t("summary.bestSeller")} value={`${t.recipe({ id: bestSeller.recipeId, name: bestSeller.name })} ×${bestSeller.count}`} />}
            {summary.reviews && summary.reviews.length > 0 && (
              <ReceiptLine
                label={t("summary.reviewsLabel", { count: summary.reviews.length })}
                value={`${t.number(average(summary.reviews.map((review) => review.stars)))} ★`}
              />
            )}
            {summary.waste > 0 && <ReceiptLine className="neg" label={t("summary.waste")} value={t.money(summary.waste)} />}
            {summary.orders && summary.orders.length > 0 && (
              <details className="receipt-details">
                <summary>{t("summary.ordersToggle", { count: summary.orders.length })}</summary>
                <OrderLines orders={summary.orders} />
              </details>
            )}
          </Section>

          <Section caption={t("summary.sectionTill")}>
            {moneyIn.map(([label, amount]) => (
              <div key={label}>
                <ReceiptLine label={label} value={signed(amount)} />
                {label === t("summary.revenue") && Boolean(summary.drinks) && (
                  <ReceiptLine className="sub" label={t("summary.drinks")} value={t.money(summary.drinks ?? 0)} />
                )}
              </div>
            ))}
            {moneyOut.map(([label, amount]) => (
              <ReceiptLine key={label} className="out" label={label} value={signed(-amount)} />
            ))}
            <div className="receipt-rule thin" />
            <ReceiptLine className={`receipt-total ${isProfit ? "pos" : "neg"}`} label={t("summary.profit")} value={`${isProfit ? "+" : ""}${t.money(summary.net)}`} />
            {summary.debt > 0 && (
              <>
                <ReceiptLine className="neg" label={t("summary.debt")} value={t.money(summary.debt)} />
                <p className="receipt-fine">{t("summary.debtHint")}</p>
              </>
            )}
          </Section>

          <Section caption={t("summary.sectionRoundUp")}>
            <ul className="receipt-checks">
              {summary.starGoals && <StarChecks goals={summary.starGoals} charges={summary.charges} />}
              {summary.tonightGoal && <TonightCheck goal={summary.tonightGoal} />}
              {summary.mystery !== undefined && <MysteryCheck visit={summary.mystery} />}
              {summary.inspectionPassed && <Check isOn value={`+${INSPECTION_XP}`}>{t("summary.inspectionShort")}</Check>}
              {summary.competitor && (
                <Check isOn={summary.competitor.stars >= COMPETITOR_STARS_TO_WIN} value={`${summary.competitor.stars}/${COMPETITOR_STARS_TO_WIN} ★`}>
                  {t("summary.competitorLine", { name: summary.competitor.name, day: summary.competitor.day, total: COMPETITOR_DAYS })}
                </Check>
              )}
            </ul>
            <ReceiptLine className="receipt-xp" label={t("summary.reputation")} value={`+${summary.xp}`} />
            {reachedLevel && <p className="receipt-level">{`⬆ ${t("summary.levelReached", { level: reachedLevel })}`}</p>}
          </Section>

          <p className="receipt-thanks">{t("summary.thanks")}</p>
        </div>
        {reachedLevel && (
          // What the new level brings (the level itself is on the receipt).
          <div className="card pad level-up">{`⬆ ${t("summary.levelReachedDetails", { capacity: menuCapacity(reachedLevel) })}`}</div>
        )}
        <div className="summary-actions">
          <button className="btn" onClick={() => void shareReceipt()}>{t("summary.share")}</button>
          <button className="btn primary big" onClick={onNextDay}>{t("summary.nextDay", { day: summary.day + 1 })}</button>
        </div>
      </div>
    </Overlay>
  );
};
