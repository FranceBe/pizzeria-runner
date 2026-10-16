# Forno Lento

A laid-back pizzeria management game: no ads, no pressure.

## Running locally

Requires Node 18 or later (`nvm use` picks up the version from `.nvmrc`).

```bash
npm install
npm run dev
```

Then open the address shown in the terminal (http://localhost:5173). Thanks to `--host`, Vite also prints a network
address (http://192.168.x.x:5173) you can open on your phone if it is on the same Wi-Fi.

## Building a static version

```bash
npm run build
```

The `dist/` folder can be hosted anywhere (Netlify, GitHub Pages, Vercel…).

## Tests

```bash
npm test            # run once
npm run test:watch  # re-run on every change
```

## Where things live

```
src/
  data/         game data, no logic
  game/         game rules, no React (tested)
    actions/    what each player action does
  components/   reusable drawings (pizza, ingredients, faces)
  views/        screens
  hooks/        game clock, autosave
  i18n/         every piece of text, in French (fr.js) and English (en.js)
  utils/        formatting, maths, randomness, save codes
```

- `data/ingredients.js`: `INGREDIENTS` (price, required level, supplier fee, drawing) and `PREP_STATIONS` (order of the pans on the prep line)
- `data/recipes.js`: `CLASSIC_RECIPES`, plus `GOOD_PAIRINGS` / `BAD_PAIRINGS` that affect recipe appeal
- `data/progression.js`: `REPUTATION_THRESHOLDS` (XP per level), `UPGRADES`, `OVEN_SLOTS`, `BAKE_SECONDS`
- `game/pizza.js`: `fairPrice`, `appealOf`, `priceAttractiveness`
- `game/economy.js`: `forecastCustomers`, `dailyCharges`, debt handling
- `game/customers.js`: what customers order, special requests

Ids (`pate`, `margherita`, `salle`…) are stored in save files: don't rename them.

## Languages

The game is in French and English. It starts in the browser's language and can be switched in Settings.

All text lives in `src/i18n/fr.js` and `src/i18n/en.js`, which must have exactly the same keys (a test checks this).
Components get a translator with `const t = useTranslation()`, then call `t("prep.title", { day: 3 })`.
Entries are either strings with `{placeholders}` or functions, for plurals and amounts of money.

Game logic never produces text: it stores translation keys (for example, toasts are `{ key, params }`),
so everything follows a language change immediately.

## Saves

The game is stored in the browser's `localStorage`, which is specific to each address.
To continue a game started elsewhere: Settings > Generate code, then paste it under Load a code on the other device.

If you change the shape of the saved state, bump `SAVE_VERSION` in `game/state.js` and add the conversion
to `migrateSave`, so existing games still load.
