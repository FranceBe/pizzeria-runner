import type { AchievementId } from "../data/achievements";
import type { DayEventId } from "../data/events";
import type { IngredientId, IngredientKind, StationId } from "../data/ingredients";
import {
  OVEN_SLOTS, BAKE_SECONDS, TERRACE_CUSTOMERS, TERRACE_SUNNY_CUSTOMERS, tipChanceForDecor, type UpgradeKey,
} from "../data/progression";
import type { ClassicRecipeId, Pairing } from "../data/recipes";
import { plural } from "../utils/format";
import type { TranslationHelpers as H } from "./types";

const lower = (text: string): string => text.toLowerCase();

// The reference dictionary: its keys, literal strings and function signatures type every translation (see types.ts).
export const fr = {
  tabs: { service: "Service", market: "Marché", menu: "Carte", upgrades: "Améliorations", journal: "Carnet", settings: "Réglages" },

  common: {
    new: "nouveau",
    trash: "Jeter",
    cancel: "Annuler",
    level: "Niveau {level}",
    improvisedPizza: "Pizza improvisée",
    dismissMessage: "Fermer le message",
  },

  header: {
    day: "Jour",
    till: "Caisse",
    debt: ({ amount }: { amount: number }, t: H) => `Ardoise : ${t.money(amount)}`,
    reputation: "Réputation · niv. {level}",
    xpTitle: "{xp} / {next} points",
  },

  prep: {
    title: "Jour {day} · mise en place",
    intro: "Remplis le frigo, ajuste la carte, puis ouvre quand tu es prête. Personne ne part fâché : prends ton temps.",
    expectedCustomers: "clients attendus",
    pizzasOnMenu: "Pizzas à la carte",
    eveningCharges: "Charges du soir",
    currentDebt: "Ardoise en cours",
    lowStock: "Stock bas",
    stockLine: ({ id, quantity }: { id: IngredientId; quantity: number }, t: H) => `${t.ingredient(id)} : ${quantity}`,
    goToMarket: "Aller au marché",
    nonnaOffer: "Le frigo est vide et la caisse aussi. Nonna peut te dépanner une fois aujourd'hui.",
    callNonna: "Appeler Nonna",
    open: "Ouvrir la pizzeria",
    tonightsMenu: "Ce soir à la carte",
    emptyMenu: "Aucune pizza. Passe par l'onglet Carte.",
    regulars: "Tes habitués",
    regularLine: ({ recipe, visits }: { recipe: string; visits: number }) => `${recipe} · ${visits} visites`,
    today: "Aujourd'hui",
    chefSpecial: "Suggestion du chef",
    challengeTitle: "Défi chrono",
    challengeIntro: ({ seconds }: { seconds: number }) =>
      `${seconds / 60} minutes pour servir un maximum de pizzas. Ingrédients offerts, et ni argent ni réputation en jeu : juste pour le plaisir.`,
    challengeBest: "Ton record : {score} points",
    startChallenge: "Lancer le défi",
  },

  challenge: {
    dialog: "Fin du défi",
    title: "Temps écoulé !",
    points: "points",
    served: ({ count }: { count: number }) => `${count} ${plural(count, "pizza servie", "pizzas servies")}`,
    newBest: "Nouveau record !",
    best: "Record : {score} points",
    close: "Retour en cuisine",
  },

  service: {
    title: "Service du jour {day}",
    progress: ({ served, remaining }: { served: number; remaining: number }) =>
      `${served} ${plural(served, "servi")} · ${remaining} encore à servir`,
    orders: "Commandes",
    doorOpening: "La porte va s'ouvrir…",
    workBoard: "Plan de travail",
    emptyBoard: "Touche « Pâte » pour étaler une nouvelle pizza",
    readyFor: "Prête pour {name}",
    boardCheck: ({ name, missing, extra }: { name: string; missing: number; extra: number }) => {
      const parts: string[] = [];
      if (missing) parts.push(`${missing} ${plural(missing, "manquant")}`);
      if (extra) parts.push(`${extra} en trop`);
      return `Pour ${name} : ${parts.join(" · ")}`;
    },
    commisAssemble: "Commis : monter la {recipe}",
    bake: "Enfourner",
    ovenFull: "Four plein",
    ovenAndPass: "Four et passe",
    oven: "Four",
    freeSlot: "Libre",
    pass: "Passe",
    passEmpty: "Les pizzas cuites arrivent ici.",
    forCustomer: "Pour {name}",
    nobodyWaiting: "Personne ne l'attend",
    serve: "Servir",
    prepLine: "Ligne de préparation",
    panTitle: ({ id, quantity }: { id: IngredientId; quantity: number }, t: H) => `${t.ingredient(id)} · ${quantity} en stock`,
    extra: ({ id }: { id: IngredientId }, t: H) => `+ ${t.ingredient(id)}`,
    without: ({ id }: { id: IngredientId }, t: H) => `sans ${lower(t.ingredient(id))}`,
    visit: ({ number }: { number: number }) => `${number}ᵉ visite`,
    regular: "Habitué",
    shortcuts: "Clavier : 0 pâte · 1-9 ingrédients du ticket · Espace enfourner · Entrée servir · ← → changer de ticket",
    asUsual: "« Comme d'habitude ! »",
    asUsualCheck: "Pour {name} : comme d'habitude, tu te souviens ?",
    revealUsual: "Rappelle-moi…",
    revealUsualTitle: "Afficher la recette (sans le bonus d'habitué)",
    critic: "Critique",
    criticTitle: "Critique gastronomique : sers-la vite !",
    delivery: "Livraison",
    express: ({ seconds }: { seconds: number }) => `Express : ${seconds} s`,
    challenge: "Défi chrono · {clock} · {score} points",
  },

  market: {
    fridgeIntro: "Les ingrédients ne s'abîment pas. Achète au rythme de ta caisse.",
    restockMenu: ({ target, cost }: { target: number; cost: number }, t: H) => `Compléter la carte à ${target} · ${t.money(cost)}`,
    restockMore: ({ target, cost }: { target: number; cost: number }, t: H) => `à ${target} · ${t.money(cost)}`,
    perPortion: ({ price }: { price: number }, t: H) => `${t.money(price)} la portion`,
    usefulFor: ({ recipes }: { recipes: string }) => ` · utile pour ${recipes}`,
    suppliers: "Fournisseurs",
    suppliersIntro: "Chaque nouveau fournisseur ajoute un ingrédient, peut débloquer une recette classique et t'offre {portions} portions.",
    allSuppliers: "Tu travailles avec tous les fournisseurs de la région.",
    sign: ({ fee }: { fee: number }, t: H) => `Signer · ${t.money(fee)}`,
    marketDay: "Jour de marché : tout est à −20 % aujourd'hui.",
    stall: "L'étal",
  },

  menu: {
    title: "La carte",
    capacity: "{count} / {capacity} pizzas proposées. La carte s'agrandit à chaque niveau.",
    createRecipe: "Créer une recette",
    homemade: "maison",
    costAndAdvice: ({ cost, fair }: { cost: number; fair: number }, t: H) => `coût ${t.money(cost)} · conseillé ${t.money(fair)}`,
    lowerPriceOf: "Baisser le prix de {name}",
    raisePriceOf: "Monter le prix de {name}",
    onMenu: "À la carte",
    delete: "Supprimer",
    confirmDelete: "Supprimer…",
    keep: "Garder",
    toDiscover: "Classiques à découvrir",
    missing: ({ items }: { items: string }) => `Il manque : ${items}`,
    missingItem: ({ id, level }: { id: IngredientId; level: number }, t: H) => `${t.ingredient(id)} (niv. ${level})`,
    chefSpecial: "Suggestion du chef",
    makeSpecial: "Mettre en suggestion",
    specialHint: "La suggestion du chef est commandée plus souvent.",
  },

  editor: {
    title: "Nouvelle recette",
    close: "Fermer",
    name: "Nom",
    namePlaceholder: "La Fellows, la Belsize…",
    appeal: "attrait",
    goodPairing: ({ a, b }: { a: IngredientId; b: IngredientId }, t: H) =>
      `Bon accord : ${lower(t.ingredient(a))} et ${lower(t.ingredient(b))}`,
    badPairing: ({ a, b }: { a: IngredientId; b: IngredientId }, t: H) =>
      `Drôle de mariage : ${lower(t.ingredient(a))} et ${lower(t.ingredient(b))}`,
    ingredientCost: "Coût des ingrédients",
    suggestedPrice: "Prix conseillé",
    price: "Prix",
    lowerPrice: "Baisser le prix",
    raisePrice: "Monter le prix",
    sauceHint: " (une seule, ou aucune pour une pizza blanche)",
    secretPairing: "Un accord secret se cache dans cette recette… Sers-la pour le découvrir.",
    tooManyFillings: "{max} garnitures maximum : la pâte ne tiendrait pas.",
    save: "Ajouter au carnet",
    priceNote: {
      gentle: "Prix doux : plus de commandes, moins de marge.",
      fair: "Prix juste.",
      high: "Un peu cher : moins de clients la choisiront.",
      tooHigh: "Trop cher : elle se vendra mal.",
    },
    errors: {
      missingName: "Donne-lui un nom.",
      noTopping: "Ajoute au moins un ingrédient sur la pâte.",
      duplicateIngredients: "Cette combinaison existe déjà dans ton carnet.",
      duplicateName: "Une pizza porte déjà ce nom.",
    },
  },

  stars: "{count} étoiles sur 5",

  pops: {
    money: ({ amount }: { amount: number }, t: H) => `+${t.money(amount)}`,
    tip: ({ amount }: { amount: number }, t: H) => `+${t.money(amount)} pourboire`,
    express: ({ amount }: { amount: number }, t: H) => `+${t.money(amount)} express`,
  },

  upgrades: {
    title: "Améliorations",
    intro: ({ charges }: { charges: number }, t: H) =>
      `Chaque amélioration augmente un peu les charges du soir (actuellement ${t.money(charges)}).`,
    current: "Actuel :",
    next: "Ensuite :",
    extraCharges: ({ amount }: { amount: number }, t: H) => `(+${t.money(amount)} de charges)`,
    maxed: "Au maximum",
    levelRequired: "Niveau {level} requis",
    buy: ({ cost }: { cost: number }, t: H) => `Améliorer · ${t.money(cost)}`,
    oven: {
      name: "Four à bois",
      describe: ({ level }: { level: number }, t: H) =>
        `${OVEN_SLOTS[level]} ${plural(OVEN_SLOTS[level], "pizza")} à la fois · cuisson ${t.number(BAKE_SECONDS[level])} s`,
    },
    salle: {
      name: "Salle",
      describe: ({ level }: { level: number }) => (level === 0 ? "Quelques tables" : `+${2 * level} clients par jour`),
    },
    deco: {
      name: "Décoration",
      describe: ({ level }: { level: number }) => `Pourboire chez ${Math.round(tipChanceForDecor(level) * 100)} % des clients`,
    },
    commis: {
      name: "Commis",
      describe: ({ level }: { level: number }) =>
        ["Tu es seule en cuisine", "Étale la pâte tout seul après chaque enfournage", "Monte la pizza du ticket choisi en un clic"][level],
    },
    terrasse: {
      name: "Terrasse",
      describe: ({ level }: { level: number }) =>
        level === 0
          ? "Pas de terrasse"
          : `+${TERRACE_CUSTOMERS * level} ${plural(TERRACE_CUSTOMERS * level, "client")} par jour, +${(TERRACE_CUSTOMERS + TERRACE_SUNNY_CUSTOMERS) * level} les jours de soleil`,
    },
    livraison: {
      name: "Livraison",
      describe: ({ level }: { level: number }): string =>
        level === 0 ? "Uniquement sur place" : "Des commandes en scooter, avec un bonus express si elles partent vite",
    },
  },

  settings: {
    pizzeria: "Ta pizzeria",
    signName: "Nom sur l'enseigne",
    language: "Langue",
    showHelp: "Afficher les ingrédients sur les tickets et vérifier la pizza en cours",
    install: "Installer le jeu",
    installHint: "Installé, le jeu s'ouvre en plein écran et marche sans connexion. Sur iPhone : Partager, puis « Sur l'écran d'accueil ».",
    helpHint: "Sans cette aide, il faut connaître ses recettes par cœur.",
    save: "Sauvegarde",
    saveIntro:
      "La partie se sauvegarde toute seule dans ce navigateur. Pour passer du PC au téléphone, exporte le code ici et colle-le de l'autre côté.",
    generateCode: "Générer le code",
    copy: "Copier",
    copied: "Copié.",
    selected: "Sélectionné : copie-le avec Ctrl+C ou Cmd+C.",
    loadCode: "Charger un code",
    loadPlaceholder: "Colle ici le code exporté depuis l'autre appareil",
    loadGame: "Charger cette partie",
    invalidCode: "Ce code ne ressemble pas à une sauvegarde Forno Lento. Recopie-le en entier.",
    confirmReset: "Tout effacer et recommencer au jour 1 ?",
    yesReset: "Oui, recommencer",
    reset: "Recommencer une partie…",
  },

  summary: {
    dialog: "Fin de journée",
    title: "Fin du jour {day}",
    profit: "bénéfice de la journée",
    served: "Pizzas servies",
    revenue: "Ventes",
    tips: "Pourboires",
    purchases: "Achats (marché, fournisseurs, travaux)",
    charges: "Charges (loyer, four, personnel)",
    waste: "Ingrédients jetés",
    reputation: "Réputation gagnée",
    debt: "Ardoise chez le propriétaire",
    bestSeller: "La plus demandée :",
    event: "Événement :",
    orders: "Commandes servies",
    order: ({ customer, recipe }: { customer: string; recipe: string }) => `${customer} · ${recipe}`,
    noTip: "pas de pourboire",
    levelReached: "Niveau {level} atteint.",
    levelReachedDetails: "De nouveaux fournisseurs t'attendent au marché et ta carte peut accueillir {capacity} pizzas.",
    debtHint: "L'ardoise se rembourse toute seule avec la moitié des prochaines ventes.",
    nextDay: "Préparer le jour {day}",
    thanks: "Merci et à demain !",
  },

  journal: {
    stats: "Comptes",
    days: "Jours d'ouverture",
    served: "Pizzas servies",
    revenue: "Ventes",
    tips: "Pourboires",
    happy: "Servis tout sourire",
    bestDay: ({ day, net }: { day: number; net: number }, t: H) => `Meilleur jour : le jour ${day} (${net >= 0 ? "+" : ""}${t.money(net)})`,
    chart: "Bénéfice des derniers jours",
    chartEmpty: "Le graphique apparaîtra après ta première journée.",
    dayBar: ({ day, net }: { day: number; net: number }, t: H) => `Jour ${day} : ${net >= 0 ? "+" : ""}${t.money(net)}`,
    topPizzas: "Les plus vendues",
    noSales: "Aucune pizza vendue pour l'instant.",
    pairings: "Accords",
    pairingsIntro: ({ found, total }: { found: number; total: number }) =>
      `${found} / ${total} accords trouvés. Sers une pizza qui marie deux ingrédients faits l'un pour l'autre pour l'ajouter.`,
    pairingHint: ({ id }: { id: IngredientId }, t: H) => `${t.ingredient(id)} + ?`,
    achievements: "Succès",
    achievementsIntro: "{count} / {total} débloqués",
    unlockedOn: "Jour {day}",
  },

  events: {
    market: { name: "Jour de marché", describe: "Tous les ingrédients sont à −20 % aujourd'hui." },
    rain: { name: "Jour de pluie", describe: "Moins de monde, mais les clients qui passent sont plus généreux." },
    festival: { name: "Fête du quartier", describe: "Toute la rue a faim : beaucoup plus de clients ce soir." },
    critic: { name: "Critique gastronomique", describe: "Une critique passera ce soir. Sers-la vite pour une belle note et beaucoup de réputation." },
    sunny: { name: "Grand soleil", describe: "Un peu plus de clients, et bien plus avec une terrasse." },
  } satisfies Record<DayEventId, { name: string; describe: string }>,

  achievements: {
    firstPizza: { name: "Première fournée", describe: "Servir sa première pizza" },
    served50: { name: "Ça tourne", describe: "Servir 50 pizzas" },
    served250: { name: "Pilier du quartier", describe: "Servir 250 pizzas" },
    served1000: { name: "Légende du four", describe: "Servir 1000 pizzas" },
    tips100: { name: "Bocal à pourboires", describe: "Gagner 100 € de pourboires" },
    firstRecipe: { name: "Recette maison", describe: "Créer sa première recette" },
    threeRecipes: { name: "Carnet de chef", describe: "Avoir 3 recettes maison" },
    firstRegular: { name: "Un habitué", describe: "Gagner son premier habitué" },
    fiveRegulars: { name: "La bande", describe: "Avoir 5 habitués" },
    asUsual10: { name: "Mémoire d'éléphant", describe: "Servir 10 fois « comme d'habitude » sans aide" },
    pairings5: { name: "Fin palais", describe: "Découvrir 5 accords" },
    allPairings: { name: "Grand sommelier", describe: "Découvrir tous les accords" },
    critic: { name: "Cinq étoiles", describe: "Ravir une critique gastronomique" },
    wasteFree: { name: "Zéro gaspi", describe: "Une journée d'au moins 5 pizzas sans rien jeter" },
    profit100: { name: "Belle soirée", describe: "Gagner 100 € de bénéfice en une journée" },
    level5: { name: "On parle de toi", describe: "Atteindre le niveau 5" },
    maxLevel: { name: "Institution", describe: "Atteindre le niveau maximum" },
    allSuppliers: { name: "Tout le marché", describe: "Signer avec tous les fournisseurs" },
    fullyUpgraded: { name: "La pizzeria idéale", describe: "Acheter toutes les améliorations" },
    deliveries20: { name: "Vespa", describe: "Livrer 20 commandes" },
    challenge300: { name: "Main de feu", describe: "Faire 300 points au défi chrono" },
  } satisfies Record<AchievementId, { name: string; describe: string }>,

  tutorial: {
    label: "Premier service",
    skip: "Passer",
    open: "Bienvenue ! Ta carte propose la Margherita et le frigo est plein. Ouvre la pizzeria quand tu veux.",
    waiting: "Les premiers clients arrivent…",
    dough: "{name} a commandé ! Touche la Pâte, en bas, pour l'étaler.",
    toppings: ({ name, ingredientIds }: { name: string; ingredientIds: readonly IngredientId[] }, t: H) =>
      `Ajoute ce que veut ${name} : ${lower(t.ingredientList(ingredientIds))}. Les bacs à prendre sont entourés.`,
    extra: ({ ingredientIds }: { ingredientIds: readonly IngredientId[] }, t: H) =>
      `${t.ingredientList(ingredientIds)} : pas dans la commande. Touche le bac pour le retirer.`,
    bake: "Parfait, elle est complète ! Enfourne-la.",
    baking: "Elle cuit… Pas de stress, personne ne part fâché.",
    nextPizza: "Pendant la cuisson, tu peux étaler la pizza de {name}.",
    serve: "C'est prêt : sers-la à {name} ! Plus tu es rapide, plus le pourboire est généreux.",
  },

  toasts: {
    emptyMenu: "Ta carte est vide : ajoute au moins une pizza dans l'onglet Carte.",
    removeToppingsFirst: "Retire d'abord la garniture, ou jette la pizza.",
    spreadDoughFirst: "Étale d'abord la pâte.",
    outOfStock: ({ ingredientId }: { ingredientId: IngredientId }, t: H) =>
      `Plus de ${lower(t.ingredient(ingredientId))} en stock : passe au marché.`,
    ovenFull: "Le four est plein.",
    missingIngredients: ({ ingredientIds }: { ingredientIds: readonly IngredientId[] }, t: H) =>
      `Il manque : ${t.ingredientList(ingredientIds)}.`,
    nobodyOrdered: "Personne n'a commandé cette pizza. Garde-la au chaud ou jette-la.",
    levelUp: ({ level, ingredientIds }: { level: number; ingredientIds: readonly IngredientId[] }, t: H) =>
      `Niveau ${level} ! ${
        ingredientIds.length ? `Nouveaux fournisseurs : ${lower(t.ingredientList(ingredientIds))}.` : "La carte s'agrandit."
      }`,
    notEnoughMoney: "Pas assez d'argent.",
    notEnoughMoneyToRestock: "Pas assez d'argent pour tout compléter.",
    restocked: ({ cost }: { cost: number }, t: H) => `Stock complété pour ${t.money(cost)}.`,
    supplierSigned: ({ ingredientId, portions }: { ingredientId: IngredientId; portions: number }, t: H) =>
      `Nouveau fournisseur : ${t.ingredient(ingredientId)}. ${portions} portions offertes.`,
    nonna: "Nonna a déposé de quoi faire 4 margheritas. Elle ne veut rien en retour.",
    upgradeBought: ({ upgradeKey, level }: { upgradeKey: UpgradeKey; level: number }, t: H) =>
      `${t.upgradeName(upgradeKey)} amélioré : ${t.upgradeDescription(upgradeKey, level)}.`,
    menuFull: "Ta carte est pleine ({capacity} pizzas au niveau {level}).",
    recipeAdded: ({ name, onMenu }: { name: string; onMenu: boolean }) =>
      `« ${name} » rejoint ${onMenu ? "la carte" : "ton carnet (carte pleine)"}.`,
    classicDiscovered: ({ recipeId, onMenu }: { recipeId: ClassicRecipeId; onMenu: boolean }, t: H) =>
      `Nouvelle recette : ${t.recipe({ id: recipeId, name: null })}${onMenu ? " (ajoutée à la carte)" : ""}`,
    gameLoaded: "Partie chargée.",
    gameReset: "Nouvelle pizzeria ouverte.",
    newRegular: "{name} fait maintenant partie de tes habitués !",
    achievement: ({ achievementId }: { achievementId: AchievementId }, t: H) => `Succès débloqué : ${t.achievementName(achievementId)} !`,
    critic: ({ name, stars }: { name: string; stars: number }) => `${name} publie sa critique : ${"★".repeat(stars)}${"☆".repeat(5 - stars)}`,
    newPairing: ({ pairings }: { pairings: readonly Pairing[] }, t: H) =>
      `${plural(pairings.length, "Nouvel accord", "Nouveaux accords")} : ${pairings.map(t.pairing).join(", ")} !`,
  },

  customerLines: [
    ["J'ai hâte !", "Ça sent bon ici.", "Prenez votre temps."],
    ["Je patiente…", "Ça mijote ?", "Joli four."],
    ["Ça arrive bientôt ?", "Mon ventre gargouille.", "Hmm…"],
    ["J'ai une faim de loup !", "Je pourrais manger le four.", "Toujours là, hein."],
  ],

  kinds: { base: "base", sauce: "sauce", cheese: "fromage", topping: "garniture" } satisfies Record<IngredientKind, string>,

  stations: {
    base: "Pâte",
    sauce: "Sauces",
    cheese: "Fromages",
    meat: "Charcuterie & poisson",
    veg: "Légumes",
    herb: "Herbes & épices",
    finish: "Finitions",
  } satisfies Record<StationId, string>,

  ingredients: {
    pate: "Pâte",
    tomate: "Sauce tomate",
    mozza: "Mozzarella",
    basilic: "Basilic",
    origan: "Origan",
    jambon: "Jambon",
    champi: "Champignons",
    olive: "Olives noires",
    creme: "Crème fraîche",
    oignon: "Oignons rouges",
    poivron: "Poivrons",
    salami: "Salami piquant",
    piment: "Piment",
    chevre: "Chèvre",
    gorgo: "Gorgonzola",
    parmesan: "Parmesan",
    miel: "Miel",
    anchois: "Anchois",
    capres: "Câpres",
    artichaut: "Artichauts",
    oeuf: "Œuf",
    lardons: "Lardons",
    patate: "Pommes de terre",
    reblochon: "Reblochon",
    roquette: "Roquette",
    jcru: "Jambon cru",
    burrata: "Burrata",
    truffe: "Truffe noire",
  } satisfies Record<IngredientId, string>,

  recipes: {
    margherita: "Margherita",
    marinara: "Marinara",
    regina: "Regina",
    diavola: "Diavola",
    ortolana: "Ortolana",
    quattro: "Quattro formaggi",
    chevremiel: "Chèvre-miel",
    napoli: "Napoletana",
    bismarck: "Bismarck",
    capri: "Capricciosa",
    savoyarde: "Savoyarde",
    parma: "Parma",
    burrata: "Burrata",
    tartufo: "Tartufo",
  } satisfies Record<ClassicRecipeId, string>,
} as const;
