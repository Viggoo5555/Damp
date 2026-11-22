/* =====================================================================
   BAKE OFF! — the recipe book
   Themes, recipes, ingredients, decoration parts, chef cosmetics,
   achievements and challenges all live here. Nothing in this file
   touches the DOM or the network; it is pure content.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Rarity / weighting helpers
   --------------------------------------------------------------------- */
export const LEVEL_XP = (() => {
  const table = [0];
  let need = 240;
  for (let i = 1; i <= 60; i++) { table.push(table[i - 1] + need); need = Math.round(need * 1.14); }
  return table;
})();

export function levelInfo(xp) {
  const value = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  while (level < 60 && value >= LEVEL_XP[level]) level++;
  const floor = LEVEL_XP[level - 1] || 0;
  const next = LEVEL_XP[Math.min(59, level)] || floor + 1;
  return { level, floor, next, into: value - floor, span: Math.max(1, next - floor), progress: Math.min(1, (value - floor) / Math.max(1, next - floor)) };
}

/* ---------------------------------------------------------------------
   Ingredients. `kind` drives both the 3D model and the pour behaviour.
   --------------------------------------------------------------------- */
export const INGREDIENTS = [
  { id: "flour", name: "Flour", kind: "powder", color: "#f6efe0", cost: 6, tags: ["classic"], model: "sack" },
  { id: "sugar", name: "Caster sugar", kind: "powder", color: "#fdfaf2", cost: 6, tags: ["sweet", "classic"], model: "jar" },
  { id: "butter", name: "Butter", kind: "solid", color: "#f5dc9a", cost: 9, tags: ["rich", "classic"], model: "block" },
  { id: "eggs", name: "Eggs", kind: "solid", color: "#f2d3a8", cost: 8, tags: ["classic"], model: "egg" },
  { id: "milk", name: "Milk", kind: "liquid", color: "#fbf8f0", cost: 7, tags: ["classic"], model: "bottle" },
  { id: "cocoa", name: "Cocoa", kind: "powder", color: "#6b4230", cost: 12, tags: ["chocolate", "rich"], model: "pouch" },
  { id: "vanilla", name: "Vanilla", kind: "liquid", color: "#e8d3a6", cost: 10, tags: ["classic", "sweet"], model: "vial" },
  { id: "cream", name: "Double cream", kind: "liquid", color: "#fdf6e8", cost: 11, tags: ["rich", "creamy"], model: "jug" },
  { id: "strawberry", name: "Strawberries", kind: "solid", color: "#e0516b", cost: 13, tags: ["fruity", "berry"], model: "berry" },
  { id: "chocolate", name: "Dark chocolate", kind: "solid", color: "#4a2c22", cost: 14, tags: ["chocolate", "rich"], model: "bar" },
  { id: "lemon", name: "Lemon", kind: "solid", color: "#f2d35c", cost: 9, tags: ["citrus", "fresh"], model: "citrus" },
  { id: "cinnamon", name: "Cinnamon", kind: "powder", color: "#b47a45", cost: 8, tags: ["spiced", "cosy"], model: "jar" },
  { id: "matcha", name: "Matcha", kind: "powder", color: "#8fae6f", cost: 15, tags: ["fresh", "earth"], model: "pouch" },
  { id: "pistachio", name: "Pistachio", kind: "solid", color: "#a8c47a", cost: 16, tags: ["nutty", "fresh"], model: "nut" },
  { id: "raspberry", name: "Raspberries", kind: "solid", color: "#c33a63", cost: 14, tags: ["berry", "fruity"], model: "berry" },
  { id: "honey", name: "Honey", kind: "liquid", color: "#e2a949", cost: 12, tags: ["sweet", "floral"], model: "jug" },
  { id: "walnut", name: "Walnuts", kind: "solid", color: "#b08a5e", cost: 12, tags: ["nutty", "cosy"], model: "nut" },
  { id: "carrot", name: "Carrot", kind: "solid", color: "#e8873c", cost: 8, tags: ["cosy", "earth"], model: "carrot" }
];
export const ingredientById = (id) => INGREDIENTS.find((i) => i.id === id) || INGREDIENTS[0];

/* ---------------------------------------------------------------------
   Recipes — 28 of them across ten baking families.
   `tone` is the sponge, `accent` the filling, `bake` the ideal seconds.
   --------------------------------------------------------------------- */
const R = (id, name, kind, level, tone, accent, tags, ingredients, blurb, bake = 30) =>
  ({ id, name, kind, level, tone, accent, tags, ingredients, blurb, bake });

