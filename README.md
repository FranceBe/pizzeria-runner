# Forno Lento

A laid-back pizzeria management game: no ads, no pressure.

### 🍕 [Play it now in your browser →](https://francebe.github.io/pizzeria-runner/)

Free, in English and French, on a computer or a phone (where it can also be installed as an app and played offline).

<p align="center">
  <img src="docs/screenshots/service-desktop.png" alt="The service: orders on the left, the pizza being built in the middle, the ovens and the pass on the right, the prep line below" width="100%">
</p>

<table>
  <tr>
    <td width="25%" rowspan="2" valign="top"><img src="docs/screenshots/service-phone.png" alt="The service on a phone"></td>
    <td width="37%"><img src="docs/screenshots/prep-desktop.png" alt="The morning prep, with the day's event, a neighbourhood quest and a regular's birthday"></td>
    <td width="38%"><img src="docs/screenshots/menu-desktop.png" alt="The menu, written on a chalkboard"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/market-desktop.png" alt="The market stall on market day"></td>
    <td><img src="docs/screenshots/journal-desktop.png" alt="The journal: accounts, completed quests, regulars and the pairings book"></td>
  </tr>
</table>

## How to play

A day has three moments:

1. **Prep**: stock the fridge at the market, set the menu and its prices, then open.
2. **Service**: customers come in one by one. Build each order on the board (dough first, then the sauce, cheeses and
   toppings), bake it, then serve it from the pass.
3. **Closing**: a receipt sums up the day (sales, tips, purchases, evening charges, reputation earned).

Nobody ever leaves angry: customers just get hungrier (happy, then patient, then hungry, then starving, at 25, 50 and
90 seconds). Quick service makes tips more likely and more generous. The first day is guided step by step.

### Keyboard (desktop)

| Key | Action |
|---|---|
| `0` | Dough (gluten-free when the order asks for it) |
| `1`–`9` | The selected order's ingredients, numbered on its ticket (with help on) |
| `Space` | Bake |
| `Enter` | Serve (the selected customer's pizza first) |
| `←` `→` | Previous / next order |
| `Backspace` | Bin the pizza on the board |
| `O` | Offer the selected regular's drink (with the bar) |
| `P` or `Esc` | Pause |

## Rules

### Money

- **Sales**: each pizza is paid at its menu price, plus €1.50 for an extra topping and €1 for a delivery.
- **Tips** depend on the decor (30% of customers, +12 points per decor level), on the mood (happy customers tip more
  often and up to 30% more), on regulars, special requests, diets, offered drinks and rain. Never above 95%.
- **Perfect streak**: customers served while still happy, in a row, raise every tip: ×1.1 from 3, ×1.25 from 6, ×1.5
  from 10. A patient customer keeps the streak, a hungry one breaks it. It shows in the message line.
- **Hot pizzas**: a pizza left on the pass cools down (lukewarm after 25 seconds, cold after 50), and its tip with it.
- **Rush hour** (from level 3, on busy evenings): once in the evening, 40 seconds where customers pour in and tips double.
- **Evening charges**: €6, plus a little for each upgrade.
- **Debt**: if the till can't pay the charges, the rest goes on a tab, repaid automatically with half of the next sales.
- **Never stuck**: when nothing on the menu can be made and the till can't buy more, the game says so and offers a way
  out: borrow €30 from Nonna (once a day, on the tab), or close for today. In the morning, when the fridge and the till
  are both empty, Nonna also drops off enough for four margheritas, once a day.
- **Pause** (the ⏸ button, `P` or `Esc`) stops the clock. From the pause menu you can also close for today, or start the
  day over from this morning's prep.
- Baked pizzas nobody ordered can be binned one by one, or all at once.
- Ingredients never go bad. Pizzas still in the oven or on the pass at closing time are counted as waste.
- **The day's stars**: up to three each evening, one per goal: everyone served before getting hungry (and nobody sent
  home early), nothing binned, and a profit target that grows with the charges. Stars add up and unlock looks money
  can't buy (a starry gold awning at 15, a starry sign at 40, a starry night wall at 75).

### Reputation and levels

Every pizza served earns reputation: more for big pizzas, special requests, "the usual", birthdays, new pairings and
critics. There are **20 levels**: the first come quickly, then each takes noticeably longer from level 4 on. Each level
can unlock suppliers, upgrades and recipes, and lets the menu hold one more pizza (up to 12).

