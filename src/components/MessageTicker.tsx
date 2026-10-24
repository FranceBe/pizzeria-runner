import { useCallback, useRef, useState } from "react";
import type { Dispatch, Toast } from "../game/types";
import { translateMessage } from "../i18n";
import { useTranslation } from "../i18n/I18nContext";
import { onTap } from "./tap";
import { useDismiss } from "./useDismiss";

interface MessageTickerProps {
  toasts: readonly Toast[];
  dispatch: Dispatch;
  idleText?: string;
  /** The evening's messages: given, tapping the line shows them all, in full (a phone cuts long ones short). */
  log?: readonly Toast[];
}

// A single slim line showing the newest message; its × dismisses it. With no message, shows `idleText` if given (the
// service progress), or nothing. With the evening's log, tapping the line opens the latest messages, newest first.
export const MessageTicker = ({ toasts, dispatch, idleText, log }: MessageTickerProps) => {
  const t = useTranslation();
  const [isReading, setReading] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setReading(false), []);
  useDismiss(panel, isReading, close);
  const newest = toasts[toasts.length - 1];
  const canRead = Boolean(log?.length);
  const dismiss = () => newest && dispatch({ type: "dismissToast", toastId: newest.id });

  let line;
  if (!newest) {
    if (!idleText) return null;
    line = canRead ? (
      <button className="ticker" aria-label={t("service.logOpen")} aria-expanded={isReading} {...onTap(() => setReading(!isReading))}>
        <span className="ticker-t">{idleText}</span>
        <span className="ticker-log-ic" aria-hidden="true">🕘</span>
      </button>
    ) : (
      <div className="ticker">{idleText}</div>
    );
  } else if (!canRead) {
    line = (
      <button className={`ticker ${newest.kind || "msg"}`} aria-label={t("common.dismissMessage")} {...onTap(dismiss)}>
        <span className="ticker-t" role="status">{translateMessage(t, "toasts", newest)}</span>
        <span className="ticker-x" aria-hidden="true">×</span>
      </button>
    );
  } else {
    line = (
      <div className={`ticker ${newest.kind || "msg"}`}>
        <button className="ticker-t ticker-read" aria-label={t("service.logOpen")} aria-expanded={isReading} {...onTap(() => setReading(!isReading))}>
          <span role="status">{translateMessage(t, "toasts", newest)}</span>
        </button>
        <button className="ticker-x" aria-label={t("common.dismissMessage")} {...onTap(dismiss)}>×</button>
      </div>
    );
  }
  return (
    <div className="ticker-box" ref={panel}>
      {line}
      {isReading && log && (
        <div className="message-log" role="log" aria-label={t("service.log")}>
          <strong>{t("service.log")}</strong>
          <ol>
            {[...log].reverse().map((message) => (
              <li key={message.id} className={message.kind || "msg"}>{translateMessage(t, "toasts", message)}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};