export const RECIPES = [
  R("birthday-vanilla", "Birthday Vanilla Cake", "cake", 1, "#f3dfb6", "#f7c9d5", ["classic", "vanilla", "party"], ["flour", "sugar", "butter", "eggs", "milk", "vanilla"], "Three soft vanilla layers, the cake everyone remembers.", 30),
  R("chocolate-fudge", "Chocolate Fudge Cake", "cake", 1, "#5a3627", "#3f2419", ["chocolate", "rich"], ["flour", "sugar", "cocoa", "eggs", "butter", "chocolate"], "Dark, damp and unapologetically fudgy.", 32),
  R("strawberry-cream", "Strawberry Cream Cake", "cake", 2, "#f4e2bd", "#f3b6c4", ["berry", "fruity", "creamy"], ["flour", "sugar", "eggs", "cream", "strawberry", "vanilla"], "Vanilla sponge, whipped cream and ripe strawberries.", 30),
  R("red-velvet", "Red Velvet Cake", "cake", 3, "#a63b45", "#f8f2e6", ["chocolate", "sweet", "classic"], ["flour", "sugar", "cocoa", "butter", "milk", "vanilla"], "Crimson crumb with a whisper of cocoa.", 31),
  R("lemon-drizzle", "Lemon Drizzle Loaf", "cake", 2, "#f5e7ad", "#f6d96a", ["citrus", "fresh"], ["flour", "sugar", "butter", "eggs", "lemon"], "Sharp, sticky and impossible to stop eating.", 28),
  R("carrot-walnut", "Carrot & Walnut Cake", "cake", 3, "#d9944f", "#f9f0dd", ["cosy", "nutty", "spiced"], ["flour", "sugar", "carrot", "walnut", "cinnamon", "eggs"], "Warm spice, toasted walnuts, cream cheese frosting.", 33),
  R("black-forest", "Black Forest Gâteau", "cake", 5, "#4c2f24", "#fbf4e6", ["chocolate", "berry", "rich"], ["cocoa", "flour", "sugar", "chocolate", "cream", "raspberry"], "Chocolate, cream and dark fruit in perfect order.", 34),
  R("wedding-tier", "Wedding Tier Cake", "cake", 6, "#f8f1df", "#f6e6c8", ["classic", "floral", "luxury"], ["flour", "sugar", "butter", "eggs", "vanilla", "cream"], "Three ivory tiers built to be photographed.", 38),
  R("cheesecake-classic", "New York Cheesecake", "cheesecake", 2, "#f7ecd2", "#e8c98d", ["creamy", "classic", "rich"], ["cream", "sugar", "eggs", "flour", "butter", "vanilla"], "Dense, smooth, with a buttery biscuit base.", 36),
  R("cheesecake-berry", "Berry Cheesecake", "cheesecake", 4, "#f8ecd8", "#d4496b", ["berry", "creamy", "fruity"], ["cream", "sugar", "eggs", "raspberry", "strawberry", "butter"], "A crimson fruit swirl through vanilla cream.", 36),
  R("vanilla-cupcake", "Vanilla Cupcake", "cupcake", 1, "#f5e3bb", "#f9cfda", ["vanilla", "sweet", "party"], ["flour", "sugar", "butter", "eggs", "milk", "vanilla"], "A swirled little cloud in a paper case.", 18),
  R("chocolate-cupcake", "Chocolate Cupcake", "cupcake", 1, "#5d3a2a", "#3c2418", ["chocolate", "rich"], ["flour", "sugar", "cocoa", "eggs", "butter", "milk"], "Deep cocoa crumb under a glossy cap.", 18),
  R("rainbow-cupcake", "Rainbow Cupcake", "cupcake", 4, "#f7ead0", "#f19bae", ["party", "fruity", "sweet"], ["flour", "sugar", "butter", "eggs", "vanilla", "raspberry"], "Six thin layers of colour in one case.", 19),
  R("choc-chip-cookie", "Choc Chip Cookie", "cookie", 1, "#d8a761", "#4a2c22", ["chocolate", "classic", "cosy"], ["flour", "sugar", "butter", "eggs", "chocolate", "vanilla"], "Crisp edge, molten middle, big chips.", 14),
  R("sugar-cookie", "Sugar Cookie", "cookie", 1, "#f1dcaa", "#f7c6d2", ["classic", "sweet"], ["flour", "sugar", "butter", "eggs", "vanilla"], "The blank canvas of the biscuit world.", 12),
  R("macadamia-cookie", "White Choc Macadamia", "cookie", 3, "#e0b878", "#f7edd8", ["nutty", "sweet", "rich"], ["flour", "sugar", "butter", "walnut", "vanilla", "honey"], "Buttery, nutty, dangerously moreish.", 15),
  R("glazed-donut", "Glazed Donut", "donut", 1, "#e8b676", "#f8cede", ["sweet", "party"], ["flour", "sugar", "milk", "butter", "eggs", "vanilla"], "Pillowy dough under a crackly sugar glaze.", 16),
  R("chocolate-donut", "Chocolate Donut", "donut", 2, "#d9a86a", "#4a2c22", ["chocolate", "rich"], ["flour", "sugar", "milk", "butter", "cocoa", "chocolate"], "Dipped in dark chocolate, no regrets.", 16),
  R("strawberry-donut", "Strawberry Sprinkle Donut", "donut", 3, "#e8b676", "#ef93ac", ["berry", "party", "sweet"], ["flour", "sugar", "milk", "butter", "strawberry", "vanilla"], "Pink glaze, a storm of sprinkles.", 16),
  R("buttermilk-pancakes", "Buttermilk Pancakes", "pancake", 1, "#e5b877", "#e0a949", ["cosy", "classic", "sweet"], ["flour", "sugar", "milk", "eggs", "butter", "honey"], "A tall, wobbly stack with honey.", 12),
  R("banana-pancakes", "Banana Pancakes", "pancake", 2, "#dcb277", "#e6c169", ["fruity", "cosy", "sweet"], ["flour", "sugar", "milk", "eggs", "honey", "cinnamon"], "Caramelised banana folded through the batter.", 12),
  R("belgian-waffle", "Belgian Waffle", "waffle", 1, "#dba95f", "#e8bb6d", ["cosy", "classic", "sweet"], ["flour", "sugar", "milk", "eggs", "butter", "vanilla"], "Deep pockets, crisp shell, soft centre.", 14),
  R("chocolate-waffle", "Chocolate Waffle", "waffle", 3, "#a9733f", "#5a3627", ["chocolate", "rich", "cosy"], ["flour", "sugar", "milk", "eggs", "cocoa", "chocolate"], "Cocoa batter, chocolate drizzle, berries.", 14),
  R("fudge-brownie", "Fudge Brownie", "brownie", 1, "#4a2c22", "#3a1f16", ["chocolate", "rich", "cosy"], ["chocolate", "butter", "sugar", "eggs", "cocoa", "flour"], "A paper-thin crust over pure fudge.", 24),
  R("blondie", "White Chocolate Blondie", "brownie", 2, "#e0bd84", "#f7edd6", ["sweet", "rich", "nutty"], ["flour", "sugar", "butter", "eggs", "chocolate", "walnut"], "Caramel-sweet, studded with white chocolate.", 24),
  R("vanilla-macaron", "Vanilla Macaron", "macaron", 3, "#f6e4c6", "#fbf3e3", ["classic", "sweet", "floral"], ["flour", "sugar", "eggs", "cream", "vanilla"], "Featherlight shells, silky ganache.", 20),
  R("pistachio-macaron", "Pistachio Macaron", "macaron", 5, "#dcE8c2", "#b9d29a", ["nutty", "fresh"], ["flour", "sugar", "eggs", "cream", "pistachio"], "Pale green, intensely nutty.", 20),
  R("raspberry-macaron", "Raspberry Macaron", "macaron", 4, "#f8d3dd", "#c33a63", ["berry", "fruity", "floral"], ["flour", "sugar", "eggs", "cream", "raspberry"], "Tart jam against sweet almond shell.", 20)
];
export const recipeById = (id) => RECIPES.find((r) => r.id === id) || RECIPES[0];
export const recipesForKind = (kind) => RECIPES.filter((r) => r.kind === kind);

