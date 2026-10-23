// Postcards: one for each rare moment, the first time it happens. The ids are stored in save files: never rename
// them. Titles, captions and hints live in src/i18n (postcards.<id>).
export const POSTCARD_IDS = [
  "rush", "streetParty", "powerCut", "perfectDay", "critic", "celebrity", "matchNight", "wedding", "mysteryFive",
  "competitorGone", "storySweethearts", "storyStudent", "storyOldChef", "halloween", "christmas", "valentine",
] as const;
export type PostcardId = (typeof POSTCARD_IDS)[number];

// The picture on the front: a few emojis on a coloured sky.
export interface PostcardLook {
  scene: string;
  sky: string;
}

export const POSTCARDS: Record<PostcardId, PostcardLook> = {
  rush: { scene: "🔥🍕🏃", sky: "#f6b27a" },
  streetParty: { scene: "🎉🏮🎶", sky: "#f2a7c8" },
  powerCut: { scene: "🕯️🍕🌙", sky: "#6c6f9c" },
  perfectDay: { scene: "⭐⭐⭐", sky: "#f3d36b" },
  critic: { scene: "🧐📝🍕", sky: "#b9c8e8" },
  celebrity: { scene: "📸✨🕶️", sky: "#d4b8f0" },
  matchNight: { scene: "📺⚽🍕", sky: "#8fcf9c" },
  wedding: { scene: "💍🥂🍕", sky: "#f7e1b0" },
  mysteryFive: { scene: "🕵️⭐🍕", sky: "#a99ad8" },
  competitorGone: { scene: "🏪💨🏆", sky: "#a8c5d8" },
  storySweethearts: { scene: "💕🍕👶", sky: "#f6b8c4" },
  storyStudent: { scene: "📚🎓🍕", sky: "#a7d7c5" },
  storyOldChef: { scene: "👨‍🍳🍕🎁", sky: "#e2c29a" },
  halloween: { scene: "🎃🦇🍕", sky: "#f0a050" },
  christmas: { scene: "🎄❄️🍕", sky: "#9cc8a6" },
  valentine: { scene: "💝🌹🍕", sky: "#f2a6b6" },
};
