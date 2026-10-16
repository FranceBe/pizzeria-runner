import { menuCapacity } from "../game/progression";
import type { DaySummary as Summary, OrderRecord } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";
import { Pizza } from "../components/Pizza";

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
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("summary.dialog")}>
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
          <div className="receipt-rule" />
          <ReceiptLine
            className={`receipt-total ${isProfit ? "pos" : "neg"}`}
            label={t("summary.profit")}
            value={`${isProfit ? "+" : ""}${t.money(summary.net)}`}
          />
          <ReceiptLine label={t("summary.reputation")} value={`+${summary.xp}`} />
          {summary.debt > 0 && <ReceiptLine className="neg" label={t("summary.debt")} value={t.money(summary.debt)} />}
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
        <button className="btn primary big" onClick={onNextDay}>{t("summary.nextDay", { day: summary.day + 1 })}</button>
      </div>
    </div>
  );
}