/* ---------------------------------------------------------------------
   Frosting colours
   --------------------------------------------------------------------- */
export const FROSTINGS = [
  { id: "vanilla", name: "Vanilla", color: "#fbf1dd", tags: ["classic", "sweet"] },
  { id: "blush", name: "Blush", color: "#f7c3d0", tags: ["party", "floral", "sweet"] },
  { id: "rose", name: "Rose", color: "#e2879b", tags: ["floral", "berry", "luxury"] },
  { id: "chocolate", name: "Chocolate", color: "#5c3a2a", tags: ["chocolate", "rich", "cosy"] },
  { id: "caramel", name: "Caramel", color: "#d29b5c", tags: ["cosy", "sweet"] },
  { id: "lemon", name: "Lemon", color: "#f5dd8a", tags: ["citrus", "fresh", "sweet"] },
  { id: "mint", name: "Mint", color: "#b9dfcd", tags: ["fresh", "floral"] },
  { id: "sky", name: "Sky", color: "#b9d5e8", tags: ["dreamy", "cool", "party"] },
  { id: "lilac", name: "Lilac", color: "#cfc1e6", tags: ["dreamy", "floral", "fantasy"] },
  { id: "pistachio", name: "Pistachio", color: "#cfddb1", tags: ["nutty", "fresh"] },
  { id: "coral", name: "Coral", color: "#f5a48f", tags: ["tropical", "fruity", "party"] },
  { id: "noir", name: "Midnight", color: "#4b4458", tags: ["luxury", "cool", "fantasy"] }
];
export const frostingById = (id) => FROSTINGS.find((f) => f.id === id) || FROSTINGS[0];

/* ---------------------------------------------------------------------
   Toppings
   --------------------------------------------------------------------- */
export const TOPPINGS = [
  { id: "strawberry", name: "Strawberry", tags: ["berry", "fruity"], model: "strawberry", color: "#d9425f" },
  { id: "raspberry", name: "Raspberries", tags: ["berry", "fruity"], model: "raspberry", color: "#b8305a" },
  { id: "blueberry", name: "Blueberries", tags: ["berry", "fresh"], model: "blueberry", color: "#5869a8" },
  { id: "cherry", name: "Cherries", tags: ["fruity", "retro"], model: "cherry", color: "#a8253a" },
  { id: "chocolate", name: "Chocolate shards", tags: ["chocolate", "rich"], model: "shard", color: "#4a2c22" },
  { id: "macaron", name: "Mini macarons", tags: ["party", "sweet", "luxury"], model: "macaron", color: "#f2b7c5" },
  { id: "mint", name: "Mint leaves", tags: ["fresh", "garden"], model: "leaf", color: "#6f9c62" },
  { id: "lemon", name: "Lemon slices", tags: ["citrus", "fresh"], model: "lemon", color: "#f1d55f" },
  { id: "sprinkles", name: "Sprinkles", tags: ["party", "rainbow"], model: "sprinkles", color: "#ef8fb0" },
  { id: "gold", name: "Gold leaf", tags: ["luxury", "floral"], model: "gold", color: "#e5c168" },
  { id: "candle", name: "Candles", tags: ["party", "birthday"], model: "candle", color: "#f7e7c8" },
  { id: "star", name: "Sugar stars", tags: ["dreamy", "party"], model: "star", color: "#f3dc8b" },
  { id: "marshmallow", name: "Marshmallows", tags: ["cosy", "sweet"], model: "marshmallow", color: "#fdf4ec" },
  { id: "wafer", name: "Wafer curls", tags: ["chocolate", "cosy"], model: "wafer", color: "#c08f57" },
  { id: "rose", name: "Sugar roses", tags: ["floral", "luxury"], model: "rose", color: "#e9a3b5" },
  { id: "pearl", name: "Edible pearls", tags: ["luxury", "dreamy"], model: "pearl", color: "#f0e4d4" }
];
export const toppingById = (id) => TOPPINGS.find((t) => t.id === id) || TOPPINGS[0];

