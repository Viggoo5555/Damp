/* =====================================================================
   PET CAFÉ — the content of the café
   Animals, recipes, furniture, customers, quests and achievements.
   Pure data: no DOM, no Three.js, so it is easy to extend.
   ===================================================================== */

export const RARITIES = {
  common:    { id: "common",    label: "Common",    color: "#8fa58c", soft: "#e8efe4", order: 0 },
  uncommon:  { id: "uncommon",  label: "Uncommon",  color: "#5aa98a", soft: "#ddf0e7", order: 1 },
  rare:      { id: "rare",      label: "Rare",      color: "#5b93c7", soft: "#e0ecf7", order: 2 },
  epic:      { id: "epic",      label: "Epic",      color: "#a57cc7", soft: "#eee3f7", order: 3 },
  legendary: { id: "legendary", label: "Legendary", color: "#d9a03f", soft: "#f9edd4", order: 4 },
  mythical:  { id: "mythical",  label: "Mythical",  color: "#dd7ba2", soft: "#fbe2ec", order: 5 }
};

export const XP_TABLE = (() => {
  const table = [0];
  let total = 0;
  for (let level = 1; level < 60; level++) {
    total += 110 + level * 85;
    table.push(total);
  }
  return table;
})();

export function levelInfo(xp) {
  let level = 1;
  while (level < XP_TABLE.length - 1 && xp >= XP_TABLE[level]) level++;
  const base = XP_TABLE[level - 1];
  const next = XP_TABLE[level] || base + 1;
  return {
    level,
    into: Math.max(0, xp - base),
    need: Math.max(1, next - base),
    pct: Math.min(1, Math.max(0, (xp - base) / Math.max(1, next - base)))
  };
}
export function levelForXp(xp) { return levelInfo(xp).level; }
export function xpForLevel(level) { return XP_TABLE[Math.max(1, level) - 1] || 0; }

/* ---------------------------------------------------------------------
   Pantry
   --------------------------------------------------------------------- */
export const PANTRY = [
  { id: "beans",    name: "Coffee beans", price: 46, packet: 10, color: "#8d5b3c", soft: "#f0e0d0", icon: "bean" },
  { id: "milk",     name: "Milk",         price: 32, packet: 12, color: "#b9cfe0", soft: "#eaf3f9", icon: "bottle" },
  { id: "flour",    name: "Flour & sugar",price: 38, packet: 12, color: "#d9bd86", soft: "#f7ecd6", icon: "bag" },
  { id: "fruit",    name: "Fresh fruit",  price: 52, packet: 8,  color: "#e08b62", soft: "#fbe6d9", icon: "fruit" },
  { id: "berries",  name: "Berries",      price: 58, packet: 8,  color: "#c96d93", soft: "#f8e1eb", icon: "berry" },
  { id: "chocolate",name: "Chocolate",    price: 64, packet: 8,  color: "#7b4a34", soft: "#f0e1d8", icon: "choc" },
  { id: "cream",    name: "Cream",        price: 48, packet: 9,  color: "#efe6d4", soft: "#faf5ea", icon: "cream" },
  { id: "matcha",   name: "Matcha & tea", price: 60, packet: 8,  color: "#7fa268", soft: "#e8f0df", icon: "leaf" }
];

export const PANTRY_PACKS = [
  { id: "starter", name: "Pantry top-up", contents: { milk: 6, flour: 6, beans: 4 }, price: 90 },
  { id: "sweet",   name: "Sweet baker's box", contents: { flour: 8, chocolate: 5, cream: 5, berries: 3 }, price: 240 },
  { id: "orchard", name: "Orchard crate", contents: { fruit: 8, berries: 8, cream: 4 }, price: 210 },
  { id: "barista", name: "Barista bundle", contents: { beans: 14, milk: 10, matcha: 6 }, price: 260 }
];

/* ---------------------------------------------------------------------
   Recipes — 36 of them, across five stations
   --------------------------------------------------------------------- */
const R = (id, name, cat, station, level, time, price, xp, ing, tone, accent) => ({
  id, name, cat, station, level, time, price, xp, ing, tone, accent,
  art: cat.toLowerCase().replace(/[^a-z]+/g, "-")
});

