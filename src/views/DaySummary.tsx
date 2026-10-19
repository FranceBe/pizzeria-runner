import { menuCapacity } from "../game/progression";
import { Overlay } from "../components/Overlay";
import type { DaySummary as Summary, OrderRecord, StarGoals } from "../game/types";
import { INSPECTION_XP } from "../data/events";
import { profitTarget } from "../game/stars";
import { useTranslation } from "../i18n/I18nContext";
import { Pizza } from "../components/Pizza";
import { drawReceipt, shareOrDownload, type ReceiptRow } from "../utils/receiptImage";

// A line of the receipt: label, dotted leader, amount.
function ReceiptLine({ label, value, className = "" }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`receipt-line ${className}`}>
      <span>{label}</span>
      <span className="leader" />
      <span className="amount">{value}</span>
    </div>
  );
}

// The day's stars, with the three goals behind them.
function DayStars({ stars, goals, charges }: { stars: number; goals: StarGoals; charges: number }) {
  const t = useTranslation();
  const rows: [boolean, string][] = [
    [goals.happy, t("summary.starHappy")],
    [goals.waste, t("summary.starWaste")],
    [goals.profit, t("summary.starProfit", { target: profitTarget(charges) })],
  ];
  return (
    <div className="day-stars">
      <div className="day-stars-head">
        <span>{t("summary.stars")}</span>
        <span className="day-stars-v" aria-label={`${stars} / 3`}>{"★".repeat(stars)}<span className="off">{"★".repeat(3 - stars)}</span></span>
      </div>
      <ul>
        {rows.map(([isReached, label]) => (
          <li key={label} className={isReached ? "on" : ""}>{`${isReached ? "✓" : "·"} ${label}`}</li>
        ))}
      </ul>
    </div>
  );
}

// One row per pizza served today, with its tip.
function OrderLines({ orders }: { orders: readonly OrderRecord[] }) {
  const t = useTranslation();
  return (
    <div className="receipt-orders">
      {orders.map((order, index) => (
        <div key={index} className="receipt-order">
          <Pizza ingredients={order.ingredients} baked />
          <span className="grow">
            {t("summary.order", { customer: order.customerName, recipe: t.recipe({ id: order.recipeId, name: order.recipeName }) })}
          </span>
          <span className="amount">{t.money(order.price)}</span>
          <span className={`receipt-tip${order.tip ? "" : " none"}`}>{order.tip ? `+${t.money(order.tip)}` : t("summary.noTip")}</span>
        </div>
      ))}
    </div>
  );
}

// The end of the day, printed as a till receipt.
interface DaySummaryProps {
  summary: Summary;
  pizzeriaName: string;
  onNextDay: () => void;
}

export function DaySummary({ summary, pizzeriaName, onNextDay }: DaySummaryProps) {
  const t = useTranslation();
  const isProfit = summary.net >= 0;
  const reachedLevel = summary.levelUps.at(-1);
  const { bestSeller } = summary;

  const shareReceipt = async () => {
    const rows: ReceiptRow[] = [
      { label: t("summary.served"), value: String(summary.served) },
      { label: t("summary.revenue"), value: t.money(summary.revenue) },
      { label: t("summary.tips"), value: t.money(summary.tips) },
      { label: t("summary.purchases"), value: `− ${t.money(summary.purchases)}` },
      { label: t("summary.charges"), value: `− ${t.money(summary.charges)}` },
      ...(summary.annexeIncome ? [{ label: t("summary.annexe"), value: `+ ${t.money(summary.annexeIncome)}` }] : []),
      ...(summary.questRewards ? [{ label: t("summary.quests"), value: `+ ${t.money(summary.questRewards)}` }] : []),
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
          <div className="receipt-head">
            <div className="receipt-name">{pizzeriaName}</div>
            <div>{t("summary.title", { day: summary.day })}</div>
          </div>
          {summary.orders && summary.orders.length > 0 && (
            <>
              <div className="receipt-rule" />
              <div className="receipt-caption">{t("summary.orders")}</div>
              <OrderLines orders={summary.orders} />
            </>
          )}
          <div className="receipt-rule" />
          <ReceiptLine label={t("summary.served")} value={summary.served} />
          <ReceiptLine label={t("summary.revenue")} value={t.money(summary.revenue)} />
          <ReceiptLine label={t("summary.tips")} value={t.money(summary.tips)} />
          <ReceiptLine label={t("summary.purchases")} value={`− ${t.money(summary.purchases)}`} />
          <ReceiptLine label={t("summary.charges")} value={`− ${t.money(summary.charges)}`} />
          {summary.waste > 0 && <ReceiptLine label={t("summary.waste")} value={t.money(summary.waste)} />}
          {Boolean(summary.drinks) && <ReceiptLine label={t("summary.drinks")} value={t.money(summary.drinks ?? 0)} />}
          {Boolean(summary.annexeIncome) && <ReceiptLine label={t("summary.annexe")} value={`+ ${t.money(summary.annexeIncome ?? 0)}`} />}
          {Boolean(summary.questRewards) && <ReceiptLine label={t("summary.quests")} value={`+ ${t.money(summary.questRewards ?? 0)}`} />}
          <div className="receipt-rule" />
          <ReceiptLine
            className={`receipt-total ${isProfit ? "pos" : "neg"}`}
            label={t("summary.profit")}
            value={`${isProfit ? "+" : ""}${t.money(summary.net)}`}
          />
          <ReceiptLine label={t("summary.reputation")} value={`+${summary.xp}`} />
          {summary.debt > 0 && <ReceiptLine className="neg" label={t("summary.debt")} value={t.money(summary.debt)} />}
          {summary.starGoals && <DayStars stars={summary.stars ?? 0} goals={summary.starGoals} charges={summary.charges} />}
          {summary.inspectionPassed && <p className="receipt-note">✓ {t("summary.inspection", { xp: INSPECTION_XP })}</p>}
          {summary.event && (
            <p className="receipt-note">
              {t("summary.event")} <strong>{t(`events.${summary.event}.name`)}</strong>
            </p>
          )}
          {bestSeller && (
            <p className="receipt-note">
              {t("summary.bestSeller")} <strong>{t.recipe({ id: bestSeller.recipeId, name: bestSeller.name })}</strong> ({bestSeller.count}×)
            </p>
          )}
          <p className="receipt-thanks">{t("summary.thanks")}</p>
        </div>
        {reachedLevel && (
          <div className="card pad level-up">
            <strong>{t("summary.levelReached", { level: reachedLevel })}</strong>{" "}
            {t("summary.levelReachedDetails", { capacity: menuCapacity(reachedLevel) })}
          </div>
        )}
        {summary.debt > 0 && <p className="hint summary-hint">{t("summary.debtHint")}</p>}
        <div className="summary-actions">
          <button className="btn" onClick={() => void shareReceipt()}>{t("summary.share")}</button>
          <button className="btn primary big" onClick={onNextDay}>{t("summary.nextDay", { day: summary.day + 1 })}</button>
        </div>
      </div>
    </Overlay>
  );
}