/* ---------------------------------------------------------------------
   Plates and shapes
   --------------------------------------------------------------------- */
export const PLATES = [
  { id: "ceramic", name: "White ceramic", color: "#fbf7ef", rim: "#e6dccb", tags: ["classic"] },
  { id: "gold", name: "Gold rim", color: "#f8f1e2", rim: "#d9b261", tags: ["luxury"] },
  { id: "blush", name: "Blush plate", color: "#f8d8de", rim: "#eebac6", tags: ["party"] },
  { id: "slate", name: "Slate board", color: "#545a60", rim: "#3f4448", tags: ["modern"] },
  { id: "wood", name: "Oak board", color: "#c99b63", rim: "#a87a45", tags: ["cosy"] },
  { id: "marble", name: "Marble", color: "#eeece7", rim: "#d8d2c7", tags: ["luxury"] },
  { id: "glass", name: "Glass stand", color: "#dfeaec", rim: "#c2d3d7", tags: ["luxury"] },
  { id: "lace", name: "Lace doily", color: "#fbf6ea", rim: "#e8dcc6", tags: ["classic"] }
];
export const plateById = (id) => PLATES.find((p) => p.id === id) || PLATES[0];

export const SHAPES = [
  { id: "round", name: "Round", tiers: 1, tags: ["classic"] },
  { id: "square", name: "Square", tiers: 1, tags: ["modern"] },
  { id: "heart", name: "Heart", tiers: 1, tags: ["floral", "love"] },
  { id: "tiered2", name: "Two tiers", tiers: 2, tags: ["luxury", "wedding"] },
  { id: "tiered3", name: "Three tiers", tiers: 3, tags: ["luxury", "wedding"] },
  { id: "sheet", name: "Sheet cake", tiers: 1, tags: ["party", "retro"] }
];
export const shapeById = (id) => SHAPES.find((s) => s.id === id) || SHAPES[0];

export const FROSTING_STYLES = [
  { id: "smooth", name: "Smooth buttercream" },
  { id: "swirl", name: "Swirled" },
  { id: "drip", name: "Drip glaze" },
  { id: "piped", name: "Piped rosettes" },
  { id: "naked", name: "Naked cake" }
];

/* ---------------------------------------------------------------------
   Themes — 54 of them. Each carries a palette the scorer checks.
   --------------------------------------------------------------------- */
const T = (id, name, tags, colors, hint, blurb) => ({ id, name, tags, colors, hint, blurb });

