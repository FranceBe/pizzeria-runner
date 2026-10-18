import type { Quest, QuestRecord } from "../game/types";
import type { Translator } from "../i18n";
import { useTranslation } from "../i18n/I18nContext";

// "The football club wants 5 Regina for their evening."
export function questText(t: Translator, quest: Quest | QuestRecord): string {
  const { target } = quest;
  const what = (() => {
    switch (quest.kind) {
      case "serveRecipe":
        return t("quests.serveRecipe", { target, recipe: t.recipe({ id: quest.recipeId ?? "", name: quest.recipeName }) });
      case "serveTotal":
        return t("quests.serveTotal", { target });
      case "happy":
        return t("quests.happy", { target });
      case "pairing":
        return t("quests.pairing", { target });
      case "sweet":
        return t("quests.sweet", { target });
      case "batch":
        return t("quests.batch", { target });
    }
  })();
  return `${t.questGiver(quest.giver)} ${what}`;
}

// "3 Regina, 2 Margherita"
export const batchItemsText = (t: Translator, quest: Pick<Quest, "items">): string =>
  (quest.items ?? []).map((item) => `${item.count} ${t.recipe({ id: item.recipeId, name: item.recipeName })}`).join(", ");

// The running neighbourhood quest, with its progress and deadline.
export function QuestCard({ quest, day }: { quest: Quest; day: number }) {
  const t = useTranslation();
  return (
    <div className="quest" role="note">
      <div className="row">
        <span className="event-label grow">{t("prep.quest")}</span>
        <span className="quest-deadline">{t("prep.questDeadline", { days: quest.deadlineDay - day + 1 })}</span>
      </div>
      <p className="quest-t">{questText(t, quest)}</p>
      {quest.items ? (
        // A group order: what to make tonight; the reward depends on how fast it is delivered.
        <div className="hint">{t("prep.batchTonight", { items: batchItemsText(t, quest) })}</div>
      ) : (
        <>
          <div className="quest-progress" title={`${quest.progress} / ${quest.target}`}>
            <i style={{ width: `${(quest.progress / quest.target) * 100}%` }} />
            <span>{quest.progress} / {quest.target}</span>
          </div>
          <div className="hint">{t("prep.questReward", { reward: quest.reward, xp: quest.xp })}</div>
        </>
      )}
    </div>
  );
}
