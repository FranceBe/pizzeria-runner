import { medalInReach, pizzaCount } from "../../game/batch";
import type { Quest } from "../../game/types";
import { useTranslation } from "../../i18n/I18nContext";
import { formatClock } from "../../utils/format";

const MEDAL_ICONS = { gold: "🥇", silver: "🥈", bronze: "🥉" } as const;

// Tonight's group order: what to make, what is already delivered, and the medal still within reach.
export const BatchTicket = ({ quest, elapsed, isSelected, onSelect }: { quest: Quest; elapsed: number; isSelected: boolean; onSelect: () => void }) => {
  const t = useTranslation();
  const items = quest.items ?? [];
  const { medal, secondsLeft } = medalInReach(elapsed, pizzaCount(items));
  return (
    <button className="ticket batch-ticket" aria-pressed={isSelected} onClick={onSelect}>
      <div className="batch-head">
        <strong>{t("service.batch")}</strong>
        <span className="batch-medal" title={t("journal.medal", { medal: t.medal(medal) })}>
          {secondsLeft === null ? MEDAL_ICONS[medal] : `${MEDAL_ICONS[medal]} ${formatClock(secondsLeft)}`}
        </span>
      </div>
      <div className="say">{t.questGiver(quest.giver)}</div>
      <ul className="batch-items">
        {items.map((item) => (
          <li key={item.recipeId} className={item.delivered >= item.count ? "done" : ""}>
            <span className="grow">{t.recipe({ id: item.recipeId, name: item.recipeName })}</span>
            <span>{t("service.batchLine", { done: item.delivered, count: item.count })}</span>
          </li>
        ))}
      </ul>
    </button>
  );
};
