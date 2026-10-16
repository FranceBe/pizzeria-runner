# Forno Lento

Jeu de gestion de pizzeria, sans pub ni pression.

## Lancer en local

Il faut Node 18 ou plus récent (`nvm use` lit le fichier `.nvmrc`).

```bash
npm install
npm run dev
```

Puis ouvre l'adresse affichée (http://localhost:5173). Grâce à `--host`, Vite affiche aussi une adresse réseau
(http://192.168.x.x:5173) que tu peux ouvrir sur ton téléphone s'il est sur le même wifi.

## Construire une version statique

```bash
npm run build
```

Le dossier `dist/` peut être hébergé n'importe où (Netlify, GitHub Pages, Vercel…).

## Tests

```bash
npm test            # une fois
npm run test:watch  # relance à chaque modification
```

## Où toucher à quoi

```
src/
  data/         les données du jeu, sans logique
  game/         les règles du jeu, sans React (testées)
    actions/    ce que fait chaque action du joueur
  components/   les dessins réutilisables (pizza, ingrédients, visages)
  views/        les écrans
  hooks/        horloge du jeu, sauvegarde automatique
  utils/        formatage, maths, hasard, codes de sauvegarde
```

- `data/ingredients.js` : `INGREDIENTS` (prix, niveau requis, coût du fournisseur, dessin) et `PREP_STATIONS` (ordre des bacs sur la ligne de préparation)
- `data/recipes.js` : `CLASSIC_RECIPES`, et `GOOD_PAIRINGS` / `BAD_PAIRINGS` pour l'attrait des recettes
- `data/progression.js` : `REPUTATION_THRESHOLDS` (seuils par niveau), `UPGRADES`, `OVEN_SLOTS`, `BAKE_SECONDS`
- `game/pizza.js` : `fairPrice`, `appealOf`, `priceAttractiveness`
- `game/economy.js` : `forecastCustomers`, `dailyCharges`, l'ardoise
- `game/customers.js` : ce que commandent les clients, les demandes spéciales

Les identifiants (`pate`, `margherita`, `salle`…) sont enregistrés dans les sauvegardes : ne les renomme pas.

## Sauvegarde

La partie est stockée dans le `localStorage` du navigateur, propre à chaque adresse.
Pour reprendre une partie commencée ailleurs : Réglages > Générer le code, puis Charger un code ici.

Si tu changes la forme de l'état sauvegardé, augmente `SAVE_VERSION` dans `game/state.js` et ajoute la conversion
dans `migrateSave`, pour que les parties en cours se chargent toujours.
