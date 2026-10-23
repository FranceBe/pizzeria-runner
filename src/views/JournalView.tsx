import type { CSSProperties } from "react";
import { POSTCARDS, POSTCARD_IDS } from "../data/postcards";
import { STORIES, type StoryId } from "../data/stories";
import { FESTIVALS } from "../data/festivals";
import { useState } from "react";
import { ACHIEVEMENT_IDS, HIDDEN_ACHIEVEMENTS } from "../data/achievements";
import { GOOD_PAIRINGS, type Pairing } from "../data/recipes";
import { achievementProgress, isUnlocked } from "../game/achievements";
import { isDiscovered } from "../game/pairings";
import { daysUntilBirthday, regularsOf } from "../game/regulars";
import { CustomerFace } from "../components/CustomerFace";
import { batchItemsText, questText } from "./QuestCard";

const MEDAL_ICONS = { gold: "🥇", silver: "🥈", bronze: "🥉" } as const;
import type { DayRecord, GameState, RecipeSales, Review } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";
import { IngredientIcon } from "../components/IngredientIcon";
import { averageRating, reasonOf, REVIEW_LINES, toneOf } from "../game/reviews";
import { PRESS_PAPERS } from "../data/press";
import { StarRow } from "../components/AppealStars";

const CHART_DAYS = 14;
// Pairings per page of the book.
const PAIRINGS_PER_PAGE = 10;
const TOP_PIZZAS = 5;
const QUESTS_SHOWN = 5;

const Stat = ({ label, value }: { label: string; value: string | number }) => {
  return (
    <div className="jstat">
      <div className="jstat-v">{value}</div>
      <div className="hint">{label}</div>
    </div>
  );
};