export const RECIPES = [
  // Cakes — oven
  R("cake-vanilla",    "Vanilla Cloud Cake",  "Cakes",    "oven",     1,  9, 34, 12, { flour: 2, milk: 1, cream: 1 }, "#f3e3cc", "#e6b8ae"),
  R("cake-strawberry", "Strawberry Shortcake","Cakes",    "oven",     4, 11, 48, 17, { flour: 2, berries: 2, cream: 2 }, "#f7e4dc", "#df7d94"),
  R("cake-chocolate",  "Fudge Layer Cake",    "Cakes",    "oven",     6, 12, 58, 21, { flour: 2, chocolate: 3, cream: 1 }, "#8d6049", "#5f3b2b"),
  R("cake-carrot",     "Carrot Garden Cake",  "Cakes",    "oven",     8, 12, 64, 23, { flour: 2, fruit: 1, cream: 2 }, "#dda77a", "#8fae7b"),
  // Cookies — oven
  R("cookie-choc",     "Choc Chip Cookies",   "Cookies",  "oven",     1,  5, 18,  7, { flour: 1, chocolate: 1 }, "#c99a6b", "#6d4732"),
  R("cookie-sugar",    "Sugar Bunnies",       "Cookies",  "oven",     2,  5, 20,  8, { flour: 1, cream: 1 }, "#f0dcbb", "#e7b6ad"),
  R("cookie-lemon",    "Lemon Shortbread",    "Cookies",  "oven",     5,  6, 26, 10, { flour: 2, fruit: 1 }, "#f2e5bd", "#e3cf72"),
  R("cookie-ginger",   "Gingerbread Friends", "Cookies",  "oven",     7,  6, 30, 12, { flour: 2, chocolate: 1 }, "#b97b4f", "#f3e3cd"),
  // Cupcakes — oven
  R("cup-vanilla",     "Vanilla Swirl Cupcake","Cupcakes", "oven",     2,  6, 22,  9, { flour: 1, cream: 1 }, "#f3e1cd", "#e8a7b4"),
  R("cup-berry",       "Berry Blossom Cupcake","Cupcakes", "oven",     5,  6, 32, 13, { flour: 1, berries: 1, cream: 1 }, "#f6dfe7", "#c7658c"),
  R("cup-mocha",       "Mocha Cream Cupcake",  "Cupcakes", "oven",     9,  7, 38, 16, { flour: 1, beans: 1, chocolate: 1 }, "#c8a58d", "#77503f"),
  // Pancakes — stove
  R("pan-butter",      "Butter Pancake Stack","Pancakes", "stove",    1,  7, 26, 10, { flour: 2, milk: 1 }, "#e9c48f", "#f6e3bd"),
  R("pan-berry",       "Berry Pancakes",      "Pancakes", "stove",    4,  8, 38, 15, { flour: 2, berries: 2, cream: 1 }, "#edcfa3", "#c96d93"),
  R("pan-banana",      "Banana Pancakes",     "Pancakes", "stove",    7,  8, 42, 17, { flour: 2, fruit: 2 }, "#e9c88f", "#e3c276"),
  // Waffles — stove
  R("waffle-classic",  "Golden Waffle",       "Waffles",  "stove",    3,  7, 28, 11, { flour: 2, milk: 1, cream: 1 }, "#e2b572", "#f6e0b5"),
  R("waffle-choc",     "Chocolate Waffle",    "Waffles",  "stove",    6,  8, 40, 16, { flour: 2, chocolate: 2, cream: 1 }, "#b98a63", "#62402f"),
  R("waffle-fruit",    "Orchard Waffle",      "Waffles",  "stove",    9,  9, 46, 19, { flour: 2, fruit: 2, cream: 1 }, "#e8bd7c", "#dd8767"),
  // Coffee — espresso
  R("coffee-latte",    "Vanilla Latte",       "Coffee",   "espresso", 1,  4, 20,  8, { beans: 1, milk: 1 }, "#dcc0a0", "#c49a76"),
  R("coffee-cap",      "Cappuccino",          "Coffee",   "espresso", 2,  4, 22,  9, { beans: 1, milk: 2 }, "#d8b593", "#bb8e68"),
  R("coffee-iced",     "Iced Caramel Latte",  "Coffee",   "espresso", 5,  5, 30, 12, { beans: 1, milk: 1, cream: 1 }, "#cda57b", "#a8794f"),
  R("coffee-mocha",    "Cocoa Mocha",         "Coffee",   "espresso", 7,  5, 34, 14, { beans: 1, chocolate: 1, milk: 1 }, "#9a6b53", "#6e4735"),
  R("coffee-flat",     "Flat White",          "Coffee",   "espresso", 10, 4, 26, 11, { beans: 2, milk: 1 }, "#d7b28d", "#f1dfc9"),
  // Tea — espresso
  R("tea-chamomile",   "Chamomile Cup",       "Tea",      "espresso", 1,  4, 18,  7, { matcha: 1 }, "#f1e6c0", "#d9c47d"),
  R("tea-earl",        "Earl Grey",           "Tea",      "espresso", 3,  4, 20,  8, { matcha: 1, milk: 1 }, "#e4d3ad", "#b9a275"),
  R("tea-matcha",      "Matcha Latte",        "Tea",      "espresso", 6,  5, 32, 13, { matcha: 2, milk: 1 }, "#b9cc93", "#7f9f66"),
  R("tea-berry",       "Berry Iced Tea",      "Tea",      "espresso", 8,  5, 28, 13, { matcha: 1, berries: 2 }, "#dba6bd", "#a95d80"),
  // Smoothies — blender
  R("smooth-straw",    "Strawberry Cloud",    "Smoothies","blender",  2,  5, 28, 11, { berries: 2, milk: 1 }, "#f0b7c7", "#d8789a"),
  R("smooth-mango",    "Sunrise Mango",       "Smoothies","blender",  4,  5, 34, 14, { fruit: 2, milk: 1 }, "#f2c578", "#e39a55"),
  R("smooth-green",    "Garden Green",        "Smoothies","blender",  6,  6, 36, 15, { fruit: 1, matcha: 2, milk: 1 }, "#c3d39c", "#8aa66f"),
  R("smooth-berry",    "Triple Berry",        "Smoothies","blender",  9,  6, 40, 17, { berries: 3, cream: 1 }, "#d9a2c0", "#a85f88"),
  // Sandwiches — stove
  R("sand-cucumber",   "Cucumber Tea Sandwich","Sandwiches","stove",  1,  5, 22,  9, { flour: 1, cream: 1 }, "#eee2c6", "#a9c48f"),
  R("sand-egg",        "Egg Salad Roll",      "Sandwiches","stove",   3,  6, 28, 11, { flour: 1, cream: 2 }, "#f1e2c2", "#e0c26f"),
  R("sand-club",       "Triple Club",         "Sandwiches","stove",   6,  8, 44, 18, { flour: 2, fruit: 1, cream: 1 }, "#e8d6b4", "#d28a6f"),
  R("sand-cheese",     "Grilled Cheese",      "Sandwiches","stove",   8,  6, 34, 15, { flour: 2, cream: 1 }, "#e8c98f", "#d9a24e"),
  // Ice cream — freezer
  R("ice-vanilla",     "Vanilla Bean Cone",   "Ice Cream","freezer",  3,  4, 24, 10, { cream: 2, milk: 1 }, "#f3e6d1", "#e3c9a6"),
  R("ice-straw",       "Strawberry Sundae",   "Ice Cream","freezer",  5,  5, 34, 14, { cream: 2, berries: 2 }, "#f4d7e0", "#d07c9b"),
  R("ice-choc",        "Fudge Sundae",        "Ice Cream","freezer",  7,  5, 38, 16, { cream: 2, chocolate: 2 }, "#d5b29a", "#7d513a"),
  R("ice-affogato",    "Affogato",            "Ice Cream","freezer",  9,  6, 42, 18, { cream: 1, beans: 1, milk: 1 }, "#e8dcc9", "#8b654a")
];

export const recipeById = (id) => RECIPES.find((r) => r.id === id);
export const recipeByLevel = () => RECIPES.slice().sort((a, b) => a.level - b.level || a.price - b.price);

/* ---------------------------------------------------------------------
   Collectible animals — 36 of them
   --------------------------------------------------------------------- */
const A = (id, name, family, rarity, unlock, blurb, palette, shape) => ({
  id, name, family, rarity, unlock, blurb, palette, shape
});

