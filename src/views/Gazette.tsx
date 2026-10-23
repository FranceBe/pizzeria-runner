import { useState } from "react";
import { Overlay } from "../components/Overlay";
import { Pizza } from "../components/Pizza";
import { StarRow } from "../components/AppealStars";
import type { GameState, Gazette } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";
import { EVENT_ICONS } from "./eventIcons";
import { reviewText } from "./reviewText";

// The neighbourhood gazette's front page about a week (game/gazette.ts): a masthead, the headline, the figures, the
// pizza of the week, what happened in the street, a reader's letter.
export const GazettePage = ({ issue, state, onClose }: { issue: Gazette; state: GameState; onClose: () => void }) => {
  const t = useTranslation();
  const name = state.name;
  const top = issue.top ? { id: issue.top.recipeId, name: issue.top.recipeName } : null;
  const topRecipe = top ? state.recipes.find((recipe) => recipe.id === top.id) : undefined;
  const recipeName = top ? t.recipe(top) : "";
  return (
    <Overlay label={t("gazette.masthead")} onClose={onClose}>
      <article className="gazette">
        <header className="gazette-head">
          <div className="gazette-masthead">{t("gazette.masthead")}</div>
          <div className="gazette-issue">{t("gazette.issue", { number: issue.week + 1, first: issue.firstDay, last: issue.lastDay })}</div>
        </header>
        <h2 className="gazette-headline">{t(`gazette.headlines.${issue.headline}`, { name, recipe: recipeName })}</h2>
        <p className="gazette-lede">{t("gazette.lede", { name, served: issue.served, days: issue.evenings })}</p>
        <div className="gazette-cols">
          <section className="gazette-box">
            <h3>{t("gazette.numbersTitle")}</h3>
            <dl className="gazette-figures">
              <dt>{t("gazette.served")}</dt>
              <dd>{issue.served}</dd>
              <dt>{t("gazette.net")}</dt>
              <dd>{`${issue.net >= 0 ? "+" : ""}${t.money(issue.net)}`}</dd>
              {issue.happyShare !== null && (
                <>
                  <dt>{t("gazette.happy")}</dt>
                  <dd>{`${issue.happyShare} %`}</dd>
                </>
              )}
              <dt>{t("gazette.stars")}</dt>
              <dd>{`★ ${issue.stars}`}</dd>
            </dl>
            <p>{t("gazette.bestDay", issue.bestDay)}</p>
          </section>
          {issue.top && (
            <section className="gazette-box">
              <h3>{t("gazette.topTitle")}</h3>
              <div className="gazette-top">
                {topRecipe && <Pizza ingredients={topRecipe.ingredients} baked size={56} />}
                <p>{t("gazette.topText", { recipe: recipeName, count: issue.top.count })}</p>
              </div>
            </section>
          )}
          <section className="gazette-box">
            <h3>{t("gazette.eventsTitle")}</h3>
            {issue.events.length ? (
              <ul className="gazette-events">
                {issue.events.map((id) => (
                  <li key={id}>{`${EVENT_ICONS[id] ?? "📣"} ${t(`events.${id}.name`)}`}</li>
                ))}
              </ul>
            ) : (
              <p>{t("gazette.noEvents")}</p>
            )}
          </section>
          <section className="gazette-box">
            <h3>{t("gazette.lettersTitle")}</h3>
            {issue.review ? (
              <blockquote className="gazette-letter">
                <StarRow stars={issue.review.stars} />
                <p>{`« ${reviewText(t, issue.review)} »`}</p>
                <footer>{`— ${issue.review.name}`}</footer>
              </blockquote>
            ) : (
              <p>{t("gazette.noLetters")}</p>
            )}
          </section>
        </div>
        <button className="btn primary gazette-close" onClick={onClose}>{t("gazette.close")}</button>
      </article>
    </Overlay>
  );
};

// Past issues, in the journal's accounts: newest first, each opened on tap.
export const GazetteArchive = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const [open, setOpen] = useState<Gazette | null>(null);
  if (!state.gazettes.length) return null;
  return (
    <>
      <h3 className="h">{t("gazette.archive")}</h3>
      <ul className="gazette-archive">
        {[...state.gazettes].reverse().map((issue) => (
          <li key={issue.week}>
            <button className="gazette-archive-item" onClick={() => setOpen(issue)}>
              <span className="gazette-archive-no">{t("gazette.issue", { number: issue.week + 1, first: issue.firstDay, last: issue.lastDay })}</span>
              <span className="gazette-archive-title">{t(`gazette.headlines.${issue.headline}`, { name: state.name, recipe: issue.top ? t.recipe({ id: issue.top.recipeId, name: issue.top.recipeName }) : "" })}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <GazettePage issue={open} state={state} onClose={() => setOpen(null)} />}
    </>
  );
};