### The menu

- **Classics** join the recipe book as soon as all their ingredients are signed. **Nonna's secret recipes** come at
  levels 4, 7, 10 and 15; they are a little more appealing than the others.
- **House recipes**: create your own (up to 8 toppings, one sauce, or none for a white pizza). Appeal goes up with
  toppings, cheese and good pairings, down with clashes. **Desserts** (from level 6: chocolate spread, mascarpone,
  banana, strawberries, hazelnuts) need neither cheese nor sauce, but don't mix with meat or fish.
- **Price**: the suggested price covers the ingredients with a fair margin. Cheaper brings more orders, too expensive
  drives customers away.
- **Chef's special**: one recipe on the menu, ordered 1.5 times as often.
- **Pairings**: good pairings stay secret until you serve a pizza that has them; the recipe editor then shows them by
  name, and the journal collects them.

### Customers

- **The neighbourhood**: a name is a person, and everyone keeps their look (hair, accessories). About twenty people live
  nearby and come most of the time; everyone else passes by now and then.
- **Regulars**: someone who has ordered the same pizza three times is a regular: they often reorder it and tip more.
  Each has a profile in the journal: their favourite, one ingredient they never order, and a birthday. On their
  birthday they come for their favourite and leave a €5 gift. A regular who stays away more than 10 days is lost from
  sight, and a regular again as soon as they come back.
- **"The usual"**: a regular ordering their favourite sometimes just says "the usual". The ticket hides the recipe and
  the help is off: remember it for a bonus, or tap "Remind me…" to see it, without the bonus.
- **Back for dessert**: with a dessert pizza on the menu, a customer served happy sometimes comes back later in the
  evening for one, on top of the day's customers. Served quickly, they add €1.50.
- **Special requests** (from level 3): an extra topping, or one left out.
- **Diets** (from level 4): vegetarian, no pork, gluten-free (with the gluten-free dough, signed at the market).
- **Tables** (from level 3): two to four people come in together. Serve the whole table while they are still happy or
  patient for a bonus of €1.50 each.
- **Drinks** (with the bar): some customers add a drink to their order. The bar sits in the board's left corner: a tap
  pours that drink, and each glass costs a little. If it is the selected customer's drink, it goes straight to them and
  is paid; otherwise it lands on the tray (right corner, three glasses at most), where a tap serves it to whoever
  ordered it. Nothing but the tickets tells which drink is wanted: a glass poured for nobody waits on the tray until
  someone orders it or the tray is cleared, and its cost is lost. Someone who got their pizza first waits at the counter,
  on a blue ticket, until their drink comes. A regular's drink can also be offered (before the pizza): the glass costs,
  nothing comes in, but a much better chance of a bigger tip, and a little reputation. At bar level 3, a barman serves
  the drinks on his own, one every 6 seconds, and never gets them wrong; pouring by hand is still quicker.
- **Celebrities** (from level 5, rare, at most one a day): they order the finest pizza on the menu with an extra
  topping, and leave a €10 tip, lots of reputation, and a signed photo that goes up on the front.
- Customers come in many faces: over 120 names, hairstyles and colours (now and then blue or green), and accessories
  (glasses, hats, headphones…). Names only shape the looks; diets and everything else are drawn at random.

### Days and the neighbourhood

- **Seasons** change every 7 days: their ingredients are 25% off, and a recipe of the season is ordered more often.
- **Events**, from day 3, about one day in two: market day (20% off), rain (fewer, more generous customers), street
  party (many more customers), sunshine (more customers, many more with a terrace) and the food critic, who comes in
  once that evening: serve them quickly for a glowing review and lots of reputation.
- **Incidents**, from day 5, each with something in return: a power cut (one oven, one pizza at a time, but bigger
  tips), a late delivery (one ingredient arrives a minute into the service, with free portions), a health inspection
  (a day without binning anything earns lots of reputation) and a scooter strike (no deliveries, more people eating in).
- **Neighbourhood quests**, from day 4. **Group orders**: in the morning, someone books a big order for tonight
  (the football club wants 3 Regina and 2 Margherita…). A ticket comes in a little after opening; make the pizzas in any
  order, between customers. The faster the whole order is delivered, the better the medal and the pay (gold, silver,
  bronze); an order not finished by closing time pays half for what was delivered. Other quests last three days
  (serve so many smiling customers, discover a pairing…). No penalty when they run out. Rewards have their own line on
  the day's receipt, and completed quests are listed in the journal.
