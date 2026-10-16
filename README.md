# Forno Lento

A laid-back pizzeria management game: no ads, no pressure.

## How to play

Each day: stock the fridge and set the menu, open, then build, bake and serve each order.
Nobody ever leaves angry, but quick service earns bigger tips. Customers who come back become regulars:
they keep their look, often reorder their favourite pizza and tip a little more. The first day is guided.

Keyboard shortcuts during service (desktop):

| Key | Action |
|---|---|
| `0` | Dough |
| `1`–`9` | The selected order's ingredients, numbered on its ticket (with help on) |
| `Space` | Bake |
| `Enter` | Serve |
| `←` `→` | Previous / next order |
| `Backspace` | Bin the pizza on the board |
| `A` | Kitchen assistant builds the order (once upgraded) |

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

## Tests and checks

```bash
npm test            # run the tests once
npm run test:watch  # re-run on every change
npm run lint        # ESLint (npm run lint:fix to auto-fix)
npm run check       # lint + tests + build, like the CI
```

- **Pre-commit hook** (husky, installed by `npm install`): lints the staged files with auto-fix, then runs the tests.
  A failure blocks the commit; `git commit --no-verify` skips it in an emergency.
- **CI** (`.github/workflows/ci.yml`): lint, tests and build on every push and pull request to `main`.
- **Deployment** (`.github/workflows/deploy.yml`): every push to `main` that passes the same checks goes live on GitHub Pages.

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
