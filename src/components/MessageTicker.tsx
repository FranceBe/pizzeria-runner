import type { Dispatch, Toast } from "../game/types";
import { translateMessage } from "../i18n";
import { useTranslation } from "../i18n/I18nContext";

interface MessageTickerProps {
  toasts: readonly Toast[];
  dispatch: Dispatch;
  idleText?: string;
}

// A single slim line showing the newest message; tapping it dismisses it.
// With no message, shows `idleText` if given (the service progress), or nothing.
export const MessageTicker = ({ toasts, dispatch, idleText }: MessageTickerProps) => {
  const t = useTranslation();
  const newest = toasts[toasts.length - 1];
  if (!newest) return idleText ? <div className="ticker">{idleText}</div> : null;
  return (
    <button
      className={`ticker ${newest.kind || "msg"}`}
      aria-label={t("common.dismissMessage")}
      onClick={() => dispatch({ type: "dismissToast", toastId: newest.id })}
    >
      <span className="ticker-t" role="status">{translateMessage(t, "toasts", newest)}</span>
      <span className="ticker-x" aria-hidden="true">×</span>
    </button>
  );
};