// Profit per day as bars around a zero line: green above, red below, day numbers underneath.
// The zero line sits where gains and losses share the height in proportion.
const ProfitChart = ({ days }: { days: readonly DayRecord[] }) => {
  const t = useTranslation();
  if (!days.length) return <p className="hint">{t("journal.chartEmpty")}</p>;
  const width = 280;
  const barsHeight = 90;
  const labelHeight = 12;
  const barWidth = width / CHART_DAYS;
  const highestGain = Math.max(0, ...days.map((day) => day.net));
  const biggestLoss = Math.max(0, ...days.map((day) => -day.net));
  const range = Math.max(1, highestGain + biggestLoss);
  const zeroY = 4 + (barsHeight - 8) * (highestGain / range);
  const scale = (barsHeight - 8) / range;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${barsHeight + labelHeight}`} role="img" aria-label={t("journal.chart")}>
      <line x1="0" x2={width} y1={zeroY} y2={zeroY} className="chart-zero" />
      {days.map((day, index) => {
        const barHeight = Math.max(2, Math.abs(day.net) * scale);
        const x = index * barWidth + barWidth * 0.18;
        return (
          <g key={day.day}>
            <title>{t("journal.dayBar", { day: day.day, net: day.net })}</title>
            <rect
              className={day.net >= 0 ? "bar-pos" : "bar-neg"}
              x={x}
              width={barWidth * 0.64}
              y={day.net >= 0 ? zeroY - barHeight : zeroY}
              height={barHeight}
              rx="2"
            />
            <text x={x + barWidth * 0.32} y={barsHeight + labelHeight - 2} className="chart-day">{day.day}</text>
          </g>
        );
      })}
    </svg>
  );
};

const Accounts = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const { lifetime } = state;
  const topPizzas = Object.entries(lifetime.byRecipe)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP_PIZZAS);
  const mostSold = topPizzas[0]?.[1].count ?? 1;
  return (
    <div className="card pad journal-card j-accounts">
      <h2 className="h">{t("journal.stats")}</h2>
      <div className="jstats">
        <Stat label={t("journal.days")} value={state.history.length} />
        <Stat label={t("journal.served")} value={lifetime.served} />
        <Stat label={t("journal.revenue")} value={t.money(lifetime.revenue)} />
        <Stat label={t("journal.tips")} value={t.money(lifetime.tips)} />
        <Stat label={t("journal.happy")} value={lifetime.happyServed} />
        <Stat label={t("journal.stars")} value={`★ ${lifetime.stars}`} />
        <Stat label={t("journal.bestStreak")} value={lifetime.bestStreak} />
      </div>
      {lifetime.bestDay && <p className="hint">{t("journal.bestDay", lifetime.bestDay)}</p>}
      <QuestLog state={state} />
      <h3 className="h">{t("journal.chart")}</h3>
      <ProfitChart days={state.history.slice(-CHART_DAYS)} />
      <h3 className="h">{t("journal.topPizzas")}</h3>
      {topPizzas.length === 0 && <p className="hint">{t("journal.noSales")}</p>}
      <TopPizzaList state={state} topPizzas={topPizzas} mostSold={mostSold} />
    </div>
  );
};

const TopPizzaList = ({ state, topPizzas, mostSold }: { state: GameState; topPizzas: [string, RecipeSales][]; mostSold: number }) => {
  const t = useTranslation();
  return (
    <>
      {topPizzas.map(([recipeId, sales]) => (
        <div key={recipeId} className="top-pizza">
          <span className="grow">{t.recipe(state.recipes.find((recipe) => recipe.id === recipeId) ?? { id: recipeId, name: sales.name })}</span>
          <span className="top-bar"><i style={{ width: `${(sales.count / mostSold) * 100}%` }} /></span>
          <strong>{sales.count}</strong>
        </div>
      ))}
    </>
  );
};

// The neighbourhood quests completed lately, and what they brought in altogether.
const QuestLog = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const recent = state.questLog.slice(-QUESTS_SHOWN).reverse();
  return (
    <>
      <h3 className="h">{t("journal.quests")}</h3>
      {state.lifetime.questsDone === 0 ? (
        <p className="hint">{t("journal.noQuests")}</p>
      ) : (
        <p className="hint">{t("journal.questsTotal", { count: state.lifetime.questsDone, amount: state.lifetime.questRewards })}</p>
      )}
      {recent.map((quest, index) => (
        <div key={`${quest.day}-${index}`} className="quest-log-row">
          <span className="quest-log-day">{t("journal.questDay", { day: quest.day })}</span>
          <span className="grow">
            {questText(t, quest)}
            {quest.items && ` ${batchItemsText(t, quest)}.`}
            {quest.medal && ` ${MEDAL_ICONS[quest.medal]}`}
          </span>
          <strong className="pos">+{t.money(quest.reward)}</strong>
        </div>
      ))}
    </>
  );
};

// Undiscovered pairings show a hint once the player owns one of the two ingredients.
const PairingSlot = ({ state, pairing }: { state: GameState; pairing: Pairing }) => {
  const t = useTranslation();
  const [a, b] = pairing;
  if (isDiscovered(state, pairing)) {
    return (
      <div className="pairing found">
        <span className="pairing-ics"><IngredientIcon id={a} /><IngredientIcon id={b} /></span>
        <span>{t.pairing(pairing)}</span>
      </div>
    );
  }
  const known = [a, b].find((id) => state.unlocked[id]);
  return (
    <div className="pairing">
      <span className="pairing-ics">{known ? <IngredientIcon id={known} /> : <span className="pairing-q">?</span>}<span className="pairing-q">?</span></span>
      <span className="hint">{known ? t("journal.pairingHint", { id: known }) : "? + ?"}</span>
    </div>
  );
};

// A little recipe book, turned page by page.
const PairingsBook = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(GOOD_PAIRINGS.length / PAIRINGS_PER_PAGE);
  const shown = GOOD_PAIRINGS.slice(page * PAIRINGS_PER_PAGE, (page + 1) * PAIRINGS_PER_PAGE);
  return (
    <div className="card pad journal-card j-pairings">
      <h2 className="h">{t("journal.pairings")}</h2>
      <p className="sub">{t("journal.pairingsIntro", { found: state.discoveredPairings.length, total: GOOD_PAIRINGS.length })}</p>
      <div className="book-page">
        <div className="pairings">
          {shown.map((pairing) => (
            <PairingSlot key={pairing.join("+")} state={state} pairing={pairing} />
          ))}
        </div>
      </div>
      <div className="book-nav">
        <button className="btn sm ghost" disabled={page === 0} aria-label={t("journal.previousPage")} onClick={() => setPage(page - 1)}>◀</button>
        <span className="hint">{t("journal.page", { page: page + 1, count: pageCount })}</span>
        <button className="btn sm ghost" disabled={page >= pageCount - 1} aria-label={t("journal.nextPage")} onClick={() => setPage(page + 1)}>▶</button>
      </div>
    </div>
  );
};

const Achievements = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const unlockedCount = ACHIEVEMENT_IDS.filter((id) => isUnlocked(state, id)).length;
  return (
    <div className="card pad journal-card j-achievements">
      <h2 className="h">{t("journal.achievements")}</h2>
      <p className="sub">{t("journal.achievementsIntro", { count: unlockedCount, total: ACHIEVEMENT_IDS.length })}</p>
      <div className="badges">
        {ACHIEVEMENT_IDS.map((id) => {
          const unlockedOn = state.achievements[id];
          const { current, target } = achievementProgress(state, id);
          if (HIDDEN_ACHIEVEMENTS.has(id) && unlockedOn === undefined) {
            return (
              <div key={id} className="badge hidden-badge">
                <span className="medal" aria-hidden="true">?</span>
                <div className="grow">
                  <strong>{t("journal.secretAchievement")}</strong>
                  <div className="hint">{t(id === "mammaSecret" ? "journal.mammaHint" : "journal.secretHint")}</div>
                </div>
              </div>
            );
          }
          return (
            <div key={id} className={`badge${unlockedOn !== undefined ? " on" : ""}`}>
              <span className="medal" aria-hidden="true">{unlockedOn !== undefined ? "★" : ""}</span>
              <div className="grow">
                <strong>{t(`achievements.${id}.name`)}</strong>
                <div className="hint">{t(`achievements.${id}.describe`)}</div>
                {unlockedOn !== undefined ? (
                  <div className="badge-day">{t("journal.unlockedOn", { day: unlockedOn })}</div>
                ) : (
                  target > 1 && (
                    <div className="badge-progress" title={`${current} / ${target}`}>
                      <i style={{ width: `${(current / target) * 100}%` }} />
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// A regular's story as far as it has come: its title and progress, then each chapter lived, told in the past.
const StorySoFar = ({ story }: { story: { id: StoryId; chapter: number } }) => {
  const t = useTranslation();
  const total = STORIES[story.id].length;
  return (
    <div className="story-so-far">
      <div className="hint">{t("journal.storySoFar", { story: t.storyTitle(story.id), chapter: Math.min(story.chapter, total), total })}</div>
      <ol>
        {Array.from({ length: Math.min(story.chapter, total) }, (_, index) => (
          <li key={index}>{t(`stories.${story.id}.told.${index as 0 | 1 | 2 | 3}`)}</li>
        ))}
      </ol>
    </div>
  );
};

// One card per regular: their favourite, what they never want, when their birthday is, and their story so far.
const RegularsBook = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const regulars = regularsOf(state);
  return (
    <div className="card pad journal-card j-regulars">
      <h2 className="h">{t("journal.regulars")}</h2>
      {regulars.length === 0 && <p className="hint">{t("journal.noRegulars")}</p>}
      <div className="regular-cards">
        {regulars.map((regular) => {
          const favorite = state.recipes.find((recipe) => recipe.id === regular.favoriteRecipeId);
          return (
            <div key={regular.name} className="regular-card">
              <CustomerFace customer={regular} mood={0} />
              <div className="grow">
                <strong>{regular.name}</strong> <span className="hint">· {t("journal.visits", { count: regular.visits })}</span>
                {favorite && <div className="hint">{t("journal.likes", { recipe: t.recipe(favorite) })}</div>}
                {regular.favoriteBackWith && (
                  <div className="hint">{`${FESTIVALS[regular.favoriteBackWith].emoji} ${t("journal.favoriteBack", { festival: regular.favoriteBackWith })}`}</div>
                )}
                {regular.dislikes && <div className="hint">{t("journal.dislikes", { id: regular.dislikes })}</div>}
                {regular.birthday && <div className="hint">{t("journal.birthdayIn", { days: daysUntilBirthday(state, regular.birthday) })}</div>}
                {regular.story && regular.story.chapter > 0 && <StorySoFar story={regular.story} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Reviews and articles are shown a few at a time, newest first, so the card stays short and the papers stay in view.
const REVIEWS_PER_PAGE = 3;
const ARTICLES_PER_PAGE = 2;

// Turns the pages of a list, newest first; renders nothing when everything fits on one page.
const usePages = <T,>(items: readonly T[], perPage: number) => {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  // A list that got shorter (another save loaded) never leaves the page past its end.
  const current = Math.min(page, pageCount - 1);
  const shown = [...items].reverse().slice(current * perPage, (current + 1) * perPage);
  return { shown, page: current, pageCount, setPage };
};

const Pager = ({ page, pageCount, setPage }: { page: number; pageCount: number; setPage: (page: number) => void }) => {
  const t = useTranslation();
  if (pageCount < 2) return null;
  return (
    <div className="book-nav">
      <button className="btn sm ghost" disabled={page === 0} aria-label={t("journal.previousPage")} onClick={() => setPage(page - 1)}>◀</button>
      <span className="hint">{t("journal.page", { page: page + 1, count: pageCount })}</span>
      <button className="btn sm ghost" disabled={page >= pageCount - 1} aria-label={t("journal.nextPage")} onClick={() => setPage(page + 1)}>▶</button>
    </div>
  );
};

// Online reviews: only for show, but a perfectionist's nightmare.
const Reviews = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const average = averageRating(state.reviewScore);
  const { shown, ...pages } = usePages(state.reviews, REVIEWS_PER_PAGE);
  return (
    <div className="card pad journal-card j-reviews reviews">
      <h2 className="h">{t("journal.reviews")}</h2>
      <p className="hint">{t("journal.reviewsSource")}</p>
      {average === null ? (
        <p className="hint">{t("journal.noReviews")}</p>
      ) : (
        <div className="review-score">
          <span className="review-average">{t.number(average)}</span>
          <StarRow stars={Math.round(average)} />
          <span className="hint">{t("journal.reviewsCount", { count: state.reviewScore.count })}</span>
        </div>
      )}
      <ul className="review-list">
        {shown.map((review, index) => (
          <li key={`${review.day}-${review.name}-${index}`} className={`review${review.stars <= 2 ? " bad" : ""}`}>
            <div className="review-head">
              <StarRow stars={review.stars} />
              <strong>{review.name}</strong>
              <span className="hint">{`${t("journal.reviewDay", { day: review.day })} · ${t.recipe({ id: review.recipeId, name: review.recipeName })}`}</span>
            </div>
            <p className="review-text">{`« ${reviewText(t, review)} »`}</p>
          </li>
        ))}
      </ul>
      <Pager {...pages} />
      <PressCuttings state={state} />
    </div>
  );
};

// What a review says: praise, or a complaint in the tone of its stars.
const reviewText = (t: ReturnType<typeof useTranslation>, review: Review): string => {
  const reason = reasonOf(review);
  const line = (review.line % REVIEW_LINES) as 0 | 1 | 2;
  if (reason === "perfect" || reason === "woodFired") return t(`reviewPraise.${reason}.${line}`);
  return t(`reviewComplaints.${reason}.${toneOf(review.stars)}.${line}`);
};

const PRESS_TONE = { 5: "rave", 4: "good", 3: "fair" } as const;

// Food critics' articles, newest first.
const PressCuttings = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const { shown, ...pages } = usePages(state.press, ARTICLES_PER_PAGE);
  if (!state.press.length) return null;
  return (
    <>
      <h3 className="h">{t("journal.press")}</h3>
      {/* Each article as a cutting from the paper: masthead, dateline, the critic's words, their signature. */}
      <ul className="press-list">
        {shown.map((article, index) => (
          <li key={`${article.day}-${index}`} className="press-cutting">
            <div className="press-masthead">{PRESS_PAPERS[article.paper] ?? PRESS_PAPERS[0]}</div>
            <div className="press-dateline">
              <span>{t("journal.pressDay", { day: article.day })}</span>
              <StarRow stars={article.stars} />
            </div>
            <p className="press-quote">
              {`« ${t(`pressLines.${PRESS_TONE[Math.min(5, Math.max(3, article.stars)) as 3 | 4 | 5]}.${(article.line % REVIEW_LINES) as 0 | 1 | 2}`)} »`}
            </p>
            <p className="press-byline">{t(article.mystery ? "journal.pressByMystery" : "journal.pressBy", { critic: article.critic })}</p>
          </li>
        ))}
      </ul>
      <Pager {...pages} />
    </>
  );
};

// The postcards: those received face up and first, in the order they came (the scene, a stamp, the handwritten
// caption, the day), then the others face down with a hint.
const Postcards = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const received = POSTCARD_IDS.filter((id) => state.postcards[id] !== undefined).length;
  return (
    <div className="card pad journal-card j-postcards">
      <div className="row">
        <h2 className="h grow">{t("journal.postcards")}</h2>
        <span className="hint">{t("journal.postcardsCount", { count: received, total: POSTCARD_IDS.length })}</span>
      </div>
      <ul className="postcards">
        {[...POSTCARD_IDS].sort((a, b) => (state.postcards[a] ?? Infinity) - (state.postcards[b] ?? Infinity)).map((id) => {
          const day = state.postcards[id];
          if (day === undefined) {
            return (
              <li key={id} className="postcard back">
                <span className="postcard-q" aria-hidden="true">?</span>
                <span className="postcard-hint">{t(`postcards.${id}.hint`)}</span>
              </li>
            );
          }
          const { scene, sky } = POSTCARDS[id];
          return (
            <li key={id} className="postcard" style={{ "--sky": sky } as CSSProperties}>
              <span className="postcard-scene" aria-hidden="true">{scene}</span>
              <span className="postcard-stamp" aria-hidden="true">🍕</span>
              <strong className="postcard-title">{t(`postcards.${id}.title`)}</strong>
              <span className="postcard-caption">{t(`postcards.${id}.caption`)}</span>
              <span className="postcard-day">{t("journal.postcardDay", { day })}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// The journal's parts. On a phone, one at a time behind these tabs (the last one chosen is remembered on the device);
// from a tablet up, all of them at once.
const SECTIONS = ["accounts", "reviews", "regulars", "pairings", "postcards", "achievements"] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_KEY = "forno-lento-journal-section";

const rememberedSection = (): Section => {
  try {
    const saved = localStorage.getItem(SECTION_KEY);
    return SECTIONS.find((section) => section === saved) ?? "accounts";
  } catch {
    return "accounts";
  }
};

// Each tab's name, with what it holds at a glance.
const SectionTabs = ({ state, section, choose }: { state: GameState; section: Section; choose: (section: Section) => void }) => {
  const t = useTranslation();
  const rating = averageRating(state.reviewScore);
  const counts: Record<Section, string> = {
    accounts: "",
    reviews: rating === null ? "" : `${t.number(rating)}★`,
    regulars: String(regularsOf(state).length),
    pairings: `${state.discoveredPairings.length}/${GOOD_PAIRINGS.length}`,
    postcards: `${POSTCARD_IDS.filter((id) => state.postcards[id] !== undefined).length}/${POSTCARD_IDS.length}`,
    achievements: `${ACHIEVEMENT_IDS.filter((id) => isUnlocked(state, id)).length}/${ACHIEVEMENT_IDS.length}`,
  };
  return (
    <nav className="journal-tabs" role="tablist" aria-label={t("tabs.journal")}>
      {SECTIONS.map((id) => (
        <button key={id} role="tab" aria-selected={id === section} className={`journal-tab${id === section ? " on" : ""}`} onClick={() => choose(id)}>
          {t(`journal.tabs.${id}`)}
          {counts[id] && <span className="journal-tab-count">{counts[id]}</span>}
        </button>
      ))}
    </nav>
  );
};

export const JournalView = ({ state }: { state: GameState }) => {
  const [section, setSection] = useState<Section>(rememberedSection);
  const choose = (next: Section) => {
    setSection(next);
    try {
      localStorage.setItem(SECTION_KEY, next);
    } catch {
      // Not remembered: the journal opens on its first tab next time.
    }
  };
  return (
    // Two columns from a tablet up: the money and the pairings book, then what people say. On a phone, the tabs show
    // one part at a time (styles.css hides the others).
    <div className="journal" data-section={section}>
      <SectionTabs state={state} section={section} choose={choose} />
      <div className="journal-col">
        <Accounts state={state} />
        <PairingsBook state={state} />
      </div>
      <div className="journal-col">
        <Reviews state={state} />
        <RegularsBook state={state} />
      </div>
      <Postcards state={state} />
      <Achievements state={state} />
    </div>
  );
};
