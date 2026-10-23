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

// One card per regular: their favourite, what they never want, and when their birthday is.
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

export const JournalView = ({ state }: { state: GameState }) => {
  return (
    // Two columns from a tablet up: the money and the pairings book, then what people say. On a phone the columns
    // melt into one list, in the order set in styles.css.
    <div className="journal">
      <div className="journal-col">
        <Accounts state={state} />
        <PairingsBook state={state} />
      </div>
      <div className="journal-col">
        <Reviews state={state} />
        <RegularsBook state={state} />
      </div>
      <Achievements state={state} />
    </div>
  );
};
