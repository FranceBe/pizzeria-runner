import { useEffect, useState } from "react";
import { audio } from "../audio/engine";
import { Overlay } from "../components/Overlay";
import type { ChallengeResult as Result, Dispatch } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";
import { useMultiplayer } from "../multiplayer/MultiplayerContext";
import { ranking } from "./MultiplayerView";

// "2026-10-17" → "17/10" in French, "10/17" in English.
const shortDate = (date: string, language: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString(language, { day: "numeric", month: "numeric" });

// Pizza slices raining down on the winner (still for those who asked for less motion: see styles.css).
const SLICES = 18;
const Confetti = () => (
  <div className="royale-rain" aria-hidden="true">
    {Array.from({ length: SLICES }, (_, index) => (
      <span key={index} style={{ left: `${(index * 53) % 100}%`, animationDelay: `${(index % 6) * 0.25}s` }}>
        🍕
      </span>
    ))}
  </div>
);

// The end of a Pizza Royale, as this player sees it: the crown, out (and why), or time up.
const RoyaleHeadline = ({ result, place, count, hasWon, isOver }: { result: Result; place: number; count: number; hasWon: boolean; isOver: boolean }) => {
  const t = useTranslation();
  useEffect(() => {
    if (hasWon) audio.fanfare();
  }, [hasWon]);
  if (hasWon) {
    return (
      <div className="royale-win">
        <Confetti />
        <div className="royale-crown" aria-hidden="true">👑</div>
        <h2 className="h royale-title">{t("multi.royale.winTitle")}</h2>
        <p className="hint">{t("multi.royale.winText")}</p>
      </div>
    );
  }
  if (result.out) {
    return (
      <>
        <h2 className="h">{t("multi.royale.outTitle")}</h2>
        <p className="hint">{t(result.out === "waste" ? "multi.royale.outWaste" : "multi.royale.outUnwanted")}</p>
        {isOver && <p className="mp-team">{t("multi.royale.place", { place, count })}</p>}
      </>
    );
  }
  return (
    <>
      <h2 className="h">{t("multi.results")}</h2>
      <p className="hint">{t("multi.royale.timeUp")}</p>
    </>
  );
};

// After a match against friends: the podium, filled in as the others' clocks run out too.
const MatchResult = ({ result, dispatch }: { result: Result; dispatch: Dispatch }) => {
  const t = useTranslation();
  const { room, you } = useMultiplayer();
  const players = room ? ranking(room) : [];
  const everyoneDone = room?.players.every((player) => player.done) ?? true;
  // Co-op: one kitchen, one score for the team.
  if (result.coop) {
    return (
      <Overlay label={t("multi.teamScore")} onClose={() => dispatch({ type: "dismissChallengeResult" })}>
        <div className="card pad challenge-result">
          <h2 className="h">{t("multi.teamScore")}</h2>
          <div className="challenge-score">{result.score}</div>
          <div className="hint">{t("challenge.points")} · {t("challenge.served", { count: result.served })}</div>
          <p className="mp-team">{(room?.players ?? []).map((player) => player.name).join(" & ")}</p>
          <button className="btn primary" onClick={() => dispatch({ type: "dismissChallengeResult" })}>{t("challenge.close")}</button>
        </div>
      </Overlay>
    );
  }
  const isRoyale = result.royale === true;
  const isOver = room?.status === "finished";
  const place = players.findIndex((player) => player.id === you) + 1;
  const hasWon = isRoyale && isOver && place === 1;
  // While a Pizza Royale goes on, those still in have no final score yet.
  const scoreOf = (player: (typeof players)[number]) =>
    isRoyale && player.out === undefined && !isOver ? t("multi.royale.stillIn") : player.done || isOver ? t("multi.points", { score: player.score }) : "…";
  return (
    <Overlay label={t("multi.results")} onClose={() => dispatch({ type: "dismissChallengeResult" })}>
      <div className={`card pad challenge-result${hasWon ? " is-winner" : ""}`}>
        {isRoyale ? (
          <RoyaleHeadline result={result} place={place} count={players.length} hasWon={hasWon} isOver={isOver} />
        ) : (
          <h2 className="h">{t("multi.results")}</h2>
        )}
        <div className="challenge-score">{result.score}</div>
        <div className="hint">{t("challenge.points")} · {t("challenge.served", { count: result.served })}</div>
        <ol className="mp-podium">
          {players.map((player, index) => (
            <li key={player.id} className={`tb-${player.color}${player.id === you ? " is-you" : ""}`}>
              <span>{isRoyale && isOver && index === 0 ? "👑" : (["🥇", "🥈", "🥉"][index] ?? `${index + 1}.`)}</span>
              <strong className="grow">{player.id === you ? `${player.name} (${t("multi.you")})` : player.name}</strong>
              <span>
                {scoreOf(player)}
                {isRoyale && player.out !== undefined && <span className="hint">{` · ${t("multi.royale.out")}`}</span>}
              </span>
            </li>
          ))}
        </ol>
        {!everyoneDone && !(isRoyale && isOver) && <p className="hint">{t("multi.waitingOthers")}</p>}
        <button className="btn primary" onClick={() => dispatch({ type: "dismissChallengeResult" })}>{t("challenge.close")}</button>
      </div>
    </Overlay>
  );
};

// Shown when the daily challenge's clock runs out, with a way to brag about it.
export const ChallengeResult = ({ result, best, dispatch }: { result: Result; best: number; dispatch: Dispatch }) => {
  const t = useTranslation();
  const [isCopied, setCopied] = useState(false);

  const share = async () => {
    const text = t("challenge.shareText", {
      date: shortDate(result.date, t.language),
      score: result.score,
      served: result.served,
      happy: result.happy,
    });
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
    } catch {
      // Cancelled by the player, or no clipboard access: nothing to do.
    }
  };

  if (result.multiplayer) return <MatchResult result={result} dispatch={dispatch} />;
  return (
    <Overlay label={t("challenge.dialog")} onClose={() => dispatch({ type: "dismissChallengeResult" })}>
      <div className="card pad challenge-result">
        <h2 className="h">{t("challenge.title")}</h2>
        <div className="challenge-score">{result.score}</div>
        <div className="hint">{t("challenge.points")} · {t("challenge.served", { count: result.served })}</div>
        <p className={result.isNewBest ? "pair challenge-best" : "hint"}>
          {result.isNewBest ? t("challenge.newBest") : t("challenge.best", { score: best })}
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => void share()}>{t("challenge.share")}</button>
          <button className="btn primary" onClick={() => dispatch({ type: "dismissChallengeResult" })}>{t("challenge.close")}</button>
        </div>
        {isCopied && <p className="hint" role="status">{t("challenge.copied")}</p>}
      </div>
    </Overlay>
  );
};
