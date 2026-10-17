import type { Quest } from "../game/types";
import type { Translator } from "../i18n";
import { useTranslation } from "../i18n/I18nContext";

// "The football club wants 5 Regina for their evening."
function questText(t: Translator, quest: Quest): string {
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
    }
  })();
  return `${t.questGiver(quest.giver)} ${what}`;
}

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
      <div className="quest-progress" title={`${quest.progress} / ${quest.target}`}>
        <i style={{ width: `${(quest.progress / quest.target) * 100}%` }} />
        <span>{quest.progress} / {quest.target}</span>
      </div>
      <div className="hint">{t("prep.questReward", { reward: quest.reward, xp: quest.xp })}</div>
    </div>
  );
}
