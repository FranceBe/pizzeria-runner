// The morning's "on tonight" list: the day's event, a real-calendar festival, tonight's goal, the neighbourhood quest and
// birthdays, as small tiles side by side instead of a stack of banners. A tile shows its icon, its name and a time or a
// deadline; tapping it opens it across the whole width, with what it says.
import { useState, type ReactNode } from "react";
import { FESTIVALS } from "../data/festivals";
import { FAMILY_TIME, MATCH_KICKOFF, WEDDING_TIME, type DayEventId } from "../data/events";
import { LIGHTNING_SECONDS, TONIGHT_REWARD, TONIGHT_XP } from "../data/tonight";
import { festivalLastDay } from "../game/calendar";
import { formatEveningTime } from "../game/clock";
import { birthdaysToday } from "../game/regulars";
import { storyGuestsToday } from "../game/stories";
import { competitorDay, competitorFactor, ratingFactor } from "../game/competitor";
import { averageRating } from "../game/reviews";
import { COMPETITOR_DAYS, COMPETITOR_STARS_TO_WIN } from "../data/competitor";
import { STORIES } from "../data/stories";
import { forecastCustomers } from "../game/economy";
import { tonightsRush } from "../game/evening";
import { shownEvent } from "../game/service";
import { isThemeNight, THEME_MENU_TARGET, themeOnMenu } from "../game/themes";
import type { Dispatch, GameState } from "../game/types";
import { commisMood } from "../game/commis";
import { vacantPosts } from "../game/staff";
import { useTranslation } from "../i18n/I18nContext";
import { QuestDetails, batchItemsText, questText } from "./QuestCard";
import { EVENT_ICONS } from "./eventIcons";
import { GazettePage } from "./Gazette";
import { openAlbumOn, StoryPreviously } from "./StoryAlbum";
import { todaysGazette } from "../game/gazette";


// Events that happen at a time on the evening's clock, shown on their tile.
const EVENT_TIMES: Partial<Record<DayEventId, number>> = { match: MATCH_KICKOFF, wedding: WEDDING_TIME, nonnaFamily: FAMILY_TIME };

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

interface TonightAgendaProps {
  state: GameState;
  dispatch: Dispatch;
  onOpenAlbum?: () => void;
  onOpenStaff?: () => void;
}