export const THEMES = [
  T("birthday-party", "Birthday Party", ["party", "sweet", "classic"], ["#f7c3d0", "#f5dd8a", "#b9d5e8"], ["candle", "sprinkles", "star"], "Balloons, candles and a cake that has to be tall."),
  T("summer-vacation", "Summer Vacation", ["tropical", "fruity", "fresh"], ["#f5dd8a", "#b9d5e8", "#f5a48f"], ["lemon", "strawberry", "mint"], "Sun-warmed fruit and sea-blue icing."),
  T("dream-wedding", "Dream Wedding", ["floral", "luxury", "classic"], ["#fbf1dd", "#f7c3d0", "#cfc1e6"], ["rose", "pearl", "gold"], "Ivory tiers, sugar roses, quiet luxury."),
  T("halloween", "Halloween", ["cosy", "spiced", "chocolate"], ["#d29b5c", "#4b4458", "#e8873c"], ["chocolate", "star", "wafer"], "Pumpkin spice and something a little wicked."),
  T("christmas", "Christmas", ["cosy", "spiced", "berry"], ["#fbf1dd", "#a8253a", "#6f9c62"], ["raspberry", "mint", "pearl"], "Snowy white, deep red, a sprig of evergreen."),
  T("pink-paradise", "Pink Paradise", ["party", "sweet", "floral"], ["#f7c3d0", "#e2879b", "#fbf1dd"], ["strawberry", "sprinkles", "rose"], "Every shade of pink at once, please."),
  T("chocolate-heaven", "Chocolate Heaven", ["chocolate", "rich", "cosy"], ["#5c3a2a", "#d29b5c", "#fbf1dd"], ["chocolate", "wafer", "gold"], "Three kinds of chocolate and no apologies."),
  T("fantasy-cake", "Fantasy Cake", ["fantasy", "dreamy", "floral"], ["#cfc1e6", "#b9d5e8", "#f7c3d0"], ["star", "pearl", "gold"], "A cake that could only exist in a storybook."),
  T("underwater", "Underwater", ["cool", "dreamy", "fresh"], ["#b9d5e8", "#b9dfcd", "#cfc1e6"], ["pearl", "mint", "blueberry"], "Sea glass colours and a slow blue light."),
  T("rainbow", "Rainbow", ["rainbow", "party", "sweet"], ["#f5dd8a", "#f5a48f", "#b9d5e8"], ["sprinkles", "star", "macaron"], "Six colours in perfect, cheerful order."),
  T("cute-animals", "Cute Animals", ["cosy", "sweet", "retro"], ["#f7c3d0", "#d29b5c", "#fbf1dd"], ["marshmallow", "chocolate", "pearl"], "Little faces, tiny paws, big feelings."),
  T("luxury-restaurant", "Luxury Restaurant", ["luxury", "modern", "rich"], ["#4b4458", "#e5c168", "#fbf1dd"], ["gold", "pearl", "chocolate"], "Plated like a tasting menu, priced like one too."),
  T("spring-garden", "Spring Garden", ["garden", "floral", "fresh"], ["#cfddb1", "#f7c3d0", "#fbf1dd"], ["mint", "rose", "lemon"], "Fresh petals and the first warm afternoon."),
  T("autumn-harvest", "Autumn Harvest", ["cosy", "spiced", "nutty"], ["#d29b5c", "#e8873c", "#5c3a2a"], ["wafer", "cherry", "lemon"], "Cinnamon, walnuts and golden leaves."),
  T("winter-wonderland", "Winter Wonderland", ["cool", "dreamy", "luxury"], ["#fbf1dd", "#b9d5e8", "#cfc1e6"], ["pearl", "mint", "gold"], "Frosted white with a cold blue gleam."),
  T("tropical-island", "Tropical Island", ["tropical", "fruity", "fresh"], ["#f5a48f", "#f5dd8a", "#b9dfcd"], ["lemon", "strawberry", "mint"], "Pineapple, mango and a tiny paper umbrella."),
  T("galaxy", "Galaxy", ["fantasy", "cool", "luxury"], ["#4b4458", "#cfc1e6", "#b9d5e8"], ["star", "gold", "pearl"], "Midnight icing scattered with stars."),
  T("unicorn", "Unicorn", ["fantasy", "rainbow", "sweet"], ["#f7c3d0", "#cfc1e6", "#b9dfcd"], ["sprinkles", "star", "macaron"], "Pastel mane, golden horn, absurdly charming."),
  T("princess", "Princess", ["floral", "luxury", "party"], ["#f7c3d0", "#fbf1dd", "#e5c168"], ["rose", "pearl", "gold"], "Tulle, pearls, and a cake with a tiara."),
  T("dinosaur", "Dinosaur", ["garden", "retro", "party"], ["#cfddb1", "#8fae6f", "#d29b5c"], ["mint", "chocolate", "star"], "Ferns, fossils and a very green frosting."),
  T("pirate", "Pirate", ["retro", "chocolate", "cosy"], ["#d29b5c", "#4b4458", "#a8253a"], ["gold", "chocolate", "cherry"], "Treasure-map browns and a gold coin or two."),
  T("space-station", "Space Station", ["cool", "modern", "fantasy"], ["#b9d5e8", "#fbf1dd", "#4b4458"], ["star", "pearl", "gold"], "Clean panels, cold light, one floating star."),
  T("fairy-forest", "Fairy Forest", ["garden", "fantasy", "fresh"], ["#cfddb1", "#6f9c62", "#f7c3d0"], ["mint", "rose", "pearl"], "Mossy greens lit by tiny lanterns."),
  T("strawberry-fields", "Strawberry Fields", ["berry", "fruity", "sweet"], ["#d9425f", "#f7c3d0", "#fbf1dd"], ["strawberry", "raspberry", "mint"], "Nothing but berries, as far as you can see."),
  T("lemon-sunshine", "Lemon Sunshine", ["citrus", "fresh", "sweet"], ["#f5dd8a", "#fbf1dd", "#f5a48f"], ["lemon", "mint", "pearl"], "Sharp yellow and a lot of daylight."),
  T("midnight-velvet", "Midnight Velvet", ["luxury", "cool", "rich"], ["#4b4458", "#5c3a2a", "#e5c168"], ["gold", "chocolate", "cherry"], "Deep navy, velvet texture, gold edge."),
  T("coffee-shop", "Coffee Shop", ["cosy", "rich", "classic"], ["#d29b5c", "#5c3a2a", "#fbf1dd"], ["wafer", "chocolate", "pearl"], "Warm browns and the smell of espresso."),
  T("tea-party", "Tea Party", ["classic", "floral", "sweet"], ["#fbf1dd", "#f7c3d0", "#cfddb1"], ["rose", "macaron", "pearl"], "Tiny sandwiches, proper cups, one tall cake."),
  T("circus", "Circus", ["retro", "party", "rainbow"], ["#a8253a", "#f5dd8a", "#fbf1dd"], ["sprinkles", "star", "cherry"], "Striped tents and a drumroll."),
  T("carnival", "Carnival", ["party", "tropical", "rainbow"], ["#f5a48f", "#f5dd8a", "#b9d5e8"], ["sprinkles", "star", "macaron"], "Neon feathers and too much sugar."),
  T("easter", "Easter", ["garden", "sweet", "floral"], ["#cfddb1", "#f7c3d0", "#f5dd8a"], ["pearl", "mint", "sprinkles"], "Soft greens, tiny eggs, spring light."),
  T("valentines", "Valentine's Day", ["floral", "berry", "love"], ["#e2879b", "#a8253a", "#fbf1dd"], ["rose", "raspberry", "pearl"], "Hearts, cream and a little romance."),
  T("mothers-day", "Mother's Day", ["floral", "garden", "classic"], ["#f7c3d0", "#cfddb1", "#fbf1dd"], ["rose", "mint", "gold"], "A bouquet you can eat."),
  T("fathers-day", "Father's Day", ["cosy", "chocolate", "retro"], ["#5c3a2a", "#d29b5c", "#4b4458"], ["chocolate", "wafer", "gold"], "Dark chocolate, no fuss, extra portion."),
  T("graduation", "Graduation", ["party", "modern", "classic"], ["#4b4458", "#f5dd8a", "#fbf1dd"], ["gold", "star", "chocolate"], "Caps, scrolls and a very proud cake."),
  T("baby-shower", "Baby Shower", ["sweet", "dreamy", "floral"], ["#b9d5e8", "#f7c3d0", "#fbf1dd"], ["pearl", "marshmallow", "star"], "Powder blue, blush and soft clouds."),
  T("retro-diner", "Retro Diner", ["retro", "party", "sweet"], ["#f5a48f", "#b9d5e8", "#fbf1dd"], ["cherry", "sprinkles", "macaron"], "Chrome edges and a cherry on top."),
  T("parisian", "Parisian", ["luxury", "classic", "floral"], ["#fbf1dd", "#4b4458", "#e2879b"], ["gold", "rose", "macaron"], "Pale pastry, black coffee, perfect posture."),
  T("sakura", "Sakura Season", ["floral", "fresh", "dreamy"], ["#f7c3d0", "#fbf1dd", "#cfc1e6"], ["rose", "pearl", "mint"], "Cherry blossom drifting onto pale icing."),
  T("fiesta", "Mexican Fiesta", ["tropical", "party", "rainbow"], ["#f5a48f", "#f5dd8a", "#6f9c62"], ["lemon", "sprinkles", "cherry"], "Paper flowers, bright paper, louder colours."),
  T("blueberry-hill", "Blueberry Hill", ["berry", "cosy", "fresh"], ["#5869a8", "#cfc1e6", "#fbf1dd"], ["blueberry", "pearl", "mint"], "Indigo berries and cool cream."),
  T("caramel-cloud", "Caramel Cloud", ["sweet", "cosy", "rich"], ["#d29b5c", "#fbf1dd", "#f5a48f"], ["marshmallow", "wafer", "gold"], "Salted caramel in pillowy whipped cream."),
  T("mint-chocolate", "Mint Chocolate", ["fresh", "chocolate", "cool"], ["#b9dfcd", "#4a2c22", "#fbf1dd"], ["chocolate", "mint", "pearl"], "Cool green against dark chocolate."),
  T("rose-gold", "Rose Gold", ["luxury", "floral", "modern"], ["#e8b9a4", "#e5c168", "#fbf1dd"], ["gold", "rose", "pearl"], "Metallic petals and a mirror glaze."),
  T("black-forest-theme", "Black Forest", ["chocolate", "berry", "rich"], ["#4a2c22", "#a8253a", "#fbf1dd"], ["cherry", "chocolate", "wafer"], "Dark cherries, cream and chocolate shavings."),
  T("lemon-meringue", "Lemon Meringue", ["citrus", "sweet", "retro"], ["#f5dd8a", "#fbf1dd", "#d29b5c"], ["lemon", "pearl", "gold"], "Torched peaks over sharp lemon curd."),
  T("smores", "S'mores Campfire", ["cosy", "chocolate", "retro"], ["#d29b5c", "#5c3a2a", "#fbf1dd"], ["marshmallow", "chocolate", "wafer"], "Toast, chocolate and a burnt marshmallow."),
  T("beach-bonfire", "Beach Bonfire", ["tropical", "cosy", "party"], ["#f5a48f", "#b9d5e8", "#f5dd8a"], ["lemon", "marshmallow", "star"], "Salt air, sunset colours, sand between plates."),
  T("movie-night", "Movie Night", ["retro", "cosy", "chocolate"], ["#4b4458", "#f5dd8a", "#a8253a"], ["chocolate", "star", "cherry"], "Popcorn, dim lights and a very big slice."),
  T("farmers-market", "Farmer's Market", ["garden", "fresh", "cosy"], ["#cfddb1", "#e8873c", "#d29b5c"], ["mint", "strawberry", "lemon"], "Whatever looked best this morning."),
  T("snowy-mountain", "Snowy Mountain", ["cool", "cosy", "luxury"], ["#fbf1dd", "#b9d5e8", "#4b4458"], ["pearl", "mint", "chocolate"], "White peaks, pine, woodsmoke."),
  T("fairy-tale-castle", "Fairy Tale Castle", ["fantasy", "floral", "luxury"], ["#cfc1e6", "#f7c3d0", "#e5c168"], ["star", "rose", "gold"], "Turrets made of sugar, obviously."),
  T("neon-party", "Neon Party", ["party", "modern", "rainbow"], ["#b9d5e8", "#f7c3d0", "#4b4458"], ["sprinkles", "star", "gold"], "Black icing and things that glow."),
  T("disco", "Disco Fever", ["retro", "party", "luxury"], ["#e5c168", "#cfc1e6", "#4b4458"], ["gold", "star", "pearl"], "Mirror ball, metallic lustre, all of it."),
  T("candy-shop", "Candy Shop", ["sweet", "rainbow", "party"], ["#f7c3d0", "#f5dd8a", "#b9d5e8"], ["sprinkles", "marshmallow", "macaron"], "Jars floor to ceiling, all of them open."),
  T("sunday-brunch", "Sunday Brunch", ["cosy", "classic", "sweet"], ["#fbf1dd", "#f5dd8a", "#d29b5c"], ["lemon", "mint", "wafer"], "Slow morning, second coffee, something warm.")
];
export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

