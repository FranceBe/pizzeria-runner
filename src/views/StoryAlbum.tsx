import { useEffect, useState } from "react";
import { STORIES, STORY_SCENES, type StoryId } from "../data/stories";
import { Pager, usePages } from "../components/Pager";
import { CustomerFace } from "../components/CustomerFace";
import { isStoryOver, storiesOf } from "../game/stories";
import type { CustomerBookEntry, GameState } from "../game/types";
import { useTranslation } from "../i18n/I18nContext";

type StoryProgress = NonNullable<CustomerBookEntry["story"]>;
type ChapterIndex = 0 | 1 | 2 | 3;

// What happened so far, told in the past: a line per chapter lived (for the morning's list).
export const StoryPreviously = ({ story }: { story: StoryProgress }) => {
  const t = useTranslation();
  const lived = Math.min(story.chapter, STORIES[story.id].length);
  if (!lived) return null;
  return (
    <div className="story-previously">
      <span className="hint">{t("prep.storyPreviously")}</span>
      <ol>
        {Array.from({ length: lived }, (_, index) => (
          <li key={index}>{t(`stories.${story.id}.told.${index as ChapterIndex}`)}</li>
        ))}
      </ol>
    </div>
  );
};

// One chapter as a photo: lived (its scene, what happened, what they said, the day), the next one (to be continued,
// tonight if it is due), or one still to come.
const ChapterPhoto = ({ id, index, story, today }: { id: StoryId; index: number; story: StoryProgress; today: number }) => {
  const t = useTranslation();
  const chapter = index as ChapterIndex;
  if (index < story.chapter) {
    const day = story.days?.[index];
    return (
      <li className="story-photo">
        <div className="story-photo-scene" aria-hidden="true">{STORY_SCENES[id][index]}</div>
        <p className="story-photo-caption">{t(`stories.${id}.told.${chapter}`)}</p>
        <p className="story-photo-quote">{t(`stories.${id}.lines.${chapter}`)}</p>
        {day !== undefined && <span className="story-photo-day">{t("journal.albumDay", { day })}</span>}
      </li>
    );
  }
  if (index === story.chapter) {
    return (
      <li className="story-photo next">
        <div className="story-photo-scene" aria-hidden="true">?</div>
        <p className="story-photo-caption">{story.dueDay <= today ? t("journal.albumTonight") : t("journal.albumNext")}</p>
      </li>
    );
  }
  return <li className="story-photo blank" aria-hidden="true" />;
};

// A regular's story as an album page: who, what it is about, and its photos so far.
const StoryPage = ({ name, entry, today }: { name: string; entry: CustomerBookEntry; today: number }) => {
  const t = useTranslation();
  const story = entry.story;
  if (!story) return null;
  const total = STORIES[story.id].length;
  return (
    <section className="story-page" aria-label={`${name} · ${t.storyTitle(story.id)}`}>
      <header className="story-page-head">
        <CustomerFace customer={entry} mood={0} />
        <div className="grow">
          <strong>{t.storyTitle(story.id)}</strong>
          <div className="hint">{`${name} · ${isStoryOver(story) ? t("journal.albumDone") : `${Math.min(story.chapter, total)}/${total}`}`}</div>
        </div>
      </header>
      <p className="story-page-intro">{t(`stories.${story.id}.intro`, { name })}</p>
      <ol className="story-photos">
        {Array.from({ length: total }, (_, index) => (
          <ChapterPhoto key={index} id={story.id} index={index} story={story} today={today} />
        ))}
      </ol>
    </section>
  );
};

// The story to open the album on next time (from the morning's list): read when the album opens, then forgotten.
const OPEN_ON_KEY = "forno-lento-album-story";
export const openAlbumOn = (name: string): void => {
  try {
    sessionStorage.setItem(OPEN_ON_KEY, name);
  } catch {
    // Not remembered: the album opens on its first page.
  }
};
const readOpenOn = (): string | null => {
  try {
    return sessionStorage.getItem(OPEN_ON_KEY);
  } catch {
    return null;
  }
};
const forgetOpenOn = (): void => {
  try {
    sessionStorage.removeItem(OPEN_ON_KEY);
  } catch {
    // Nothing was kept.
  }
};

// Every regular's story, in the journal, a story a page: those going on first (the next chapter soonest), then those
// told to the end.
export const StoryAlbum = ({ state }: { state: GameState }) => {
  const t = useTranslation();
  const stories = storiesOf(state).sort(([, a], [, b]) => {
    const over = Number(isStoryOver(a.story!)) - Number(isStoryOver(b.story!));
    return over || a.story!.dueDay - b.story!.dueDay;
  });
  // Read on opening (an initializer may run twice), forgotten once the album is on screen.
  const [openOn] = useState(readOpenOn);
  useEffect(forgetOpenOn, []);
  const { shown, ...pages } = usePages(stories, 1, { inOrder: true, startAt: stories.findIndex(([name]) => name === openOn) });
  return (
    <div className="card pad journal-card j-regulars j-album">
      <h2 className="h">{`📖 ${t("journal.album")}`}</h2>
      <p className="hint">{stories.length ? t("journal.albumIntro") : t("journal.albumEmpty")}</p>
      {/* At the top: turning the pages needn't scroll past a whole story first. */}
      <Pager {...pages} />
      {shown.map(([name, entry]) => (
        <StoryPage key={name} name={name} entry={entry} today={state.day} />
      ))}
    </div>
  );
};