- **Weekly missions**: three goals each week (serve whole tables, reach a streak, earn tips…), €25 each from Nonna and
  €50 more for all three. They show on the morning screen.
- **Festivals** follow the real date: Halloween, Christmas and Valentine's Day each bring a festive ingredient (with
  free portions) and a recipe, for a few days.

### Upgrades

| Upgrade | What it does |
|---|---|
| Wood-fired oven | More pizzas at once, faster baking |
| Dining room | More customers, one more order at the counter |
| Decor | More tips (and string lights) |
| Kitchen assistant | Rolls out fresh dough after each bake, then fades the pans the selected order doesn't need (a little, then more) |
| Terrace | More customers, especially on sunny days |
| Delivery | Scooter orders, with an express bonus when they leave within 45 seconds |
| Bar | Drinks: lemonade and sparkling water, then chinotto and red wine, then a barman who serves them on his own |
| Second and third oven | One slow slot when built, then improving like the first oven |
| Second address | Brings in money every evening |

Once the money piles up, the pizzeria's looks can be bought too: awning colours, a neon or gold-leaf sign, wall tiles.

### The journal

Accounts (profit chart, best sellers, best day, stars, best streak, completed quests), regulars' profiles, the pairings
book, and the achievements. 34 of them can be earned by playing (one stays hidden until then); the last one keeps its
secret.

### Daily challenge

Two minutes, free ingredients, and the same customers in the same order for everyone who plays on that date, whatever
they have unlocked. Points for each pizza, more for big ones and happy customers. Nothing else is at stake. Share copies
a result to paste to friends.

### Everything else

- **Music and sound effects**: background music, the oven's sizzle while a pizza bakes, a bell for each new order and a
  till for each payment. Music and effects each have their own volume and mute button in Settings; the music softens
  during a pause. Sound starts with the first tap or click, as browsers require.
- Light or dark theme, larger text, and a shareable image of the day's receipt (Settings, receipt).
- The game installs as an app and plays offline.
- Have you tried every combination of keys (or of swipes)? Nonna has. And she doesn't share her secrets with just anyone: perhaps
  with someone who has served every one of hers. Mamma keeps something in a jar too, for those whose books balance day
  after day. Once shared, a secret is made at the market and goes on a pizza from the prep line (or with `S` and `M`).

## Running locally

Requires Node 18 or later (`nvm use` picks up the version from `.nvmrc`).

```bash
npm install
npm run dev
```

