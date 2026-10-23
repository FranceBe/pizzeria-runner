// The "Multiplayer" tab: pick a mode (each described), or join a room; then the lobby, the match, and the podium.
// Challenge and quick co-op are played on the service screen; a duo pizzeria takes over the whole game while it is open.
import { useEffect, useState, type ReactNode } from "react";
import { MATCH_LENGTHS, MIN_PLAYERS, ROLES_CHOICES, isOwnKitchen, isSharedKitchen, maxPlayersIn, type PlayerView, type RoomMode, type RoomView } from "../multiplayer/protocol";
import { useMultiplayer } from "../multiplayer/MultiplayerContext";
import { deleteDuo, loadDuos, newDuo, openDuo, type DuoSave } from "../multiplayer/duoSaves";
import { useTranslation } from "../i18n/I18nContext";
import type { TabId } from "../components/TabIcon";
import type { ScreenProps } from "./types";

// Best score first; a player who left keeps their place with what they had. In a Pizza Royale, those still in come
// first (on points), then the others, the last one out first.
const stillInFirst = (player: PlayerView): number => player.out ?? Infinity;
export const ranking = (room: RoomView): PlayerView[] =>
  [...room.players].sort(
    (a, b) => (room.mode === "royale" ? stillInFirst(b) - stillInFirst(a) : 0) || b.score - a.score || b.served - a.served,
  );

const MEDALS = ["🥇", "🥈", "🥉"];
const MODE_ICONS: Record<RoomMode, string> = { challenge: "🏁", royale: "👑", coop: "🍕", duo: "🤝" };

const PlayerList = ({ room, you, showScores }: { room: RoomView; you: string | null; showScores: boolean }) => {
  const t = useTranslation();
  const players = showScores ? ranking(room) : room.players;
  return (
    <ul className="mp-players">
      {players.map((player, index) => (
        <li key={player.id} className={`mp-player tb-${player.color}${player.id === you ? " is-you" : ""}`}>
          <span className="mp-dot" aria-hidden="true" />
          {showScores && <span className="mp-rank">{MEDALS[index] ?? `${index + 1}.`}</span>}
          <strong className="grow">
            {player.name}
            {player.id === you && <span className="hint">{` (${t("multi.you")})`}</span>}
            {player.isHost && !showScores && <span className="tag mp-host">{t("multi.host")}</span>}
            {player.away && player.connected && <span className="hint">{` · ${t("multi.away")}`}</span>}
          </strong>
          {showScores ? (
            <span className="mp-score">
              {t("multi.points", { score: player.score })}
              {player.out !== undefined && <span className="hint">{` · ${t("multi.royale.out")}`}</span>}
              {!player.connected && player.out === undefined && <span className="hint">{` · ${t("multi.left")}`}</span>}
            </span>
          ) : (
            <span className={player.ready ? "pair" : "hint"}>{player.ready ? `✓ ${t("multi.ready")}` : t("multi.busy")}</span>
          )}
        </li>
      ))}
    </ul>
  );
};

// Counts down to the start, on this device's clock.
const Countdown = ({ startAt }: { startAt: number }) => {
  const t = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.ceil((startAt - now) / 1000);
  return seconds > 0 ? <p className="mp-countdown">{t("multi.countdown", { seconds })}</p> : null;
};

// How long the match lasts: the host picks it, the others see it.
const MatchLength = ({ room, isHost }: { room: RoomView; isHost: boolean }) => {
  const t = useTranslation();
  const { setLength } = useMultiplayer();
  if (room.mode !== "challenge" && room.mode !== "coop") return null;
  return (
    <div className="row mp-length">
      <span className="binlabel">{t("multi.length")}</span>
      {isHost
        ? MATCH_LENGTHS.map((seconds) => (
            <button key={seconds} className={`btn sm${seconds === room.seconds ? " primary" : ""}`} aria-pressed={seconds === room.seconds} onClick={() => setLength(seconds)}>
              {t(`multi.lengths.s${seconds}`)}
            </button>
          ))
        : <strong>{t(`multi.lengths.s${room.seconds}`)}</strong>}
    </div>
  );
};

