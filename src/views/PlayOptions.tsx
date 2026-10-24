import { useEffect, useRef } from "react";
import { DAY_EVENT_IDS, EVENT_CATEGORIES, type DayEventId, type EventCategory } from "../data/events";
import { PLAY_FEATURES, isAllOff, isEventOn, isFeatureOn, type PlayFeature } from "../game/playOptions";
import { useTranslation } from "../i18n/I18nContext";
import { EVENT_ICONS } from "./eventIcons";
import type { ScreenProps } from "./types";

const SERVICE_FEATURES: readonly PlayFeature[] = ["rush", "groupOrders", "asUsual", "specialRequests"];
const NEIGHBOURHOOD_FEATURES: readonly PlayFeature[] = ["quests", "competitor"];
const CATEGORIES = Object.keys(EVENT_CATEGORIES) as EventCategory[];

// A family of events: ticked when all are on, half-ticked when some are.
const CategorySwitch = ({ state, dispatch, category }: ScreenProps & { category: EventCategory }) => {
  const t = useTranslation();
  const box = useRef<HTMLInputElement>(null);
  const ids: readonly DayEventId[] = EVENT_CATEGORIES[category];
  const onCount = ids.filter((id) => isEventOn(state, id)).length;
  useEffect(() => {
    if (box.current) box.current.indeterminate = onCount > 0 && onCount < ids.length;
  }, [onCount, ids.length]);
  return (
    <label className="switch">
      <input ref={box} type="checkbox" checked={onCount === ids.length} onChange={() => dispatch({ type: "setEventsOff", events: ids, off: onCount === ids.length })} />
      {t(`settings.play.categories.${category}`)}
    </label>
  );
};

// What the player keeps or switches off for a calmer game (game/playOptions.ts): all on by default.
export const PlayOptions = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  const feature = (id: PlayFeature) => (
    <label key={id} className="switch">
      <input type="checkbox" checked={isFeatureOn(state, id)} onChange={() => dispatch({ type: "setFeaturesOff", features: [id], off: isFeatureOn(state, id) })} />
      {t(`settings.play.features.${id}`)}
    </label>
  );
  const setAll = (off: boolean) => {
    dispatch({ type: "setEventsOff", events: DAY_EVENT_IDS, off });
    dispatch({ type: "setFeaturesOff", features: PLAY_FEATURES, off });
  };
  return (
    <div className="card pad play-options">
      <h2 className="h">{t("settings.play.title")}</h2>
      <p className="hint">{t("settings.play.intro")}</p>
      <div className="row">
        <button className={`btn sm${isAllOff(state) ? " primary" : ""}`} aria-pressed={isAllOff(state)} onClick={() => setAll(true)}>{t("settings.play.calm")}</button>
        <button className="btn sm" onClick={() => setAll(false)}>{t("settings.play.all")}</button>
      </div>
      {isAllOff(state) && <p className="play-calm">{`🌿 ${t("settings.play.calmOn")}`}</p>}
      <h3 className="binlabel">{t("settings.play.service")}</h3>
      {SERVICE_FEATURES.map(feature)}
      <h3 className="binlabel">{t("settings.play.neighbourhood")}</h3>
      {NEIGHBOURHOOD_FEATURES.map(feature)}
      <h3 className="binlabel">{t("settings.play.events")}</h3>
      {CATEGORIES.map((category) => (
        <CategorySwitch key={category} state={state} dispatch={dispatch} category={category} />
      ))}
      <details className="play-events">
        <summary>{t("settings.play.oneByOne")}</summary>
        {CATEGORIES.map((category) => (
          <div key={category} className="play-events-group">
            <span className="hint">{t(`settings.play.categories.${category}`)}</span>
            {EVENT_CATEGORIES[category].map((id) => (
              <label key={id} className="switch">
                <input type="checkbox" checked={isEventOn(state, id)} onChange={() => dispatch({ type: "setEventsOff", events: [id], off: isEventOn(state, id) })} />
                {`${EVENT_ICONS[id] ?? "📣"} ${t(`events.${id}.name`)}`}
              </label>
            ))}
          </div>
        ))}
      </details>
      <p className="hint">{t("settings.play.achievementsNote")}</p>
    </div>
  );
};