export const ANIMALS = [
  /* common */
  A("mochi", "Mochi", "cat", "common", { type: "starter" },
    "The café's first regular. Sleeps on the warm pastry counter and pretends not to hear the bell.",
    { fur: "#f4e5d4", belly: "#fff8ee", accent: "#e8b4ae", eye: "#4a3a34", nose: "#e3948f" },
    { variant: "quad", size: 0.82, ears: "point", tail: "fluff", pattern: "belly", chubby: 1.02 }),
  A("biscuit", "Biscuit", "corgi", "common", { type: "shop", price: 220, level: 1 },
    "Short legs, enormous opinions. Follows the smell of butter to any corner of the café.",
    { fur: "#e8b873", belly: "#fff2dc", accent: "#f6e6cd", eye: "#4b3a2e", nose: "#4c3a2f" },
    { variant: "quad", size: 0.84, ears: "round", tail: "stub", pattern: "belly", snout: 1.1 }),
  A("clover", "Clover", "rabbit", "common", { type: "shop", price: 260, level: 1 },
    "Found napping in the herb pots. Nose twitches at exactly three beats per second.",
    { fur: "#fbf7f0", belly: "#ffffff", accent: "#f3c4c8", eye: "#3f3a3c", nose: "#e6a9ae" },
    { variant: "quad", size: 0.8, ears: "long", tail: "puff", pattern: "plain" }),
  A("marmalade", "Marmalade", "cat", "common", { type: "shop", price: 320, level: 2 },
    "An orange tabby with a talent for sitting precisely where a chair is needed.",
    { fur: "#e59a55", belly: "#f8e2c4", accent: "#b96d38", eye: "#6a8a3f", nose: "#d68a7f" },
    { variant: "quad", size: 0.86, ears: "point", tail: "fluff", pattern: "stripe" }),
  A("bento", "Bento", "shiba", "common", { type: "shop", price: 380, level: 2 },
    "A round little shiba who guards the door and greets every guest with a sneeze.",
    { fur: "#d78f58", belly: "#f9e9d3", accent: "#b06c3e", eye: "#3f3229", nose: "#3a2d25" },
    { variant: "quad", size: 0.85, ears: "point", tail: "curl", pattern: "belly", snout: 1.05 }),
  /* uncommon */
  A("coco", "Coco", "capybara", "uncommon", { type: "shop", price: 560, level: 3 },
    "Unbothered by everything except an empty plate. The ducks use him as a sun lounger.",
    { fur: "#b58a64", belly: "#d9bb9a", accent: "#8f6a4b", eye: "#33271f", nose: "#5b4433" },
    { variant: "quad", size: 1.02, ears: "round", tail: "stub", pattern: "plain", chubby: 1.15, snout: 1.2 }),
  A("pepper", "Pepper", "fox", "uncommon", { type: "shop", price: 640, level: 4 },
    "Silver-furred and terribly dignified. Will accept exactly one head pat per hour.",
    { fur: "#a9aab2", belly: "#ece7dd", accent: "#6f7079", eye: "#7fa06a", nose: "#3c3438" },
    { variant: "quad", size: 0.9, ears: "point", tail: "bushy", pattern: "belly", snout: 1.15 }),
  A("momo", "Momo", "redpanda", "uncommon", { type: "shop", price: 700, level: 4 },
    "A rust-coloured daredevil who climbs the shelves and knocks down only the expensive things.",
    { fur: "#c4673f", belly: "#432f28", accent: "#f0dcc2", eye: "#3b2a24", nose: "#2f2320" },
    { variant: "quad", size: 0.82, ears: "round", tail: "bushy", pattern: "patch", chubby: 1.06 }),
  A("sable", "Sable", "cat", "uncommon", { type: "shop", price: 720, level: 5 },
    "A tuxedo cat with impeccable manners and a secret stash of napkins under the bar.",
    { fur: "#3f3c3c", belly: "#f8f6f1", accent: "#f4efe6", eye: "#9fb464", nose: "#c98f88" },
    { variant: "quad", size: 0.84, ears: "point", tail: "fluff", pattern: "tuxedo" }),
  A("waffles", "Waffles", "dalmatian", "uncommon", { type: "shop", price: 680, level: 5 },
    "One hundred and twelve spots, all of them muddy by closing time.",
    { fur: "#f7f3e9", belly: "#fffdf7", accent: "#4b4642", eye: "#3d3733", nose: "#3a3431" },
    { variant: "quad", size: 0.94, ears: "round", tail: "fluff", pattern: "spot", snout: 1.1 }),
  /* rare */
  A("nori", "Nori", "panda", "rare", { type: "shop", price: 980, level: 6 },
    "Rolls into the café like a small determined snowball and naps through the lunch rush.",
    { fur: "#f7f5ef", belly: "#fbfaf6", accent: "#3c3b3d", eye: "#2f2d30", nose: "#2f2d30" },
    { variant: "quad", size: 1.05, ears: "round", tail: "stub", pattern: "patch", chubby: 1.2 }),
  A("ember", "Ember", "fox", "rare", { type: "shop", price: 1050, level: 7 },
    "A red fox with a tail like a hearth fire. Sits too close to the oven on purpose.",
    { fur: "#cf6a3e", belly: "#f9ecdb", accent: "#8f3f28", eye: "#8aa35d", nose: "#3a2a24" },
    { variant: "quad", size: 0.9, ears: "point", tail: "bushy", pattern: "belly", snout: 1.15 }),
  A("cloud", "Cloud", "cat", "rare", { type: "shop", price: 1120, level: 7 },
    "A long-haired white cat who drifts between tables like a small weather event.",
    { fur: "#f6f3ec", belly: "#fffdf8", accent: "#e6dccf", eye: "#6f93a9", nose: "#e2a9a7" },
    { variant: "quad", size: 0.88, ears: "point", tail: "fluff", pattern: "plain", fluff: 1.25 }),
  A("atlas", "Atlas", "owl", "rare", { type: "shop", price: 1180, level: 8 },
    "The night-shift pastry inspector. Blinks once for yes, twice for a second slice.",
    { fur: "#b08a63", belly: "#eee0c8", accent: "#7d5e43", eye: "#e0a83f", nose: "#d8b34c" },
    { variant: "bird", size: 0.78, ears: "tuft", tail: "feather", pattern: "stripe" }),
  A("saffron", "Saffron", "redpanda", "rare", { type: "shop", price: 1220, level: 8 },
    "Wears the golden afternoon light like a scarf and refuses to share the window seat.",
    { fur: "#e39a4b", belly: "#6a4030", accent: "#fbe5c4", eye: "#3c2c23", nose: "#2f2320" },
    { variant: "quad", size: 0.85, ears: "round", tail: "bushy", pattern: "patch", fluff: 1.15 }),
  A("pebble", "Pebble", "otter", "rare", { type: "shop", price: 1080, level: 9 },
    "Keeps a favourite spoon in his pocket. Will trade it for exactly one cookie.",
    { fur: "#8c7a6a", belly: "#d8c7b1", accent: "#6b5a4c", eye: "#332a24", nose: "#4a3a30" },
    { variant: "quad", size: 0.84, ears: "round", tail: "thick", pattern: "belly", snout: 0.95 }),
  A("tofu", "Tofu", "penguin", "rare", { type: "shop", price: 1150, level: 9 },
    "A tiny penguin in a knitted scarf. Believes the freezer is a holiday home.",
    { fur: "#33383f", belly: "#fbf8ef", accent: "#e8b06a", eye: "#2b2e33", nose: "#e0a44f" },
    { variant: "bird", size: 0.76, ears: "none", tail: "stub", pattern: "tuxedo" }),
  /* epic */
  A("luna", "Luna", "mooncat", "epic", { type: "shop", price: 1900, level: 11 },
    "A moon-pale cat with a crescent on her brow. Her purr sounds faintly like wind chimes.",
    { fur: "#dfe4ef", belly: "#fafcff", accent: "#b9a7dd", eye: "#8f7fc9", nose: "#d6b6cc", glow: "#cfc2ff" },
    { variant: "quad", size: 0.9, ears: "point", tail: "fluff", pattern: "plain", horns: "crescent", glow: 1 }),
  A("cinder", "Cinder", "dragon", "epic", { type: "shop", price: 2300, level: 12 },
    "A pocket dragon who toasts marshmallows with a polite little flame. Mostly polite.",
    { fur: "#9a7cb0", belly: "#e5d5c8", accent: "#6d5182", eye: "#f0b04e", nose: "#5a415f", glow: "#ffb46a" },
    { variant: "dragon", size: 0.98, ears: "point", tail: "spade", pattern: "belly", horns: "small", wings: 1 }),
  A("aurora", "Aurora", "arcticfox", "epic", { type: "shop", price: 2100, level: 12 },
    "Her winter coat holds the colours of a very small northern sky.",
    { fur: "#eef3f6", belly: "#ffffff", accent: "#b7d6dc", eye: "#7fa6bd", nose: "#8fa8b2", glow: "#b6f0e4" },
    { variant: "quad", size: 0.9, ears: "point", tail: "bushy", pattern: "plain", fluff: 1.3 }),
  A("opal", "Opal", "wingedrabbit", "epic", { type: "shop", price: 2500, level: 13 },
    "A rabbit with small iridescent wings. Cannot fly far, but insists on trying daily.",
    { fur: "#f4e9f2", belly: "#fffaff", accent: "#cfb5e0", eye: "#8b6fa8", nose: "#dfa9c4", glow: "#f3d4ff" },
    { variant: "quad", size: 0.82, ears: "long", tail: "puff", pattern: "spot", wings: 1, fluff: 1.1 }),
  /* legendary */
  A("bao", "Bao", "sagepanda", "legendary", { type: "shop", price: 3700, level: 15 },
    "The old sage of the pastry counter. Meditates above the steam tray, radiating calm.",
    { fur: "#f5f2e7", belly: "#fbf9f1", accent: "#47514a", eye: "#5f7a48", nose: "#3d443d", glow: "#d8f0bd" },
    { variant: "quad", size: 1.06, ears: "round", tail: "stub", pattern: "patch", chubby: 1.2, horns: "antler" }),
  A("sol", "Sol", "sunlion", "legendary", { type: "shop", price: 4300, level: 16 },
    "A little lion made of late-afternoon light. His mane smells of warm biscuits.",
    { fur: "#efc06a", belly: "#fdf0ce", accent: "#d89a3f", eye: "#a86f2e", nose: "#a77840", glow: "#ffd98a" },
    { variant: "quad", size: 1.0, ears: "round", tail: "tuft", pattern: "plain", mane: 1, chubby: 1.05 }),
  A("fable", "Fable", "ninefox", "legendary", { type: "shop", price: 4900, level: 18 },
    "A nine-tailed storyteller. Every tail has a different ending and all of them are happy.",
    { fur: "#c9714f", belly: "#f8e5cf", accent: "#8f4530", eye: "#e2b25c", nose: "#4b3129", glow: "#ffcf9a" },
    { variant: "quad", size: 0.95, ears: "point", tail: "nine", pattern: "belly", fluff: 1.1, glow: 0.7 }),
  /* rescued strays */
  A("peanut", "Peanut", "hamster", "uncommon", { type: "rescue", served: 15 },
    "A hamster with full cheeks and a plan. Turned up at the door carrying a single napkin.",
    { fur: "#d9a874", belly: "#f8ead4", accent: "#b88754", eye: "#3f322a", nose: "#d79a92" },
    { variant: "quad", size: 0.56, ears: "round", tail: "stub", pattern: "belly", chubby: 1.25, snout: 0.9 }),
  A("nibbles", "Nibbles", "loprabbit", "uncommon", { type: "rescue", served: 40 },
    "A lop-eared rabbit who came in from the rain and never found a reason to leave.",
    { fur: "#bfae9c", belly: "#f5ecdd", accent: "#9d8a76", eye: "#3f3830", nose: "#d3a6a0" },
    { variant: "quad", size: 0.82, ears: "lop", tail: "puff", pattern: "plain" }),
  A("pudding", "Pudding", "duck", "uncommon", { type: "rescue", served: 80 },
    "A duck of very little brain and enormous enthusiasm for the patio puddles.",
    { fur: "#f3e2a9", belly: "#fdf6dd", accent: "#e2bb62", eye: "#3b352b", nose: "#e0a24a" },
    { variant: "bird", size: 0.68, ears: "none", tail: "feather", pattern: "belly" }),
  A("juniper", "Juniper", "rabbit", "rare", { type: "rescue", served: 140 },
    "A grey rabbit who arrived with a tiny suitcase and a taste for expensive tea.",
    { fur: "#b9b7b2", belly: "#e9e6df", accent: "#8f8d88", eye: "#4a4642", nose: "#d0a6a6" },
    { variant: "quad", size: 0.8, ears: "long", tail: "puff", pattern: "plain", fluff: 1.1 }),
  A("moss", "Moss", "hedgehog", "rare", { type: "rescue", served: 220 },
    "A hedgehog who rolls through the herb garden and comes out smelling of rosemary.",
    { fur: "#8a7458", belly: "#e8d7bd", accent: "#5f513d", eye: "#332c23", nose: "#3e3328" },
    { variant: "quad", size: 0.6, ears: "round", tail: "stub", pattern: "spot", chubby: 1.3, spikes: 1 }),
  A("bandit", "Bandit", "raccoon", "rare", { type: "rescue", served: 320 },
    "Suspected of stealing exactly one muffin. Has been forgiven. Will do it again.",
    { fur: "#9b968f", belly: "#e5e0d8", accent: "#4b4744", eye: "#39322c", nose: "#3a332e" },
    { variant: "quad", size: 0.86, ears: "point", tail: "stripe", pattern: "patch", snout: 1.1 }),
  /* quest animals */
  A("praline", "Praline", "hamsterchef", "epic", { type: "quest", quest: "perfect25",
    text: "Cook 25 perfect dishes" },
    "The smallest chef in the kitchen. Stands on a stack of cookbooks to reach the whisk.",
    { fur: "#d9b48b", belly: "#fbf0dc", accent: "#b08a5f", eye: "#3c3128", nose: "#d69a92" },
    { variant: "quad", size: 0.62, ears: "round", tail: "stub", pattern: "belly", chubby: 1.2, hat: "chef" }),
  A("maple", "Maple", "squirrel", "epic", { type: "quest", quest: "pet60",
    text: "Pet your animals 60 times" },
    "A red squirrel who keeps the patio tidy by burying everything that is not nailed down.",
    { fur: "#c47c4c", belly: "#f4e2c9", accent: "#99552f", eye: "#382b23", nose: "#5b3f31" },
    { variant: "quad", size: 0.64, ears: "tuft", tail: "bushy", pattern: "belly", fluff: 1.2 }),
  A("willow", "Willow", "deer", "legendary", { type: "quest", quest: "level10",
    text: "Reach café level 10" },
    "A gentle deer with tiny antlers and a bell that rings when she trots.",
    { fur: "#c9a37d", belly: "#f1dfc8", accent: "#9c7654", eye: "#43352a", nose: "#4c3a2d" },
    { variant: "quad", size: 0.98, ears: "long", tail: "stub", pattern: "spot", horns: "antler", legs: 1.2 }),
  A("miso", "Miso", "seal", "legendary", { type: "quest", quest: "rep92",
    text: "Reach 92 reputation" },
    "A round seal who slid in on a delivery crate and now reviews the cakes professionally.",
    { fur: "#9fb2bd", belly: "#e8eef1", accent: "#7c919e", eye: "#2f3438", nose: "#4b565c" },
    { variant: "quad", size: 0.92, ears: "none", tail: "flipper", pattern: "belly", chubby: 1.28, snout: 0.9 }),
  /* mythical */
  A("nimbus", "Nimbus", "cloudcat", "mythical", { type: "event", event: "competition",
    text: "Place in the top three of a weekly decoration competition" },
    "A cloud cat who rains gently only over the plants. Leaves a trail of tiny rainbows.",
    { fur: "#eaeffa", belly: "#ffffff", accent: "#babce8", eye: "#7d84c9", nose: "#d5b4d8", glow: "#c9d4ff" },
    { variant: "quad", size: 0.9, ears: "point", tail: "fluff", pattern: "plain", wings: 1, glow: 1.2, fluff: 1.3 }),
  A("starburst", "Starburst", "starfox", "mythical", { type: "event", event: "reviews5",
    text: "Collect 25 five-star reviews" },
    "A fox with a constellation in her tail. Appears when the café is at its happiest.",
    { fur: "#7f7ab0", belly: "#efe9ff", accent: "#5b558f", eye: "#ffd76e", nose: "#3f3560", glow: "#ffe3a3" },
    { variant: "quad", size: 0.92, ears: "point", tail: "nine", pattern: "spot", fluff: 1.2, glow: 1 })
];

