import type { Quest, QuestRecord } from "../game/types";
import type { Translator } from "../i18n";
import { useTranslation } from "../i18n/I18nContext";

// "The football club wants 5 Regina for their evening."
export const questText = (t: Translator, quest: Quest | QuestRecord): string => {
  const { target } = quest;
  // The wedding banquet says it in its own words (the newlyweds are two).
  if (quest.giver === "wedding") return t("quests.wedding", { target });
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
  return t.words(t.questGiver(quest.giver), what);
};

// "3 Regina, 2 Margherita"
export const batchItemsText = (t: Translator, quest: Pick<Quest, "items">): string =>
  t.list((quest.items ?? []).map((item) => t.words(String(item.count), t.recipe({ id: item.recipeId, name: item.recipeName }))));

// What the running neighbourhood quest asks, how far it is and what it brings (the morning's list says the rest).
export const QuestDetails = ({ quest }: { quest: Quest }) => {
  const t = useTranslation();
  return (
    <div className="quest-details">
      <div className="quest-progress" title={`${quest.progress} / ${quest.target}`}>
        <i style={{ width: `${(quest.progress / quest.target) * 100}%` }} />
        <span>{quest.progress} / {quest.target}</span>
      </div>
      <div className="hint">{t("prep.questReward", { reward: quest.reward, xp: quest.xp })}</div>
    </div>
  );
};