// How the work of a shared kitchen is split: the host picks (and their own side), the other player sees it.
const KitchenRoles = ({ room, isHost }: { room: RoomView; isHost: boolean }) => {
  const t = useTranslation();
  const { setRoles } = useMultiplayer();
  if (!isSharedKitchen(room.mode)) return null;
  const host = room.players[0]?.name ?? "";
  // A server from before roles doesn't say: everyone free.
  const roles = room.roles ?? "free";
  return (
    <div className="mp-roles">
      <span className="binlabel">{t("multi.roles")}</span>
      {isHost ? (
        <div className="row">
          {ROLES_CHOICES.map((choice) => (
            <button key={choice} className={`btn sm${choice === roles ? " primary" : ""}`} aria-pressed={choice === roles} onClick={() => setRoles(choice)}>
              {t(`multi.rolesHost.${choice}`)}
            </button>
          ))}
        </div>
      ) : (
        <strong>{t(`multi.rolesSeen.${roles}`, { host })}</strong>
      )}
    </div>
  );
};

// Leaving a match being played: asked twice, since there is no coming back into it.
const LeaveMatch = () => {
  const t = useTranslation();
  const { leave } = useMultiplayer();
  const [isAsking, setAsking] = useState(false);
  if (!isAsking) return <button className="btn ghost" onClick={() => setAsking(true)}>{t("multi.leaveMatch")}</button>;
  return (
    <div className="mp-leave-confirm" role="alertdialog">
      <p className="hint">{t("multi.leaveMatchConfirm")}</p>
      <div className="row">
        <button className="btn primary" onClick={leave}>{t("multi.leaveMatchYes")}</button>
        <button className="btn ghost" onClick={() => setAsking(false)}>{t("common.cancel")}</button>
      </div>
    </div>
  );
};

const Lobby = ({ room, goToTab }: { room: RoomView; goToTab: (tab: TabId) => void }) => {
  const t = useTranslation();
  const multiplayer = useMultiplayer();
  const { you, startAt, duo } = multiplayer;
  const [isCopied, setCopied] = useState(false);
  const isHost = room.players.find((player) => player.id === you)?.isHost ?? false;
  const canStart = room.players.length >= MIN_PLAYERS && room.players.every((player) => player.ready);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
    } catch {
      // No clipboard: the code is on screen to read out.
    }
  };

  if (room.status === "finished") {
    const everyoneDone = room.players.every((player) => player.done);
    return (
      <>
        <h3 className="h">{t("multi.results")}</h3>
        <PlayerList room={room} you={you} showScores={isOwnKitchen(room.mode)} />
        {!everyoneDone && <p className="hint">{t("multi.waitingOthers")}</p>}
        <button className="btn primary" onClick={multiplayer.leave}>{t("multi.newRoom")}</button>
      </>
    );
  }

  if (room.status === "playing" && room.mode === "duo") {
    return (
      <>
        <p className="mp-status">{`🤝 ${t("multi.duoOpen")}`}</p>
        {duo && <p className="mp-mode">{duo.name}</p>}
        <PlayerList room={room} you={you} showScores={false} />
        <button className="btn primary big" onClick={() => goToTab("service")}>{t("multi.duoGoToKitchen")}</button>
        <button className="btn ghost" onClick={multiplayer.leave}>{t(isHost ? "multi.duoClose" : "multi.duoLeave")}</button>
      </>
    );
  }

  if (room.status === "playing") {
    return (
      <>
        {startAt !== null && <Countdown startAt={startAt} />}
        <p className="mp-status">{t("multi.playing")}</p>
        <PlayerList room={room} you={you} showScores={isOwnKitchen(room.mode)} />
        <button className="btn primary" onClick={() => goToTab("service")}>{t("multi.backToService")}</button>
        <LeaveMatch />
      </>
    );
  }

  return (
    <>
      <p className="mp-mode">{`${MODE_ICONS[room.mode]} ${t(`multi.modes.${room.mode}.name`)}`}</p>
      <div className="mp-code-box">
        <span className="stat-l">{t("multi.roomCode")}</span>
        <span className="mp-code">{room.code}</span>
        <button className="btn sm" onClick={() => void copy()}>{isCopied ? t("multi.copied") : t("multi.copy")}</button>
      </div>
      <p className="hint">{t("multi.shareCode")}</p>
      <h3 className="h">{t("multi.players", { count: room.players.length, max: maxPlayersIn(room.mode) })}</h3>
      <PlayerList room={room} you={you} showScores={false} />
      <MatchLength room={room} isHost={isHost} />
      <KitchenRoles room={room} isHost={isHost} />
      {isHost ? (
        <button className="btn primary big" disabled={!canStart} onClick={multiplayer.start}>{t(`multi.modes.${room.mode}.start`)}</button>
      ) : (
        <p className="hint">{t("multi.waitHost")}</p>
      )}
      {isHost && room.players.length < MIN_PLAYERS && <p className="hint">{t("multi.errors.tooFew")}</p>}
      {isHost && room.players.length >= MIN_PLAYERS && !canStart && <p className="hint">{t("multi.errors.notReady")}</p>}
      <button className="btn ghost" onClick={multiplayer.leave}>{t("multi.leave")}</button>
    </>
  );
};