/* ---------------------------------------------------------------------
   Chef cosmetics
   --------------------------------------------------------------------- */
export const HATS = [
  { id: "toque", name: "Classic toque", price: 0, color: "#fbf7ef" },
  { id: "beret", name: "Pastry beret", price: 320, color: "#e2879b" },
  { id: "bandana", name: "Bandana", price: 260, color: "#b9d5e8" },
  { id: "bow", name: "Big bow", price: 380, color: "#f7c3d0" },
  { id: "crown", name: "Sugar crown", price: 900, color: "#e5c168" },
  { id: "beanie", name: "Cosy beanie", price: 300, color: "#cfddb1" }
];
export const APRONS = [
  { id: "cream", name: "Cream apron", price: 0, color: "#fbf1dd" },
  { id: "blush", name: "Blush apron", price: 240, color: "#f7c3d0" },
  { id: "mint", name: "Mint apron", price: 240, color: "#b9dfcd" },
  { id: "chocolate", name: "Chocolate apron", price: 360, color: "#8a5c42" },
  { id: "gold", name: "Gold-trim apron", price: 780, color: "#e5c168" },
  { id: "denim", name: "Denim apron", price: 300, color: "#8fa6bd" }
];
export const HAIRS = [
  { id: "honey", name: "Honey waves", price: 0, color: "#d8a95f" },
  { id: "chocolate", name: "Chocolate bun", price: 0, color: "#6b4632" },
  { id: "blonde", name: "Long blonde", price: 300, color: "#e8cd8f" },
  { id: "pink", name: "Pink bob", price: 420, color: "#e58ba8" },
  { id: "black", name: "Black curls", price: 0, color: "#3a2c2c" },
  { id: "lilac", name: "Lilac ponytail", price: 520, color: "#b9a6d8" }
];
export const SKINS = ["#f6d9c2", "#eec5a6", "#d9a077", "#b1714e", "#7a4a33"];
export const KITCHENS = [
  { id: "peach", name: "Peach patisserie", price: 0, wall: "#f8dfd3", cabinet: "#f3e6d4", counter: "#fbf7ef", accent: "#e9b9a6" },
  { id: "mint", name: "Mint kitchen", price: 500, wall: "#dcebe1", cabinet: "#f6f5ea", counter: "#f8fbf7", accent: "#b9dfcd" },
  { id: "blue", name: "Blue bakery", price: 620, wall: "#dbe7f1", cabinet: "#f4f1e8", counter: "#fbfcfa", accent: "#b9d5e8" },
  { id: "rose", name: "Rose studio", price: 780, wall: "#f6dfe5", cabinet: "#f9f0e6", counter: "#fdf9f2", accent: "#e9a3b5" }
];
export const EQUIPMENT = [
  { id: "classic", name: "Classic oven", price: 0, color: "#e9e3d6", trim: "#b7a992" },
  { id: "pink", name: "Pink enamel oven", price: 640, color: "#f3c6d0", trim: "#d99aab" },
  { id: "steel", name: "Steel pro oven", price: 980, color: "#c8cdd2", trim: "#8f979e" },
  { id: "gold", name: "Gilded oven", price: 1500, color: "#efe3c8", trim: "#d0ab63" }
];