export const animalById = (id) => ANIMALS.find((a) => a.id === id);

export function animalUnlockText(animal) {
  const u = animal.unlock;
  if (u.type === "starter") return "Starting friend";
  if (u.type === "shop") return `Adopt for ${u.price} coins · level ${u.level}`;
  if (u.type === "rescue") return `Rescued after serving ${u.served} customers`;
  if (u.type === "quest") return u.text;
  if (u.type === "event") return u.text;
  return "A mystery";
}

/* ---------------------------------------------------------------------
   Furniture & decoration — 78 pieces, all built from real geometry
   --------------------------------------------------------------------- */
const F = (id, name, cat, price, level, kind, w, d, h, opts = {}) =>
  ({ id, name, cat, price, level, kind, w, d, h, seats: 0, ambience: 0, ...opts });

export const FURNITURE = [
  /* ---------- Tables ---------- */
  F("table-bistro",    "Bistro Table",      "Tables", 0, 1, "round",    1.1, 1.1, 0.76, { tone: "#e8d4b8", accent: "#c4a27e", table: 1, ambience: 2 }),
  F("table-square",    "Oak Café Table",    "Tables", 0, 1, "square",   1.2, 1.2, 0.76, { tone: "#d9b98e", accent: "#b08f68", table: 1, ambience: 2 }),
  F("table-marble",    "Marble Round",      "Tables", 380, 3, "marble",   1.3, 1.3, 0.78, { tone: "#f4efe6", accent: "#d9c2a6", table: 1, ambience: 5 }),
  F("table-long",      "Communal Long Table","Tables", 460, 4, "long",     2.6, 1.1, 0.78, { tone: "#d5b183", accent: "#a8845c", table: 1, ambience: 7 }),
  F("table-picnic",    "Patio Picnic Table","Tables", 260, 2, "picnic",   2.0, 1.6, 0.76, { tone: "#c9a06d", accent: "#96714a", table: 1, outdoor: 1, ambience: 4 }),
  F("table-coffee",    "Low Coffee Table",  "Tables", 210, 2, "coffee",   1.2, 0.7, 0.4,  { tone: "#c7a47f", accent: "#a68461", ambience: 2 }),
  F("table-patio",     "White Patio Table", "Tables", 300, 3, "patioround",1.0, 1.0, 0.74,{ tone: "#f6f1e6", accent: "#cfc3b1", table: 1, outdoor: 1, ambience: 4 }),

  /* ---------- Chairs ---------- */
  F("chair-bentwood",  "Bentwood Chair",    "Chairs", 0, 1, "bent",     0.52, 0.54, 0.9,  { tone: "#c9a06c", accent: "#e8d8c4", seats: 1, chair: 1 }),
  F("chair-stool",     "Café Stool",        "Chairs", 120, 1, "stool",    0.44, 0.44, 0.7,  { tone: "#d6b184", accent: "#b08a5e", seats: 1, chair: 1 }),
  F("chair-arm",       "Cushioned Armchair","Chairs", 320, 3, "arm",      0.8, 0.82, 0.95, { tone: "#e7c7c1", accent: "#c9a19b", seats: 1, chair: 1, ambience: 3 }),
  F("chair-rattan",    "Rattan Chair",      "Chairs", 280, 3, "rattan",   0.72, 0.74, 0.98, { tone: "#d9bd91", accent: "#f4e8d2", seats: 1, chair: 1, ambience: 3 }),
  F("chair-booth",     "Booth Bench",       "Chairs", 420, 4, "booth",    1.7, 0.6, 1.05,  { tone: "#c98d86", accent: "#a96d67", seats: 2, chair: 1, ambience: 4 }),
  F("chair-cushion",   "Floor Cushion",     "Chairs", 90, 2, "cushion",  0.6, 0.6, 0.22,  { tone: "#e8c3a2", accent: "#f6e7d2", seats: 1, chair: 1, ambience: 2 }),
  F("chair-highback",  "Velvet Highback",   "Chairs", 560, 5, "highback", 0.68, 0.7, 1.18, { tone: "#c9a6b8", accent: "#a68597", seats: 1, chair: 1, ambience: 5 }),
  F("chair-kids",      "Little Bear Chair", "Chairs", 140, 2, "kids",     0.5, 0.52, 0.62, { tone: "#f0d6a9", accent: "#d9a86f", seats: 1, chair: 1, ambience: 1 }),

  /* ---------- Sofas ---------- */
  F("sofa-loveseat",   "Linen Loveseat",    "Sofas", 520, 3, "loveseat", 1.6, 0.85, 0.92, { tone: "#e4d3bd", accent: "#cbb69c", seats: 2, chair: 1, ambience: 5 }),
  F("sofa-long",       "Cloud Sofa",        "Sofas", 880, 5, "sofa",     2.3, 0.95, 0.95, { tone: "#e9e2d6", accent: "#c9bda9", seats: 3, chair: 1, ambience: 8 }),
  F("sofa-corner",     "Corner Nook",       "Sofas", 1240, 7, "corner",   2.3, 1.8, 0.95, { tone: "#d8c4c9", accent: "#bba5aa", seats: 4, chair: 1, ambience: 10 }),
  F("sofa-beanbag",    "Bean Bag",          "Sofas", 190, 2, "beanbag",  0.95, 0.95, 0.7, { tone: "#b9c9d4", accent: "#9fb2c2", seats: 1, chair: 1, ambience: 2 }),
  F("sofa-window",     "Window Bench",      "Sofas", 460, 4, "windowbench",1.9, 0.62, 0.62,{ tone: "#e5d3b7", accent: "#c5ab8a", seats: 2, chair: 1, ambience: 4 }),

  /* ---------- Counters ---------- */
  F("counter-cafe",    "Pastry Counter",    "Counters", 0, 1, "pastry",  3.4, 0.8, 1.04, { tone: "#e7d2bb", accent: "#c8a887", station: "pass", ambience: 8, counter: 1 }),
  F("counter-bar",     "Espresso Bar",      "Counters", 720, 4, "bar",     2.6, 0.7, 1.06, { tone: "#b98d6a", accent: "#8e6647", station: "espresso", ambience: 8, counter: 1 }),
  F("counter-display", "Glass Display",     "Counters", 640, 3, "display", 1.6, 0.7, 1.2,  { tone: "#f3ecdf", accent: "#c9b9a4", ambience: 6, counter: 1 }),
  F("counter-reception","Welcome Desk",     "Counters", 480, 2, "reception",1.8, 0.7, 1.02,{ tone: "#d8c2a6", accent: "#b89b7a", ambience: 4 }),
  F("counter-pastry",  "Cake Cabinet",      "Counters", 980, 6, "cake",    1.8, 0.75, 1.65, { tone: "#f5eee1", accent: "#dfc9ae", ambience: 9 }),
  F("counter-coffee",  "Coffee Bar Deluxe",  "Counters", 1180, 8, "bar2",   3.0, 0.8, 1.1,  { tone: "#a97b58", accent: "#7f5940", station: "espresso", ambience: 12, counter: 1 }),

  /* ---------- Kitchen ---------- */
  F("kitchen-stove",   "Cooktop",           "Kitchen", 0, 1, "stove",    1.2, 0.7, 0.94, { tone: "#dfe2d8", accent: "#3f4340", station: "stove", ambience: 4 }),
  F("kitchen-oven",    "Pastry Oven",       "Kitchen", 0, 1, "oven",     1.3, 0.75, 1.15, { tone: "#e4d9c8", accent: "#b3a28b", station: "oven", ambience: 4 }),
  F("kitchen-espresso","Espresso Machine",  "Kitchen", 0, 1, "espresso", 0.8, 0.62, 0.82, { tone: "#c7c9c4", accent: "#8d938f", station: "espresso", ambience: 5 }),
  F("kitchen-blender", "Smoothie Blender",  "Kitchen", 0, 1, "blender",  0.52, 0.52, 0.72, { tone: "#dbe4e1", accent: "#9db6ae", station: "blender", ambience: 3 }),
  F("kitchen-freezer", "Ice Cream Freezer", "Kitchen", 460, 3, "freezer", 1.3, 0.8, 1.2,  { tone: "#eef4f6", accent: "#c6d6dc", station: "freezer", ambience: 5 }),
  F("kitchen-fridge",  "Fridge",            "Kitchen", 420, 3, "fridge",   0.95, 0.75, 1.9, { tone: "#e8eef0", accent: "#c2ccd0", ambience: 3 }),
  F("kitchen-prep",    "Prep Island",       "Kitchen", 520, 2, "prep",     1.8, 0.9, 0.92, { tone: "#d9c4a8", accent: "#b7a183", ambience: 5 }),
  F("kitchen-shelf",   "Spice Shelf",       "Kitchen", 240, 3, "spices",   1.4, 0.3, 0.75, { tone: "#c9a97e", accent: "#9f8058", ambience: 3, place: "wall" }),
  F("kitchen-sink",    "Farmhouse Sink",    "Kitchen", 380, 4, "sink",     1.2, 0.7, 0.95, { tone: "#eeeae0", accent: "#b8b4a9", ambience: 3 }),

  /* ---------- Plants ---------- */
  F("plant-monstera",  "Monstera",          "Plants", 0, 1, "monstera", 0.6, 0.6, 1.35, { tone: "#d3b28c", accent: "#5f8f66", ambience: 4 }),
  F("plant-cactus",    "Cactus",            "Plants", 110, 1, "cactus",   0.36, 0.36, 0.8, { tone: "#e0b295", accent: "#6c9b72", ambience: 2 }),
  F("plant-fern",      "Maidenhair Fern",   "Plants", 160, 2, "fern",     0.55, 0.55, 0.85, { tone: "#c9a78a", accent: "#7fa574", ambience: 3 }),
  F("plant-palm",      "Parlour Palm",      "Plants", 220, 3, "palm",     0.7, 0.7, 1.55, { tone: "#d8b998", accent: "#6d9a70", ambience: 5 }),
  F("plant-tulips",    "Tulip Pot",         "Plants", 130, 2, "tulips",   0.4, 0.4, 0.6,  { tone: "#e3c1a4", accent: "#e495a1", ambience: 3 }),
  F("plant-hanging",   "Hanging Ivy",       "Plants", 190, 4, "ivy",      0.6, 0.6, 0.9,  { tone: "#d9c0a4", accent: "#6f9a6b", ambience: 4, place: "ceiling" }),
  F("plant-olive",     "Olive Tree",        "Plants", 340, 5, "olive",    0.85, 0.85, 1.75, { tone: "#d8bfa2", accent: "#8aa383", ambience: 7 }),
  F("plant-herbs",     "Herb Pots",         "Plants", 150, 3, "herbs",    0.75, 0.35, 0.42, { tone: "#cf9f7c", accent: "#7ca26f", ambience: 3 }),

  /* ---------- Decor ---------- */
  F("decor-cakestand", "Cake Stand",        "Decor", 180, 1, "cakestand",0.42, 0.42, 0.5, { tone: "#f2e6d2", accent: "#e0b6a4", ambience: 2 }),
  F("decor-books",     "Book Stack",        "Decor", 90, 1, "books",    0.34, 0.26, 0.4, { tone: "#d9b98d", accent: "#c78b7e", ambience: 2 }),
  F("decor-vase",      "Flower Vase",       "Decor", 120, 2, "vase",     0.28, 0.28, 0.55, { tone: "#efe7f0", accent: "#e5a2b4", ambience: 3 }),
  F("decor-clock",     "Wall Clock",        "Decor", 160, 2, "clock",    0.52, 0.1, 0.52, { tone: "#f4e8d5", accent: "#b98d64", ambience: 2, place: "wall" }),
  F("decor-picture",   "Framed Print",      "Decor", 140, 2, "picture",  0.7, 0.06, 0.85, { tone: "#d8b98e", accent: "#f0dcc1", ambience: 3, place: "wall" }),
  F("decor-rug",       "Woven Rug",         "Decor", 260, 3, "rug",      2.6, 1.8, 0.03, { tone: "#e6c7b2", accent: "#c58f83", ambience: 5, rug: 1 }),
  F("decor-cushions",  "Cushion Pile",      "Decor", 100, 2, "cushionpile",0.7, 0.7, 0.32,{ tone: "#e2bfb1", accent: "#c79587", ambience: 2 }),
  F("decor-candles",   "Candles",           "Decor", 130, 3, "candles",  0.3, 0.3, 0.4, { tone: "#f1e3ce", accent: "#e0b37a", ambience: 3 }),
  F("decor-sculpture", "Bear Statue",       "Decor", 320, 4, "statue",   0.5, 0.5, 0.95, { tone: "#d8c2a8", accent: "#b89d7e", ambience: 5 }),
  F("decor-garland",   "Paper Garland",     "Decor", 110, 3, "garland",  1.6, 0.1, 0.32, { tone: "#f0c2c8", accent: "#c9d8b8", ambience: 3, place: "wall" }),

  /* ---------- Windows ---------- */
  F("window-round",    "Round Window",      "Windows", 420, 2, "roundwin", 1.2, 0.14, 1.2, { tone: "#f8f1e4", accent: "#b8cdd4", ambience: 5, place: "wall" }),
  F("window-arch",     "Arched Window",     "Windows", 560, 3, "archwin",  1.5, 0.14, 1.9, { tone: "#f6efe2", accent: "#aecad4", ambience: 6, place: "wall" }),
  F("window-wide",     "Wide Window",       "Windows", 240, 1, "widewin",  2.2, 0.14, 1.5, { tone: "#f8f2e7", accent: "#b7ccd3", ambience: 4, place: "wall" }),
  F("window-stain",    "Stained Glass",     "Windows", 880, 6, "stainwin", 1.4, 0.14, 1.8, { tone: "#f1e6cf", accent: "#c9a2c2", ambience: 9, place: "wall" }),

  /* ---------- Doors ---------- */
  F("door-cafe",       "Café Door",         "Doors", 0, 1, "cafedoor", 1.3, 0.16, 2.2, { tone: "#c8a47c", accent: "#a07c55", ambience: 0, place: "wall" }),
  F("door-arch",       "Arched Door",       "Doors", 480, 4, "archdoor", 1.4, 0.16, 2.4, { tone: "#e9d6bb", accent: "#c1a581", ambience: 3, place: "wall" }),
  F("door-patio",      "Glass Patio Door",  "Doors", 640, 5, "patiodoor",2.0, 0.16, 2.35, { tone: "#e9e5da", accent: "#b7c8cc", ambience: 5, place: "wall" }),

  /* ---------- Lamps ---------- */
  F("lamp-pendant",    "Pendant Lamp",      "Lamps", 0, 1, "pendant",   0.5, 0.5, 0.55, { tone: "#e9c48d", accent: "#fff1cf", ambience: 4, place: "ceiling", light: 1 }),
  F("lamp-floor",      "Floor Lamp",        "Lamps", 220, 2, "floorlamp", 0.45, 0.45, 1.7,{ tone: "#d9bf9c", accent: "#f7e7c6", ambience: 3, light: 1 }),
  F("lamp-table",      "Table Lamp",        "Lamps", 160, 2, "tablelamp", 0.34, 0.34, 0.52,{ tone: "#e7cdb4", accent: "#ffe9c2", ambience: 2, light: 1 }),
  F("lamp-string",     "String Lights",     "Lamps", 280, 3, "string",    3.4, 0.2, 0.35, { tone: "#f3d3a2", accent: "#ffe8b8", ambience: 5, place: "wall" }),
  F("lamp-paper",      "Paper Lantern",     "Lamps", 190, 4, "lantern",   0.5, 0.5, 0.6,  { tone: "#f4d8cf", accent: "#ffe5c8", ambience: 4, place: "ceiling", light: 1 }),

  /* ---------- Outdoor ---------- */
  F("out-patiotable",  "Patio Table",       "Outdoor", 0, 1, "patiotable",1.1, 1.1, 0.74,{ tone: "#f2ebe0", accent: "#c8b9a6", table: 1, outdoor: 1, ambience: 3 }),
  F("out-patioround",  "Round Table & Chairs","Outdoor",420, 3, "patioset",1.7, 1.7, 0.74, { tone: "#efe8de", accent: "#c3b3a0", table: 1, outdoor: 1, ambience: 6 }),
  F("out-chair",       "Rattan Patio Chair","Outdoor", 130, 1, "patiochair",0.62, 0.64, 0.86, { tone: "#dcc09a", accent: "#f4e6d2", seats: 1, chair: 1, outdoor: 1, ambience: 2 }),
  F("out-umbrella",    "Striped Umbrella",  "Outdoor", 320, 2, "umbrella", 2.1, 2.1, 2.4, { tone: "#f4e4de", accent: "#e2a3a1", outdoor: 1, ambience: 6 }),
  F("out-bench",       "Garden Bench",      "Outdoor", 280, 3, "gardenbench",1.8, 0.62, 0.9,{ tone: "#c99f70", accent: "#a8814f", seats: 2, chair: 1, outdoor: 1, ambience: 4 }),
  F("out-planter",     "Planter Box",       "Outdoor", 180, 2, "planter",  1.3, 0.5, 0.6, { tone: "#d9b98f", accent: "#7c9e72", outdoor: 1, ambience: 4 }),
  F("out-firepit",     "Fire Pit",          "Outdoor", 620, 5, "firepit",  1.2, 1.2, 0.55, { tone: "#b7ada0", accent: "#e59a55", outdoor: 1, ambience: 8, light: 1 }),
  F("out-swing",       "Swing Seat",        "Outdoor", 780, 6, "swing",    1.3, 0.8, 2.1, { tone: "#d8b58e", accent: "#f0dcc0", seats: 2, chair: 1, outdoor: 1, ambience: 9 }),
  F("out-birdbath",    "Bird Bath",         "Outdoor", 260, 4, "birdbath", 0.7, 0.7, 1.05, { tone: "#d8d2c6", accent: "#a9c9d4", outdoor: 1, ambience: 4 }),

  /* ---------- Signs ---------- */
  F("sign-hanging",    "Hanging Café Sign", "Signs", 380, 2, "hangingsign",1.4, 0.12, 0.9, { tone: "#c99a6d", accent: "#f4e3c9", ambience: 6, place: "wall" }),
  F("sign-chalk",      "Chalkboard Menu",   "Signs", 140, 1, "chalk",    0.8, 0.1, 1.1, { tone: "#4d4a44", accent: "#e8d9b9", ambience: 4, place: "wall" }),
  F("sign-open",       "Open Sign",         "Signs", 190, 3, "opensign", 0.8, 0.08, 0.4, { tone: "#3e413d", accent: "#ffdf9b", ambience: 4, place: "wall", light: 1 }),
  F("sign-wood",       "Wooden Name Sign",  "Signs", 260, 4, "woodsign", 1.5, 0.1, 0.55, { tone: "#c9a274", accent: "#f0dfc3", ambience: 5, place: "wall" })
];