// The duo pizzerias kept on this phone, to host one of them, and a way to start a new one.
const DuoPizzerias = ({ state, nickname }: { state: ScreenProps["state"]; nickname: string }) => {
  const t = useTranslation();
  const multiplayer = useMultiplayer();
  const [duos, setDuos] = useState<DuoSave[]>(() => loadDuos());
  const [newName, setNewName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const host = (duo: DuoSave) =>
    void multiplayer.create(nickname, "duo", { info: { id: duo.id, name: duo.name, members: duo.members }, game: openDuo(duo) });
  const createNew = () =>
    void multiplayer.create(nickname, "duo", newDuo(newName.trim() || t("multi.duoNewPlaceholder"), [nickname], state.settings.language));
  const remove = (duo: DuoSave) => {
    if (confirmingDelete !== duo.id) return setConfirmingDelete(duo.id);
    deleteDuo(duo.id);
    setDuos(loadDuos());
    setConfirmingDelete(null);
  };
  return (
    <>
      <h4 className="mp-sub">{t("multi.duoList")}</h4>
      {duos.length === 0 && <p className="hint">{t("multi.duoEmpty")}</p>}
      <ul className="mp-duos">
        {duos.map((duo) => (
          <li key={duo.id} className="mp-duo">
            <div className="grow">
              <strong>{duo.name}</strong>
              <div className="hint">{t("multi.duoDetails", { day: duo.day, members: duo.members.join(" & ") })}</div>
            </div>
            <button className="btn sm primary" disabled={multiplayer.isConnecting} onClick={() => host(duo)}>{t("multi.duoHost")}</button>
            {/* Deleting takes a second tap: a pizzeria played for weeks isn't lost to a slip. */}
            <button className={`btn sm sell-btn ${confirmingDelete === duo.id ? "danger" : "ghost"}`} onClick={() => remove(duo)} onBlur={() => setConfirmingDelete(null)}>
              {t(confirmingDelete === duo.id ? "multi.duoDeleteConfirm" : "multi.duoDelete")}
            </button>
          </li>
        ))}
      </ul>
      <div className="mp-join">
        <label className="mp-field grow">
          <span className="stat-l">{t("multi.duoNewName")}</span>
          <input type="text" value={newName} maxLength={30} placeholder={t("multi.duoNewPlaceholder")} onChange={(event) => setNewName(event.target.value)} />
        </label>
        <button className="btn primary" disabled={multiplayer.isConnecting} onClick={createNew}>{t("multi.modes.duo.create")}</button>
      </div>
    </>
  );
};

const ModeCard = ({ mode, children }: { mode: RoomMode; children: ReactNode }) => {
  const t = useTranslation();
  return (
    <section className={`mp-mode-card mode-${mode}`}>
      <h3 className="mp-mode-title">
        <span aria-hidden="true">{MODE_ICONS[mode]}</span>
        <span className="grow">{t(`multi.modes.${mode}.name`)}</span>
        <span className="tag">{t(`multi.modes.${mode}.players`)}</span>
      </h3>
      <p className="hint">{t(`multi.modes.${mode}.describe`)}</p>
      {children}
    </section>
  );
};

const JoinOrCreate = ({ state, dispatch }: ScreenProps) => {
  const t = useTranslation();
  const multiplayer = useMultiplayer();
  const [code, setCode] = useState("");
  const name = state.settings.playerName;
  const nickname = name.trim() || t("multi.namePlaceholder");
  return (
    <>
      <label className="mp-field">
        <span className="stat-l">{t("multi.nameLabel")}</span>
        <input
          type="text"
          value={name}
          maxLength={16}
          placeholder={t("multi.namePlaceholder")}
          onChange={(event) => dispatch({ type: "setPlayerName", name: event.target.value })}
        />
      </label>
      <div className="mp-modes">
        <ModeCard mode="challenge">
          <button className="btn primary" disabled={multiplayer.isConnecting} onClick={() => void multiplayer.create(nickname, "challenge")}>
            {t("multi.modes.challenge.create")}
          </button>
        </ModeCard>
        <ModeCard mode="royale">
          <button className="btn primary" disabled={multiplayer.isConnecting} onClick={() => void multiplayer.create(nickname, "royale")}>
            {t("multi.modes.royale.create")}
          </button>
        </ModeCard>
        <ModeCard mode="coop">
          <button className="btn primary" disabled={multiplayer.isConnecting} onClick={() => void multiplayer.create(nickname, "coop")}>
            {t("multi.modes.coop.create")}
          </button>
        </ModeCard>
        <ModeCard mode="duo">
          <DuoPizzerias state={state} nickname={nickname} />
        </ModeCard>
      </div>
      <section className="mp-mode-card">
        <h3 className="mp-mode-title">
          <span aria-hidden="true">🔑</span>
          <span className="grow">{t("multi.joinTitle")}</span>
        </h3>
        <div className="mp-join">
          <label className="mp-field grow">
            <span className="stat-l">{t("multi.joinLabel")}</span>
            <input
              type="text"
              value={code}
              maxLength={4}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABCD"
              className="mp-code-input"
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
            />
          </label>
          <button className="btn primary" disabled={code.length !== 4 || multiplayer.isConnecting} onClick={() => multiplayer.join(code, nickname)}>
            {t("multi.join")}
          </button>
        </div>
      </section>
      {multiplayer.isConnecting && <p className="hint">{t("multi.connecting")}</p>}
    </>
  );
};

export const MultiplayerView = ({ state, dispatch, goToTab }: ScreenProps & { goToTab: (tab: TabId) => void }) => {
  const t = useTranslation();
  const multiplayer = useMultiplayer();
  return (
    <div className="card pad mp">
      <h2 className="h">{t("multi.title")}</h2>
      <p className="sub">{t("multi.intro")}</p>
      {!multiplayer.isAvailable ? (
        <p className="mp-status">{t("multi.comingSoon")}</p>
      ) : (
        <>
          {multiplayer.error && (
            <div className="mp-error" role="alert">
              <span>{t(`multi.errors.${multiplayer.error}`)}</span>
              <button className="btn sm ghost" onClick={multiplayer.clearError}>✕</button>
            </div>
          )}
          {multiplayer.room ? <Lobby room={multiplayer.room} goToTab={goToTab} /> : <JoinOrCreate state={state} dispatch={dispatch} />}
        </>
      )}
    </div>
  );
};