export const TonightAgenda = ({ state, dispatch, onOpenAlbum, onOpenStaff }: TonightAgendaProps) => {
  const t = useTranslation();
  const [isReading, setIsReading] = useState(false);
  const items: AgendaItem[] = [];
  // The commis, when they need a rest (or have the evening off): an evening off is given from here.
  const mood = commisMood(state);
  if (state.commis && (mood === "tired" || mood === "exhausted" || mood === "off")) {
    const { name, fatigue } = state.commis;
    items.push({
      id: "commis",
      icon: mood === "off" ? "😴" : "😮‍💨",
      title: t(`prep.commis.${mood}`, { name }),
      text: t(`prep.commis.${mood}Text`, { name, fatigue: Math.round(fatigue) }),
      tone: "ag-commis",
      more: (
        <button className="btn sm" onClick={() => dispatch({ type: "toggleCommisOff" })}>
          {mood === "off" ? t("prep.commis.cancelOff") : t("prep.commis.giveOff", { name })}
        </button>
      ),
    });
  }
  // A post nobody fills (someone let go, or gone in hardcore): said each morning until someone is hired.
  vacantPosts(state).forEach((role) => {
    items.push({
      id: `vacant-${role}`,
      icon: "🪧",
      title: t("staff.vacantTitle", { role }),
      text: t("staff.vacantText"),
      tone: "ag-commis",
      more: onOpenStaff ? <button className="btn sm" onClick={onOpenStaff}>{t("staff.seeStaff")}</button> : undefined,
    });
  });
  // The week's gazette, the morning it comes out.
  const gazette = todaysGazette(state);
  if (gazette) {
    items.push({
      id: "gazette",
      icon: "📰",
      title: t("gazette.outTitle"),
      text: t(`gazette.headlines.${gazette.headline}`, {
        name: state.name,
        recipe: gazette.top ? t.recipe({ id: gazette.top.recipeId, name: gazette.top.recipeName }) : "",
      }),
      tone: "ag-gazette",
      more: <button className="btn sm" onClick={() => setIsReading(true)}>{t("gazette.read")}</button>,
    });
  }

  const eventId = state.event ? shownEvent(state, state.event) : null;
  if (state.event && eventId) {
    const late = state.event === "lateDelivery" && state.lateIngredient ? ` ${t("prep.lateIngredient", { id: state.lateIngredient })}` : "";
    const theme = isThemeNight(state.event) ? ` ${t("prep.themeOnMenu", { count: themeOnMenu(state), target: THEME_MENU_TARGET })}` : "";
    const spoiling = state.event === "fridgeFailure" && state.spoilingIngredient ? ` ${t("prep.spoiling", { id: state.spoilingIngredient })}` : "";
    items.push({
      id: "event",
      icon: EVENT_ICONS[eventId] ?? "📣",
      title: t(`events.${eventId}.name`),
      text: `${t(`events.${eventId}.describe`)}${late}${theme}${spoiling}`,
      aside: EVENT_TIMES[state.event] !== undefined ? formatEveningTime(EVENT_TIMES[state.event] ?? 0) : undefined,
      tone: `ev-${state.event}`,
    });
  }
  // The competitor across the street: its day, what it does to tonight's customers, how far the stars against it are.
  const versus = competitorDay(state);
  if (versus !== null && state.competitor) {
    const rating = averageRating(state.reviewScore);
    items.push({
      id: "competitor",
      icon: "🏪",
      title: t("prep.competitorTitle", { name: state.competitor.name }),
      text: t("prep.competitorText", {
        rating: rating === null ? t("prep.noRating") : `${t.number(rating)} ★`,
        share: Math.round((1 - ratingFactor(rating)) * 100),
        stars: state.competitor.stars,
        target: COMPETITOR_STARS_TO_WIN,
      }),
      aside: t("prep.competitorDay", { day: versus, total: COMPETITOR_DAYS }),
      tone: "ag-competitor",
    });
  } else if (competitorFactor(state) > 1 && state.competitor) {
    items.push({
      id: "competitor",
      icon: "🎉",
      title: t("prep.competitorBoostTitle", { name: state.competitor.name }),
      text: t("prep.competitorBoost", { share: Math.round((competitorFactor(state) - 1) * 100) }),
      tone: "ag-goal",
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
  // Regulars coming for the next chapter of their story.
  storyGuestsToday(state).forEach((name) => {
    const story = state.customerBook[name]?.story;
    if (!story) return;
    items.push({
      id: `story-${name}`,
      icon: "📖",
      title: t("prep.storyComing", { names: name }),
      text: t("prep.storyNext", { story: t.storyTitle(story.id), chapter: story.chapter + 1, total: STORIES[story.id].length }),
      tone: "ag-story",
      // Opened: what the story is about, what happened so far, and the album.
      more: (
        <>
          <p className="agenda-text">{t(`stories.${story.id}.intro`, { name })}</p>
          <StoryPreviously story={story} />
          {onOpenAlbum && (
            <button
              className="btn sm"
              onClick={() => {
                openAlbumOn(name);
                onOpenAlbum();
              }}
            >
              {t("prep.storyAlbum")}
            </button>
          )}
        </>
      ),
    });
  });
  const birthdays = birthdaysToday(state);
  if (birthdays.length) {
    items.push({ id: "birthday", icon: "🎂", title: t("prep.birthdayTitle"), text: t("prep.birthdayToday", { names: t.list(birthdays) }), tone: "ag-birthday" });
  }

  if (!items.length) return null;
  const reading = isReading && gazette ? <GazettePage issue={gazette} state={state} onClose={() => setIsReading(false)} /> : null;
  return (
    <section className="agenda" aria-label={t("prep.agenda")}>
      <h3 className="agenda-h">{t("prep.agenda")}</h3>
      {items.map((item) => (
        <details key={item.id} className={`agenda-row ${item.tone}`}>
          <summary>
            <span className="agenda-ic" aria-hidden="true">{item.icon}</span>
            <span className="agenda-title">
              <strong>{item.title}</strong>
              {item.tag && <span className="tag">{item.tag}</span>}
            </span>
            {item.aside && <span className="agenda-aside">{item.aside}</span>}
          </summary>
          <div className="agenda-more">
            <p className="agenda-text">{item.text}</p>
            {item.more}
          </div>
        </details>
      ))}
      {reading}
    </section>
  );
};