export const FURNITURE_CATS = ["All", "Tables", "Chairs", "Sofas", "Counters", "Kitchen", "Plants", "Decor", "Windows", "Doors", "Lamps", "Outdoor", "Signs"];
export const furnitureById = (id) => FURNITURE.find((f) => f.id === id) || FLOORING.find((f) => f.id === id);

/* Floors and walls are painted on, not placed. */
export const FLOORING = [
  { id: "floor-oak",      name: "Honey Oak",       cat: "Floors", price: 0,   level: 1, kind: "floor", tone: "#d9b98c", accent: "#c39f6f", pattern: "planks", ambience: 2 },
  { id: "floor-checker",  name: "Café Checker",    cat: "Floors", price: 380, level: 2, kind: "floor", tone: "#f1e7d8", accent: "#cda89a", pattern: "checker", ambience: 5 },
  { id: "floor-terrazzo", name: "Terrazzo",        cat: "Floors", price: 620, level: 4, kind: "floor", tone: "#ece5da", accent: "#b9ad9b", pattern: "terrazzo", ambience: 7 },
  { id: "floor-deck",     name: "Patio Decking",   cat: "Floors", price: 420, level: 3, kind: "floor", tone: "#c8a274", accent: "#a68154", pattern: "planks", ambience: 4 }
];

