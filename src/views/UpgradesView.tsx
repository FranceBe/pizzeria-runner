import { UPGRADES, UPGRADE_KEYS, type Upgrade, type UpgradeKey } from "../data/progression";
import { dailyCharges } from "../game/economy";
import { levelForXp } from "../game/progression";
import { useTranslation } from "../i18n/I18nContext";
import { COSMETIC_PRICES, COSMETIC_SLOTS, STAR_LOOKS, type CosmeticSlot, type LookIds } from "../data/cosmetics";
import type { Dispatch, GameState } from "../game/types";
import { canAfford } from "../utils/math";
import type { ScreenProps } from "./types";

interface UpgradeCardProps {
  upgradeKey: UpgradeKey;
  upgrade: Upgrade;
  currentLevel: number;
  playerLevel: number;
  money: number;
  dispatch: Dispatch;
}

function UpgradeCard({ upgradeKey, upgrade, currentLevel, playerLevel, money, dispatch }: UpgradeCardProps) {
  const t = useTranslation();
  const isMaxed = currentLevel >= upgrade.costs.length;
  const requiredLevel = upgrade.requiredLevel[currentLevel];
  const cost = upgrade.costs[currentLevel];
  const describe = (level: number) => t.upgradeDescription(upgradeKey, level);

  let action;
  if (isMaxed) action = <span className="pair">{t("upgrades.maxed")}</span>;
  else if (playerLevel < requiredLevel) {
    action = <span className="tag" style={{ alignSelf: "flex-start" }}>{t("upgrades.levelRequired", { level: requiredLevel })}</span>;
  } else {
    action = (
      <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={money < cost} onClick={() => dispatch({ type: "buyUpgrade", upgradeKey })}>
        {t("upgrades.buy", { cost })}
      </button>
    );
  }

  return (
    <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row">
        <strong className="grow" style={{ fontSize: 17 }}>{t.upgradeName(upgradeKey)}</strong>
        <span className="tag">{currentLevel} / {upgrade.costs.length}</span>
      </div>
      <div><span className="hint">{t("upgrades.current")}</span> {describe(currentLevel)}</div>
      {!isMaxed && (
        <div>
          <span className="hint">{t("upgrades.next")}</span> {describe(currentLevel + 1)}{" "}
          {upgrade.dailyCharge > 0 && <span className="hint">{t("upgrades.extraCharges", { amount: upgrade.dailyCharge })}</span>}
        </div>
      )}
      {action}
    </div>
  );
}

// A little preview of each look: a stripe of awning, a lettering style, a patch of wall.
function LookSwatch({ slot, id }: { slot: CosmeticSlot; id: string }) {
  return <span className={`swatch swatch-${slot} ${slot}-${id}`} aria-hidden="true">{slot === "sign" ? "Aa" : ""}</span>;
}

interface LookGroupProps<Slot extends CosmeticSlot> {
  slot: Slot;
  label: string;
  nameOf: (id: LookIds[Slot]) => string;
  state: GameState;
  dispatch: Dispatch;
}

function LookGroup<Slot extends CosmeticSlot>({ slot, label, nameOf, state, dispatch }: LookGroupProps<Slot>) {
  const t = useTranslation();
  const ids: readonly LookIds[Slot][] = COSMETIC_SLOTS[slot];
  return (
    <div className="look-slot">
      <div className="binlabel">{label}</div>
      <div className="look-options">
        {ids.map((id) => {
          const price: number = COSMETIC_PRICES[slot][id];
          // Some looks are earned with the days' stars instead of bought.
          const starsNeeded = STAR_LOOKS[`${slot}:${id}`];
          const isEarned = starsNeeded === undefined || state.lifetime.stars >= starsNeeded;
          const isOwned = isEarned && (price === 0 || state.cosmetics.owned.includes(`${slot}:${id}`));
          const isInUse = state.cosmetics[slot] === id;
          return (
            <button
              key={id}
              className={`look${isInUse ? " in-use" : ""}`}
              aria-pressed={isInUse}
              disabled={isInUse || !isEarned || (!isOwned && !canAfford(state.money, price))}
              onClick={() => dispatch({ type: "chooseCosmetic", slot, id })}
            >
              <LookSwatch slot={slot} id={id} />
              <span className="look-n">{nameOf(id)}</span>
              <span className="look-a">
                {isInUse
                  ? t("upgrades.inUse")
                  : !isEarned && starsNeeded !== undefined
                    ? t("upgrades.starsNeeded", { count: starsNeeded })
                    : isOwned
                      ? t("upgrades.choose")
                      : t("upgrades.buyLook", { cost: price })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Purely visual: the awning, the sign and the walls.
function LooksShop({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const t = useTranslation();
  return (
    <div className="card pad looks">
      <h2 className="h">{t("upgrades.looks")}</h2>
      <p className="sub">{t("upgrades.looksIntro")}</p>
      <LookGroup slot="awning" label={t("upgrades.slots.awning")} nameOf={(id) => t(`upgrades.awnings.${id}`)} state={state} dispatch={dispatch} />
      <LookGroup slot="sign" label={t("upgrades.slots.sign")} nameOf={(id) => t(`upgrades.signs.${id}`)} state={state} dispatch={dispatch} />
      <LookGroup slot="wall" label={t("upgrades.slots.wall")} nameOf={(id) => t(`upgrades.walls.${id}`)} state={state} dispatch={dispatch} />
    </div>
  );
}

export function UpgradesView({ state, dispatch }: ScreenProps) {
  const t = useTranslation();
  const playerLevel = levelForXp(state.xp);
  return (
    <>
      <h2 className="h">{t("upgrades.title")}</h2>
      <p className="sub" style={{ marginBottom: 12 }}>{t("upgrades.intro", { charges: dailyCharges(state) })}</p>
      <div className="grid2">
        {UPGRADE_KEYS.map((key) => (
          <UpgradeCard
            key={key}
            upgradeKey={key}
            upgrade={UPGRADES[key]}
            currentLevel={state.upgrades[key]}
            playerLevel={playerLevel}
            money={state.money}
            dispatch={dispatch}
          />
        ))}
      </div>
      <LooksShop state={state} dispatch={dispatch} />
    </>
  );
}