/* ---------------------------------------------------------------------
   Achievements and challenges
   --------------------------------------------------------------------- */
export const ACHIEVEMENTS = [
  { id: "first-bake", name: "First Bake", desc: "Finish your first bake.", coins: 80, xp: 40, metric: "bakes", goal: 1 },
  { id: "ten-bakes", name: "Getting Warm", desc: "Finish 10 bakes.", coins: 180, xp: 90, metric: "bakes", goal: 10 },
  { id: "fifty-bakes", name: "Head Baker", desc: "Finish 50 bakes.", coins: 700, xp: 380, metric: "bakes", goal: 50 },
  { id: "first-win", name: "Star Baker", desc: "Win a match.", coins: 200, xp: 120, metric: "wins", goal: 1 },
  { id: "five-wins", name: "Serial Winner", desc: "Win 5 matches.", coins: 600, xp: 320, metric: "wins", goal: 5 },
  { id: "podium", name: "On The Podium", desc: "Finish in the top three 10 times.", coins: 420, xp: 220, metric: "podiums", goal: 10 },
  { id: "voter", name: "Generous Judge", desc: "Vote in 10 matches.", coins: 240, xp: 130, metric: "votes", goal: 10 },
  { id: "perfect-bake", name: "Perfect Timing", desc: "Take a bake out at exactly the right moment.", coins: 260, xp: 150, metric: "perfectBakes", goal: 1 },
  { id: "five-stars", name: "Showstopper", desc: "Score 90 or more with one creation.", coins: 500, xp: 300, metric: "bestScore", goal: 90 },
  { id: "themed", name: "On Theme", desc: "Match at least four theme colours or flavours.", coins: 220, xp: 120, metric: "themed", goal: 1 },
  { id: "decorator", name: "Sugar Artist", desc: "Place 200 decorations.", coins: 400, xp: 220, metric: "decorations", goal: 200 },
  { id: "social", name: "Good Company", desc: "Play a match with 4 or more players.", coins: 240, xp: 130, metric: "bigMatches", goal: 1 },
  { id: "collector", name: "Fine China", desc: "Own 4 plates.", coins: 260, xp: 140, metric: "plates", goal: 4 },
  { id: "stylist", name: "Dressed For It", desc: "Own 3 hats.", coins: 240, xp: 130, metric: "hats", goal: 3 },
  { id: "streak", name: "Hot Oven", desc: "Win two matches in a row.", coins: 340, xp: 180, metric: "bestStreak", goal: 2 },
  { id: "night-owl", name: "Late Shift", desc: "Finish a bake after midnight.", coins: 200, xp: 100, metric: "nightBakes", goal: 1 }
];
export const DAILY_POOL = [
  { id: "bake-2", text: "Finish 2 bakes", metric: "dailyBakes", goal: 2, coins: 120, xp: 60 },
  { id: "bake-3", text: "Finish 3 bakes", metric: "dailyBakes", goal: 3, coins: 170, xp: 90 },
  { id: "vote-2", text: "Vote in 2 matches", metric: "dailyVotes", goal: 2, coins: 110, xp: 50 },
  { id: "decor-20", text: "Place 20 decorations", metric: "dailyDecorations", goal: 20, coins: 130, xp: 60 },
  { id: "score-80", text: "Score 80 in one bake", metric: "dailyBestScore", goal: 80, coins: 160, xp: 80 },
  { id: "win-1", text: "Win a match", metric: "dailyWins", goal: 1, coins: 200, xp: 100 },
  { id: "theme-3", text: "Match 3 theme colours", metric: "dailyThemeMatches", goal: 3, coins: 120, xp: 60 },
  { id: "recipe-2", text: "Bake two different recipes", metric: "dailyRecipes", goal: 2, coins: 140, xp: 70 },
  { id: "message-1", text: "Write a message on a cake", metric: "dailyMessages", goal: 1, coins: 100, xp: 50 },
  { id: "candle-1", text: "Add candles to a cake", metric: "dailyCandles", goal: 1, coins: 100, xp: 50 }
];
export const WEEKLY_CHALLENGES = [
  { id: "weekly-bakes", text: "Finish 12 bakes this week", metric: "weekBakes", goal: 12, coins: 600, xp: 300 },
  { id: "weekly-wins", text: "Win 3 matches this week", metric: "weekWins", goal: 3, coins: 800, xp: 400 },
  { id: "weekly-votes", text: "Vote 8 times this week", metric: "weekVotes", goal: 8, coins: 500, xp: 240 },
  { id: "weekly-decor", text: "Place 100 decorations this week", metric: "weekDecorations", goal: 100, coins: 550, xp: 270 }
];