export const WALLS = [
  { id: "wall-cream",  name: "Warm Cream",     price: 0,   level: 1, kind: "wall", tone: "#f6ead9", accent: "#e9d7c0", ambience: 1 },
  { id: "wall-blush",  name: "Rose Milk",      price: 260, level: 2, kind: "wall", tone: "#f6e0dd", accent: "#eccac7", ambience: 3 },
  { id: "wall-sage",   name: "Tea Sage",       price: 300, level: 3, kind: "wall", tone: "#e4ecdc", accent: "#cfdcc4", ambience: 3 },
  { id: "wall-stripe", name: "Candy Stripe",   price: 460, level: 4, kind: "wall", tone: "#f8ecdf", accent: "#efcfc6", pattern: "stripe", ambience: 5 },
  { id: "wall-dots",   name: "Confetti Dots",  price: 520, level: 6, kind: "wall", tone: "#f7ecdc", accent: "#dfb7c0", pattern: "dots", ambience: 6 }
];

/* ---------------------------------------------------------------------
   Customers
   --------------------------------------------------------------------- */
export const CUSTOMERS = [
  { id: "bun",    name: "Bun",    species: "rabbit",   pref: "Cakes",     patience: 1.05, tip: 1.0,  palette: { fur: "#f0ded0", belly: "#fffaf2", accent: "#dfb3ad", eye: "#463a32", nose: "#dfa3a2" }, shape: { ears: "long" }, line: "Something soft and sweet, please." },
  { id: "miso",   name: "Miso",   species: "cat",      pref: "Coffee",    patience: 0.9,  tip: 1.25, palette: { fur: "#d9a97e", belly: "#f8e9d7", accent: "#b7875e", eye: "#4d6b3d", nose: "#d0958b" }, shape: { ears: "point" }, line: "A latte, and make it calm." },
  { id: "bruno",  name: "Bruno",  species: "bear",     pref: "Cakes",     patience: 1.3,  tip: 1.1,  palette: { fur: "#a9784f", belly: "#e3c9a8", accent: "#7e5537", eye: "#33281f", nose: "#4c3727" }, shape: { ears: "round", chubby: 1.25, size: 1.05 }, line: "I have room for cake." },
  { id: "poppy",  name: "Poppy",  species: "corgi",    pref: "Cookies",   patience: 0.8,  tip: 1.15, palette: { fur: "#e4b273", belly: "#fdf0da", accent: "#f6e4c9", eye: "#45362a", nose: "#40322a" }, shape: { ears: "round", snout: 1.1 }, line: "Cookies! Cookies, please!" },
  { id: "fin",    name: "Fin",    species: "fox",      pref: "Sandwiches",patience: 0.95, tip: 1.2,  palette: { fur: "#cf7a4c", belly: "#f7e8d5", accent: "#a4552f", eye: "#6f8f52", nose: "#3e2c24" }, shape: { ears: "point", snout: 1.15 }, line: "Something savoury for a change." },
  { id: "quack",  name: "Quack",  species: "duck",     pref: "Smoothies", patience: 1.1,  tip: 1.0,  palette: { fur: "#f2e2a8", belly: "#fdf7de", accent: "#dfb969", eye: "#39332a", nose: "#df9f47" }, shape: { variant: "bird" }, line: "A smoothie, extra straw." },
  { id: "bamboo", name: "Bamboo", species: "panda",    pref: "Ice Cream", patience: 1.25, tip: 1.05, palette: { fur: "#f8f5ef", belly: "#fdfbf7", accent: "#3d3c3e", eye: "#2f2d30", nose: "#2f2d30" }, shape: { ears: "round", chubby: 1.2 }, line: "Ice cream is a food group." },
  { id: "rascal", name: "Rascal", species: "raccoon",  pref: "Cupcakes",  patience: 0.75, tip: 1.35, palette: { fur: "#9c968e", belly: "#e7e2da", accent: "#4b4744", eye: "#342e29", nose: "#3a332e" }, shape: { ears: "point" }, line: "I'll take two. Don't ask." },
  { id: "willow", name: "Willow", species: "deer",     pref: "Tea",       patience: 1.2,  tip: 1.1,  palette: { fur: "#c9a37d", belly: "#f1dfc8", accent: "#9c7654", eye: "#43352a", nose: "#4c3a2d" }, shape: { ears: "long", horns: "antler" }, line: "A pot of tea, if you have one." },
  { id: "pebble", name: "Pebble", species: "otter",    pref: "Pancakes",  patience: 1.0,  tip: 1.2,  palette: { fur: "#8d7b6b", belly: "#d9c8b2", accent: "#6b5a4c", eye: "#332a24", nose: "#4a3a30" }, shape: { ears: "round", snout: 0.95 }, line: "Pancakes make the day better." }
];

