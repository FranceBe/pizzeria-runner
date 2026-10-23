// The morning's "on tonight" list: the day's event, a real-calendar festival, tonight's goal, the neighbourhood quest and
// birthdays, one line each instead of a stack of banners. A line shows its icon, its name and the start of what it says
// (a time or a deadline on the right); tapping it shows the rest.
import type { ReactNode } from "react";
import { FESTIVALS } from "../data/festivals";
import { MATCH_KICKOFF, WEDDING_TIME } from "../data/events";
import { LIGHTNING_SECONDS, TONIGHT_REWARD, TONIGHT_XP } from "../data/tonight";
import { festivalLastDay } from "../game/calendar";
import { formatEveningTime } from "../game/clock";
import { birthdaysToday } from "../game/regulars";
import { forecastCustomers } from "../game/economy";
import { tonightsRush } from "../game/evening";
import { shownEvent } from "../game/service";
import type { GameState } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";
import { QuestDetails, batchItemsText, questText } from "./QuestCard";

export const EVENT_ICONS: Record<string, string> = {
  market: "🧺", rain: "🌧️", festival: "🎉", critic: "🧐", sunny: "☀️", powerCut: "🔌", woodShortage: "🪵", lateDelivery: "🚚",
  inspection: "📋", scooterStrike: "🛵", match: "📺", wedding: "💍", mysteryGuest: "🕵️",
};

interface AgendaItem {
  id: string;
  icon: string;
  title: string;
  /** A small label after the name ("optional", "for real"). */
  tag?: string;
  text: string;
  /** On the right: a time on the evening's clock, or a deadline. */
  aside?: string;
  /** Colours, as the day's event banners had them. */
  tone: string;
  /** More, below the text, once the line is open. */
  more?: ReactNode;
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const TonightAgenda = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const items: AgendaItem[] = [];

  const eventId = state.event ? shownEvent(state, state.event) : null;
  if (state.event && eventId) {
    const late = state.event === "lateDelivery" && state.lateIngredient ? ` ${t("prep.lateIngredient", { id: state.lateIngredient })}` : "";
    items.push({
      id: "event",
      icon: EVENT_ICONS[eventId] ?? "📣",
      title: t(`events.${eventId}.name`),
      text: `${t(`events.${eventId}.describe`)}${late}`,
      aside: state.event === "match" ? formatEveningTime(MATCH_KICKOFF) : state.event === "wedding" ? formatEveningTime(WEDDING_TIME) : undefined,
      tone: `ev-${state.event}`,
    });
  }
  // Tonight's rush, if the evening is busy enough (as things stand this morning).
  const rush = tonightsRush(state, forecastCustomers(state));
  if (rush !== null) {
    items.push({ id: "rush", icon: "🔥", title: t("prep.rushTitle"), text: t("prep.rushTonight", { time: formatEveningTime(rush) }), aside: formatEveningTime(rush), tone: "ag-rush" });
  }
  if (state.festival) {
    items.push({
      id: "festival",
      icon: FESTIVALS[state.festival].emoji,
      title: capitalize(t.festival(state.festival)),
      tag: t("prep.forReal"),
      text: t("prep.festivalShort", { until: festivalLastDay(state.festival, t.language) }),
      tone: "ev-fete",
    });
  }
  const goal = state.tonightGoal?.day === state.day ? state.tonightGoal : null;
  if (goal) {
    items.push({
      id: "goal",
      icon: "🎯",
      title: t("tonight.title"),
      tag: t("tonight.optional"),
      text: `${t(`tonight.kinds.${goal.kind}`, { target: goal.target, seconds: LIGHTNING_SECONDS })} ${t("tonight.reward", { reward: TONIGHT_REWARD, xp: TONIGHT_XP })}`,
      tone: "ag-goal",
    });
  }
  // The banquet is the wedding's line: what to make goes with it rather than on a quest line of its own.
  if (state.quest?.giver === "wedding" && state.quest.items) {
    const event = items.find((item) => item.id === "event");
    if (event) event.text = t("prep.weddingTonight", { items: batchItemsText(t, state.quest) });
  } else if (state.quest) {
    items.push({
      id: "quest",
      icon: "📜",
      title: t("prep.quest"),
      // A group order says what to make tonight right away; a longer quest shows its progress once opened.
      text: state.quest.items
        ? `${questText(t, state.quest)} ${t("prep.batchTonight", { items: batchItemsText(t, state.quest) })}`
        : questText(t, state.quest),
      aside: t("prep.questDaysShort", { days: state.quest.deadlineDay - state.day + 1 }),
      tone: "ag-quest",
      more: state.quest.items ? undefined : <QuestDetails quest={state.quest} />,
    });
  }
  const birthdays = birthdaysToday(state);
  if (birthdays.length) {
    items.push({ id: "birthday", icon: "🎂", title: t("prep.birthdayTitle"), text: t("prep.birthdayToday", { names: birthdays.join(", ") }), tone: "ag-birthday" });
  }

  if (!items.length) return null;
  return (
    <section className="agenda" aria-label={t("prep.agenda")}>
      <h3 className="agenda-h">{t("prep.agenda")}</h3>
      {items.map((item) => (
        <details key={item.id} className={`agenda-row ${item.tone}`}>
          <summary>
            <span className="agenda-ic" aria-hidden="true">{item.icon}</span>
            <span className="agenda-main">
              <span className="agenda-title">
                <strong>{item.title}</strong>
                {item.tag && <span className="tag">{item.tag}</span>}
              </span>
              <span className="agenda-text">{item.text}</span>
            </span>
            {item.aside && <span className="agenda-aside">{item.aside}</span>}
          </summary>
          {item.more && <div className="agenda-more">{item.more}</div>}
        </details>
      ))}
    </section>
  );
};