Then open the address shown in the terminal (http://localhost:5173).

To try it on your phone, run `npm run dev:phone` instead: Vite also prints a network address (http://192.168.x.x:5173)
to open on the phone, on the same Wi-Fi. The development server is then reachable by everyone on that network,
so stop it once you're done (the deployed game doesn't have this concern).

## Building a static version

```bash
npm run build
```

The `dist/` folder can be hosted anywhere (Netlify, GitHub Pages, Vercel…).

## Tests and checks

```bash
npm test            # run the tests once
npm run test:watch  # re-run on every change
npm run typecheck   # TypeScript, strict mode
npm run lint        # ESLint (npm run lint:fix to auto-fix)
npm run check       # types + lint + tests + build, like the CI
```

- **Pre-commit hook** (husky, installed by `npm install`): lints the staged files with auto-fix, type-checks, then runs the tests.
  A failure blocks the commit; `git commit --no-verify` skips it in an emergency.
- **CI** (`.github/workflows/ci.yml`): types, lint, tests and build on every push and pull request to `main`.
- **Deployment** (`.github/workflows/deploy.yml`): every push to `main` that passes the same checks goes live on GitHub Pages.

## Where things live

```
src/
  data/         game data, no logic
  game/         game rules, no React (tested); types.ts describes the state and every action
    actions/    what each player action does
  components/   reusable drawings (pizza, ingredients, faces)
  views/        screens
  hooks/        game clock, autosave
  i18n/         every piece of text, in French (fr.ts) and English (en.ts)
  utils/        formatting, maths, randomness, save codes
```

- `data/ingredients.ts`: `INGREDIENTS` (price, required level, supplier fee, drawing) and `PREP_STATIONS` (order of the pans on the prep line)
- `data/recipes.ts`: `CLASSIC_RECIPES`, plus `GOOD_PAIRINGS` / `BAD_PAIRINGS` that affect recipe appeal
- `data/progression.ts`: `REPUTATION_THRESHOLDS` (XP per level), `UPGRADES`, `OVEN_SLOTS`, `BAKE_SECONDS`
- `game/pizza.ts`: `fairPrice`, `appealOf`, `priceAttractiveness`
- `game/economy.ts`: `forecastCustomers`, `dailyCharges`, debt handling
- `game/customers.ts`: what customers order, special requests, critics, deliveries, "the usual"
- `game/actions/serviceActions.ts` + `game/serving.ts`: the service, and what happens when an order is served (payment, tips, bonuses, reputation)
- `data/events.ts` + `game/events.ts`: daily events and market prices
- `data/seasons.ts` + `game/seasons.ts`: seasons, in-season ingredients and recipes
- `data/drinks.ts`, `data/quests.ts`, `data/cosmetics.ts`: the bar, neighbourhood quests, the pizzeria's looks
- `game/challenge.ts`: the daily challenge, seeded by the date
- `game/diets.ts`, `game/quests.ts`, `game/regulars.ts`: diets, quests, regulars' profiles and birthdays
- `game/batch.ts` + `game/evening.ts`: group orders, rush hour and late deliveries over an evening
- `game/streak.ts`, `game/stars.ts`, `game/weekly.ts`, `game/calendar.ts`: streaks and cooling pizzas, the day's stars,
  weekly missions, calendar festivals
- `game/simulation.test.ts`: a robot plays many full days with everything on, to catch what only shows when it all mixes
- `data/customers.ts` + `game/looks.ts`: names, hair, hairstyles and accessories
- `assets/sounds/`: the music and sound effects; `audio/engine.ts` plays them (Web Audio, seamless loops, live fades),
  `audio/cues.ts` decides what plays when. The music comes as Ogg and as AAC (`music.m4a`, for older iPhones); after
  replacing `music.ogg`, rebuild the AAC copy with `afconvert music.ogg -o music.m4a -f m4af -d aac -b 128000` (macOS)
- `data/achievements.ts` + `game/achievements.ts`: achievements and their progress
- `game/pairings.ts`: pairing discovery

Ids (`pate`, `margherita`, `salle`…) are stored in save files: don't rename them.

## Languages

The game is in French and English. It starts in the browser's language and can be switched in Settings.

All text lives in `src/i18n/fr.ts` and `src/i18n/en.ts`. French is the reference: its keys, `{placeholders}` and
function signatures define the types, so a misspelt key, a missing param or an English entry out of shape fails to compile.
Components get a translator with `const t = useTranslation()`, then call `t("prep.title", { day: 3 })`.
Entries are either strings with `{placeholders}` or functions, for plurals and amounts of money.

Game logic never produces text: it stores translation keys (for example, toasts are `{ key, params }`),
so everything follows a language change immediately.

## Offline and install

`public/sw.js` is a service worker, registered in built versions only. The build (`vite.config.ts`) writes a build id
and the list of built files into it, so each deployment caches its own files and drops the previous ones.
The manifest and icons are in `public/`; `icon.svg` is the source of the PNG icons.

## Saves

The game is stored in the browser's `localStorage`, which is specific to each address.
To continue a game started elsewhere: Settings > Generate code, then paste it under Load a code on the other device.

If the game ever fails to render (say, a damaged save loaded from a code), a recovery screen offers to start over;
the broken save is kept aside in `localStorage` under `forno-lento-broken-save`.

If you change the shape of the saved state, bump `SAVE_VERSION` in `game/state.ts` and add the conversion
to `migrateSave`, so existing games still load.

## Privacy and security

- Nothing about the player leaves the browser: the game and its saves live in `localStorage`, and save codes are only
  copied and pasted by hand.
- Visits are counted with Cloudflare Web Analytics (the script at the end of `index.html`): no cookies, no personal
  data, no tracking across sites.
- Built versions carry a Content-Security-Policy (see `vite.config.ts`): the page may only load its own files, Google
  Fonts and the analytics script, and only send data to itself and Cloudflare's analytics. It is added at build time,
  since the dev server needs an inline script for hot reload. A new third-party resource has to be added there too.
- The page never inserts HTML from strings: everything shown, the pizzeria's name included, goes through React.
