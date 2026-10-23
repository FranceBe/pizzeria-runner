// Dev only: every synthesised sound at the press of a button, to listen to them and tweak SOUND in audio/synth.ts.
// Its labels are not translated: players never see it.
import { useState } from "react";
import { audio } from "../audio/engine";
import { EFFECT_IDS, type EffectId } from "../audio/synth";

const LABELS: Record<EffectId, string> = {
  newOrder: "🔔 Nouvelle commande",
  payment: "💶 Caisse",
  fanfareSmall: "🎉 Fanfare (petite)",
  fanfareMedium: "🎊 Fanfare (moyenne)",
  fanfareBig: "🏆 Fanfare (grande)",
};

export const SoundLab = () => {
  const [isBaking, setBaking] = useState(false);
  const [isLive, setLive] = useState(false);
  const bake = (isOn: boolean) => {
    audio.unlock();
    audio.setSizzle(isOn);
    setBaking(isOn);
  };
  return (
    <div className="dev-sounds">
      <h3 className="h">🔊 Sons</h3>
      <p className="hint">
        Les effets suivent le volume des effets (Réglages). Après une retouche dans audio/synth.ts, « Re-générer » refait les
        sons pré-calculés ; « en direct » les joue sans eux.
      </p>
      <div className="row">
        {EFFECT_IDS.map((id) => (
          <button
            key={id}
            className="btn sm"
            onClick={() => {
              audio.unlock();
              audio.play(id, { live: isLive });
            }}
          >
            {LABELS[id]}
          </button>
        ))}
      </div>
      <div className="row">
        <button className={`btn sm${isBaking ? " primary" : ""}`} onClick={() => bake(!isBaking)}>
          {isBaking ? "🔥 Four : arrêter" : "🔥 Four : allumer"}
        </button>
      </div>
      <div className="row">
        <label className="dev-toggle">
          <input type="checkbox" checked={isLive} onChange={(event) => setLive(event.target.checked)} />
          En direct (sans pré-calcul)
        </label>
        <button className="btn sm ghost" onClick={() => audio.rerenderEffects()}>Re-générer</button>
      </div>
    </div>
  );
};