export const REVIEW_LINES = {
  5: ["Perfect. I'm moving in.", "The best little café in the whole wood.", "Everything was warm and lovely.", "I felt like a very important cat.", "Ten out of five. Would nap again.", "My cake had a little flower on it. I nearly cried."],
  4: ["Lovely, just a little hurried.", "Delicious! I'll be back with friends.", "The seat was cosy and the tea was hot.", "Very good. More biscuits next time."],
  3: ["Nice enough. My tea went a bit cold.", "Cute place, a little slow today.", "The cake was good, the wait was long."],
  2: ["I waited far too long for that.", "Not my best afternoon, honestly.", "The order was lovely but I was starving by then."],
  1: ["I gave up and went home.", "My patience ran out with my tea.", "Sadly I left before my order arrived."]
};

/* ---------------------------------------------------------------------
   Quests & achievements
   --------------------------------------------------------------------- */
export const QUEST_POOL = [
  { id: "serve6",   text: "Serve 6 customers",            metric: "served",   goal: 6,   coins: 120, xp: 36 },
  { id: "serve10",  text: "Serve 10 customers",           metric: "served",   goal: 10,  coins: 180, xp: 52 },
  { id: "perfect3", text: "Cook 3 perfect dishes",        metric: "perfect",  goal: 3,   coins: 140, xp: 44 },
  { id: "cook8",    text: "Prepare 8 orders",             metric: "cooked",   goal: 8,   coins: 130, xp: 40 },
  { id: "earn300",  text: "Earn 300 coins from service",  metric: "earned",   goal: 300, coins: 150, xp: 46 },
  { id: "pet5",     text: "Pet your animals 5 times",     metric: "petted",   goal: 5,   coins: 90,  xp: 28 },
  { id: "five2",    text: "Collect 2 five-star reviews",  metric: "reviews5", goal: 2,   coins: 160, xp: 50 },
  { id: "visit1",   text: "Visit another player's café",  metric: "visits",   goal: 1,   coins: 110, xp: 34 },
  { id: "like1",    text: "Leave a heart on a café",      metric: "likesGiven", goal: 1, coins: 100, xp: 30 },
  { id: "restock",  text: "Restock the pantry once",      metric: "restocks", goal: 1,   coins: 80,  xp: 24 },
  { id: "place1",   text: "Place a new piece of furniture", metric: "placed", goal: 1,   coins: 110, xp: 32 },
  { id: "feed2",    text: "Feed your animals twice",      metric: "fed",      goal: 2,   coins: 100, xp: 30 }
];

