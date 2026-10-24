import { useState } from "react";
import { useTranslation } from "../i18n/I18nContext";

// Turns the pages of a list, a few items at a time; renders nothing when everything fits on one page. Newest first by
// default (lists kept latest last); `inOrder` keeps the list's own order. `startAt`: the item to open on.
export const usePages = <T,>(items: readonly T[], perPage: number, { inOrder = false, startAt = -1 }: { inOrder?: boolean; startAt?: number } = {}) => {
  const [page, setPage] = useState(() => (startAt >= 0 ? Math.floor(startAt / perPage) : 0));
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  // A list that got shorter (another save loaded) never leaves the page past its end.
  const current = Math.min(page, pageCount - 1);
  const ordered = inOrder ? items : [...items].reverse();
  const shown = ordered.slice(current * perPage, (current + 1) * perPage);
  return { shown, page: current, pageCount, setPage };
};

export const Pager = ({ page, pageCount, setPage }: { page: number; pageCount: number; setPage: (page: number) => void }) => {
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