export const DAILY_REWARDS = [80, 110, 150, 200, 260, 340, 480];

/* A small stable hash so daily challenges are the same for everyone on a
   given day without needing a server. */
export function dayKey(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - start) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}
export function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
export function pickDaily(date = new Date()) {
  const seed = seedFrom("bakeoff-" + dayKey(date));
  const pool = DAILY_POOL.slice();
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = (seed >>> (i * 5)) % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
export function pickWeekly(date = new Date()) {
  const seed = seedFrom("bakeoff-week-" + weekKey(date));
  return WEEKLY_CHALLENGES[seed % WEEKLY_CHALLENGES.length];
}

/* ---------------------------------------------------------------------
   Match pacing (seconds). A full match lands around four minutes.
   --------------------------------------------------------------------- */
export const PHASES = [
  { id: "lobby", name: "Gathering", label: "Waiting for bakers", seconds: 0 },
  { id: "theme", name: "Theme", label: "The challenge", seconds: 7 },
  { id: "prepare", name: "Prepare", label: "Weigh and mix", seconds: 62 },
  { id: "bake", name: "Bake", label: "Into the oven", seconds: 50 },
  { id: "decorate", name: "Decorate", label: "Make it beautiful", seconds: 78 },
  { id: "show", name: "Show", label: "Presentation", seconds: 22 },
  { id: "vote", name: "Vote", label: "Pick a favourite", seconds: 26 },
  { id: "results", name: "Results", label: "The verdict", seconds: 30 }
];
export const phaseIndex = (id) => PHASES.findIndex((p) => p.id === id);
export const phaseById = (id) => PHASES.find((p) => p.id === id) || PHASES[0];

export const CHEF_NAMES = ["Luna", "Emma", "Sofie", "Mila", "Noah", "Iris", "Theo", "Ada", "Jonas", "Freja", "Oscar", "Clara"];
export const RIVAL_CHEFS = ["Luna", "Emma", "Sofie", "Mila", "Iris", "Theo", "Ada", "Jonas"];

export const TIPS = [
  "Click a jar to tip an ingredient into the bowl — the recipe card tells you what it wants.",
  "Stop mixing while the needle sits in the thick pink band for a silky batter.",
  "Pull the cake out when the timer hits the golden window. Early is doughy, late is dry.",
  "Theme colours score. Match your frosting to the palette before you start decorating.",
  "Drag a topping onto the cake to place it exactly where you want it.",
  "A written message is worth presentation points and almost always a vote.",
  "Different plates change the whole mood. Slate for modern, gold for luxury.",
  "You cannot vote for yourself — pick the cake you would actually order.",
  "Rivals drop out if they lose connection; their cake still gets judged.",
  "Private rooms use a six-letter code. Share it with friends."
];