export const ACHIEVEMENTS = [
  { id: "first",     name: "First Customer",   text: "Serve your first customer",       metric: "served",    goal: 1,    coins: 60 },
  { id: "served10",  name: "Warm Welcome",     text: "Serve 10 customers",              metric: "served",    goal: 10,   coins: 100 },
  { id: "served50",  name: "Local Favourite",  text: "Serve 50 customers",              metric: "served",    goal: 50,   coins: 240 },
  { id: "served200", name: "Institution",      text: "Serve 200 customers",             metric: "served",    goal: 200,  coins: 700 },
  { id: "perfect10", name: "Steady Hands",     text: "Cook 10 perfect dishes",          metric: "perfect",   goal: 10,   coins: 140 },
  { id: "perfect50", name: "Pastry Perfection","text": "Cook 50 perfect dishes",         metric: "perfect",   goal: 50,   coins: 420 },
  { id: "cook100",   name: "Kitchen Regular",  text: "Prepare 100 orders",              metric: "cooked",    goal: 100,  coins: 320 },
  { id: "earn5000",  name: "Good Business",    text: "Earn 5,000 coins from service",   metric: "earned",    goal: 5000, coins: 600 },
  { id: "level5",    name: "Growing Café",     text: "Reach café level 5",              metric: "level",     goal: 5,    coins: 220 },
  { id: "level10",   name: "The Talk of Town", text: "Reach café level 10",             metric: "level",     goal: 10,   coins: 500 },
  { id: "level20",   name: "Café Royalty",     text: "Reach café level 20",             metric: "level",     goal: 20,   coins: 1200 },
  { id: "pets5",     name: "Animal Friend",    text: "Adopt 5 animals",                  metric: "animals",   goal: 5,    coins: 160 },
  { id: "pets15",    name: "Full House",       text: "Adopt 15 animals",                 metric: "animals",   goal: 15,   coins: 420 },
  { id: "pets24",    name: "Menagerie",        text: "Adopt 24 animals",                 metric: "animals",   goal: 24,   coins: 900 },
  { id: "pet50",     name: "Gentle Hands",     text: "Pet your animals 50 times",        metric: "petted",    goal: 50,   coins: 180 },
  { id: "reviews10", name: "Five Star Café",   text: "Collect 10 five-star reviews",     metric: "reviews5",  goal: 10,   coins: 300 },
  { id: "expand",    name: "Room to Grow",     text: "Build the Garden Terrace",         metric: "expansions",goal: 1,    coins: 240 },
  { id: "decorator", name: "Taste Maker",      text: "Place 20 pieces of furniture",     metric: "placed",    goal: 20,   coins: 260 },
  { id: "liked",     name: "Well Loved",       text: "Receive 10 hearts from visitors",  metric: "likes",     goal: 10,   coins: 280 },
  { id: "explorer",  name: "Café Hopper",      text: "Visit 5 other cafés",              metric: "visits",    goal: 5,    coins: 240 },
  { id: "competitor",name: "On the Podium",    text: "Enter a weekly competition",       metric: "entered",   goal: 1,    coins: 200 },
  { id: "mythical",  name: "A Legend Appears","text": "Adopt a mythical animal",         metric: "mythical",  goal: 1,    coins: 800 }
];

export const DAILY_REWARDS = [90, 120, 150, 200, 260, 340, 480];

export const CUSTOMER_NAMES = ["Bun", "Miso", "Bruno", "Poppy", "Fin", "Quack", "Bamboo", "Rascal", "Willow", "Pebble"];

/* Unlockable café areas. */
export const EXPANSIONS = [
  { id: 1, name: "Garden Terrace", text: "Add 3 m of patio for more tables.", price: 1200, level: 3 },
  { id: 2, name: "Rose Garden",    text: "Another 3 m of sunny garden seating.", price: 2600, level: 7 },
  { id: 3, name: "Orchard Nook",   text: "A final 3 m under the fruit trees.", price: 4800, level: 12 }
];

export const TIPS = [
  "Click a customer's speech bubble to take their order, then cook it at the right station.",
  "A table needs a chair beside it before anyone can sit down.",
  "Perfect timing in the cooking meter means bigger tips.",
  "Your animals get happier when you pet them. Happy animals bring good reviews.",
  "Place plants and lamps to raise the café's ambience — guests tip more in a pretty room.",
  "The Garden Terrace expansion unlocks at level 3.",
  "Five-star reviews unlock the mythical Starburst fox.",
  "Enter the weekly competition from the Discover screen."
];
