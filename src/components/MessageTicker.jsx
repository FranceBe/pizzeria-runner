import { useTranslation } from "../i18n/I18nContext.jsx";

// A single slim line showing the newest message; tapping it dismisses it.
// With no message, shows `idleText` if given (the service progress), or nothing.
export function MessageTicker({ toasts, dispatch, idleText }) {
  const t = useTranslation();
  const newest = toasts[toasts.length - 1];
  if (!newest) return idleText ? <div className="ticker">{idleText}</div> : null;
  return (
    <button
      className={`ticker ${newest.kind || "msg"}`}
      aria-label={t("common.dismissMessage")}
      onClick={() => dispatch({ type: "dismissToast", toastId: newest.id })}
    >
      <span className="ticker-t" role="status">{t(`toasts.${newest.key}`, newest.params)}</span>
      <span className="ticker-x" aria-hidden="true">×</span>
    </button>
  );
}
