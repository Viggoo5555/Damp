/* =====================================================================
   DREAM PARK — content
   Every ride, shop, decoration, staff role, research node, challenge and
   achievement in the game lives here. Numbers are kept in one place so
   the economy can be tuned without touching the simulation.
   ===================================================================== */

export const GRID = { w: 26, h: 26, tile: 4 };
export const START_TILES = 8;              // radius of unlocked land, in tiles
export const LAND_STEPS = [9, 10, 11, 12];
export const LAND_PRICES = [9000, 18000, 32000, 52000];

/* ---------------------------------------------------------------------
   Rides — 30 attractions
   size: [tiles wide, tiles deep] · fun 0-100 · capacity per cycle
   --------------------------------------------------------------------- */
export const RIDES = [
  { id: "carousel", name: "Carousel", cat: "family", price: 2200, level: 1, size: [3, 3], fun: 52, capacity: 16, cycle: 24, upkeep: 18, model: "carousel", palette: ["#f4b8c8", "#fdf1dc", "#d9a441"], desc: "Hand-painted horses under a striped canopy. The heart of any park." },
  { id: "ferris-wheel", name: "Sky Wheel", cat: "family", price: 8500, level: 3, size: [4, 4], fun: 72, capacity: 24, cycle: 42, upkeep: 42, model: "wheel", palette: ["#8ecae6", "#fdf6ea", "#f28f3b"], desc: "A slow turn above the treetops with gondolas that sway." },
  { id: "teacups", name: "Spinning Teacups", cat: "family", price: 3200, level: 2, size: [3, 3], fun: 50, capacity: 12, cycle: 22, upkeep: 22, model: "teacups", palette: ["#f7c3d0", "#fff8ee", "#d76a8a"], desc: "Six cups, one manic spin. Best enjoyed before lunch." },
  { id: "swing-ride", name: "Wave Swinger", cat: "thrill", price: 6800, level: 4, size: [3, 3], fun: 68, capacity: 20, cycle: 26, upkeep: 34, model: "swing", palette: ["#b7d8c4", "#fdf6ea", "#e07a5f"], desc: "Chairs lift and tilt as the canopy turns. A park classic." },
  { id: "bumper-cars", name: "Dodgems", cat: "family", price: 5400, level: 3, size: [4, 4], fun: 61, capacity: 12, cycle: 28, upkeep: 30, model: "bumper", palette: ["#f2cc8f", "#e9f5f1", "#3d5a80"], desc: "Little electric cars, a lot of small collisions." },
  { id: "drop-tower", name: "Drop Tower", cat: "thrill", price: 12000, level: 6, size: [3, 3], fun: 82, capacity: 12, cycle: 30, upkeep: 54, model: "tower", palette: ["#ef476f", "#ffe8d6", "#118ab2"], desc: "Forty metres up, two seconds down. The queue will tell you." },
  { id: "log-flume", name: "Log Flume", cat: "water", price: 14500, level: 7, size: [5, 5], fun: 79, capacity: 16, cycle: 46, upkeep: 62, model: "flume", palette: ["#61a5c2", "#e8f4f8", "#8a5a44"], desc: "A lazy float that ends in a soaking drop." },
  { id: "pirate-ship", name: "Pirate Ship", cat: "thrill", price: 9800, level: 5, size: [4, 3], fun: 74, capacity: 20, cycle: 32, upkeep: 44, model: "ship", palette: ["#8a5a44", "#f5e6c8", "#c1121f"], desc: "A galleon on a pendulum, swinging higher than it looks." },
  { id: "kiddie-elephants", name: "Flying Elephants", cat: "kiddie", price: 1800, level: 1, size: [3, 3], fun: 38, capacity: 8, cycle: 20, upkeep: 12, model: "kiddie", palette: ["#cdb4db", "#fff3f6", "#8e7dbe"], desc: "A gentle circle for the smallest visitors." },
  { id: "mini-train", name: "Park Railway", cat: "transport", price: 4200, level: 2, size: [5, 4], fun: 44, capacity: 20, cycle: 52, upkeep: 26, model: "train", palette: ["#c1121f", "#f4e3c1", "#2a9d8f"], desc: "A little steam train that loops the gardens." },
  { id: "custom-coaster", name: "Custom Coaster", cat: "coaster", price: 18000, level: 5, size: [6, 6], fun: 88, capacity: 12, cycle: 55, upkeep: 80, model: "coaster", palette: ["#e76f51", "#fdf0d5", "#264653"], desc: "Design the layout yourself, then ride the physics you built." },
  { id: "mine-coaster", name: "Mine Train", cat: "coaster", price: 16500, level: 8, size: [5, 5], fun: 84, capacity: 14, cycle: 50, upkeep: 74, model: "coaster", palette: ["#8d6e63", "#e7d8c3", "#b08968"], desc: "A rattling run through the old quarry, drops and all." },
  { id: "haunted-house", name: "Haunted House", cat: "dark", price: 7200, level: 3, size: [4, 4], fun: 66, capacity: 10, cycle: 40, upkeep: 36, model: "house", palette: ["#6d597a", "#efe6dd", "#b56576"], desc: "Creaking doors, glowing windows and a very patient ghost." },
  { id: "fun-house", name: "Fun House", cat: "family", price: 3800, level: 2, size: [3, 3], fun: 50, capacity: 10, cycle: 30, upkeep: 20, model: "house", palette: ["#ffd166", "#f7f3e8", "#ef476f"], desc: "Wonky floors, mirrors and a slide out the back." },
  { id: "mirror-maze", name: "Mirror Maze", cat: "family", price: 2600, level: 2, size: [3, 3], fun: 45, capacity: 8, cycle: 26, upkeep: 16, model: "house", palette: ["#a8dadc", "#f1faee", "#457b9d"], desc: "Find your way out. Some guests take a while." },
  { id: "cinema", name: "4D Cinema", cat: "family", price: 9000, level: 5, size: [4, 4], fun: 58, capacity: 24, cycle: 44, upkeep: 48, model: "cinema", palette: ["#3d405b", "#f4f1de", "#e07a5f"], desc: "A cool dark room and a seat that moves. A hit on hot days." },
  { id: "arcade", name: "Arcade", cat: "family", price: 6400, level: 4, size: [4, 4], fun: 62, capacity: 14, cycle: 32, upkeep: 38, model: "arcade", palette: ["#242038", "#f6e7cb", "#f25f5c"], desc: "Cabinets, neon and the smell of popcorn." },
  { id: "water-slide", name: "Water Slide", cat: "water", price: 11500, level: 6, size: [4, 5], fun: 76, capacity: 10, cycle: 38, upkeep: 58, model: "slide", palette: ["#4cc9f0", "#e9f7ff", "#f72585"], desc: "A tower, a twist and a very welcome splash." },
  { id: "splash-battle", name: "Splash Battle", cat: "water", price: 8200, level: 5, size: [4, 4], fun: 70, capacity: 12, cycle: 34, upkeep: 46, model: "pool", palette: ["#48cae4", "#e8f8ff", "#ffb703"], desc: "Boats, water cannons and a lot of shrieking." },
  { id: "rapids", name: "River Rapids", cat: "water", price: 15500, level: 8, size: [5, 5], fun: 80, capacity: 16, cycle: 48, upkeep: 66, model: "rapids", palette: ["#3fa7a0", "#e6f7f4", "#f4a261"], desc: "Round rafts on a churning channel. Everyone gets wet." },
  { id: "observation-tower", name: "Sky Tower", cat: "family", price: 7600, level: 4, size: [3, 3], fun: 54, capacity: 14, cycle: 36, upkeep: 30, model: "observation", palette: ["#adb5bd", "#f8f9fa", "#ffb703"], desc: "A slow lift to the best view in the park." },
  { id: "star-flyer", name: "Star Flyer", cat: "thrill", price: 13500, level: 7, size: [3, 3], fun: 85, capacity: 16, cycle: 34, upkeep: 58, model: "starflyer", palette: ["#9d4edd", "#f3e8ff", "#ffc300"], desc: "Swings on a very tall pole. Legs dangling, sky everywhere." },
  { id: "wave-swinger", name: "Beach Party", cat: "family", price: 5800, level: 4, size: [3, 3], fun: 64, capacity: 18, cycle: 26, upkeep: 32, model: "swing", palette: ["#ffd166", "#fdf6ec", "#06d6a0"], desc: "A swinging ride with a seaside soundtrack." },
  { id: "rockin-tug", name: "Rockin' Tug", cat: "kiddie", price: 2400, level: 2, size: [3, 3], fun: 42, capacity: 10, cycle: 22, upkeep: 14, model: "kiddie", palette: ["#f28482", "#fff5f5", "#84a59d"], desc: "A little boat that rocks and spins." },
  { id: "balloon-ride", name: "Balloon Ride", cat: "kiddie", price: 3600, level: 2, size: [3, 3], fun: 46, capacity: 8, cycle: 24, upkeep: 18, model: "carpet", palette: ["#ffafcc", "#fff0f6", "#6a4c93"], desc: "Balloons that lift and settle, gently." },
  { id: "toboggan", name: "Alpine Toboggan", cat: "thrill", price: 8800, level: 5, size: [4, 4], fun: 72, capacity: 10, cycle: 34, upkeep: 40, model: "toboggan", palette: ["#e9edc9", "#fefae0", "#bc6c25"], desc: "A spiral chute down a snowless mountain." },
  { id: "treehouse", name: "Treehouse Play", cat: "kiddie", price: 1600, level: 1, size: [3, 3], fun: 35, capacity: 12, cycle: 26, upkeep: 10, model: "treehouse", palette: ["#a3b18a", "#f4f1de", "#588157"], desc: "Rope bridges and a slide in an old oak." },
  { id: "trampoline", name: "Bounce Park", cat: "kiddie", price: 2800, level: 2, size: [3, 3], fun: 40, capacity: 10, cycle: 20, upkeep: 16, model: "trampoline", palette: ["#90e0ef", "#f0f9ff", "#ff6b6b"], desc: "Ten trampolines and a lot of happy noise." },
  { id: "dark-ride", name: "Spooky Dark Ride", cat: "dark", price: 11000, level: 6, size: [5, 5], fun: 75, capacity: 8, cycle: 44, upkeep: 56, model: "darkride", palette: ["#4a4e69", "#efe6dd", "#9a8c98"], desc: "A slow car through a house of moving shadows." },
  { id: "flying-carpet", name: "Flying Carpet", cat: "thrill", price: 7200, level: 4, size: [3, 3], fun: 67, capacity: 16, cycle: 28, upkeep: 36, model: "carpet", palette: ["#e0aaff", "#fff6ff", "#7b2cbf"], desc: "A carpet that lifts, tilts and drops back down." }
];

/* ---------------------------------------------------------------------
   Shops and facilities
   spend: base price a visitor pays · restore: hunger / thirst / comfort
   --------------------------------------------------------------------- */
export const BUILDINGS = [
  { id: "burger", name: "Burger Stand", kind: "food", price: 1400, size: [2, 2], level: 1, model: "stall", palette: ["#e76f51", "#fdf0d5", "#8a5a44"], serve: 3, spend: 14, restore: 46, upkeep: 10, appeal: 2, desc: "Burgers, fries, queues at noon." },
  { id: "pizza", name: "Pizza Slice", kind: "food", price: 1700, size: [2, 2], level: 2, model: "stall", palette: ["#2a9d8f", "#fefae0", "#e9c46a"], serve: 4, spend: 16, restore: 52, upkeep: 12, appeal: 2, desc: "Wood-fired slices sold by the metre." },
  { id: "churros", name: "Churro Cart", kind: "food", price: 1200, size: [2, 2], level: 1, model: "cart", palette: ["#f4a261", "#fff3e0", "#8a5a44"], serve: 2, spend: 11, restore: 34, upkeep: 8, appeal: 1, desc: "Sugar, cinnamon, paper cone." },
  { id: "ice-cream", name: "Ice Cream", kind: "food", price: 1100, size: [2, 2], level: 1, model: "cart", palette: ["#ffb4a2", "#fff0ea", "#e5989b"], serve: 2, spend: 10, restore: 26, upkeep: 7, appeal: 1, desc: "Three scoops, sprinkles, melting fast." },
  { id: "popcorn", name: "Popcorn Wagon", kind: "food", price: 900, size: [2, 2], level: 1, model: "cart", palette: ["#ffd166", "#fff8e7", "#ef476f"], serve: 2, spend: 8, restore: 22, upkeep: 6, appeal: 1, desc: "Freshly popped, impossible to resist." },
  { id: "drinks", name: "Drinks Bar", kind: "drink", price: 950, size: [2, 2], level: 1, model: "stall", palette: ["#48cae4", "#f0fbff", "#0077b6"], serve: 2, spend: 9, restore: 48, upkeep: 7, appeal: 1, desc: "Cold lemonade and iced tea." },
  { id: "coffee", name: "Coffee Hut", kind: "drink", price: 1300, size: [2, 2], level: 2, model: "stall", palette: ["#8d6e63", "#f5eee6", "#d4a373"], serve: 3, spend: 12, restore: 38, upkeep: 9, appeal: 2, desc: "Flat whites for the grown-ups." },
  { id: "candy", name: "Sweet Shop", kind: "food", price: 1150, size: [2, 2], level: 1, model: "stall", palette: ["#f7a8c4", "#fff5f8", "#9b5de5"], serve: 3, spend: 10, restore: 24, upkeep: 8, appeal: 2, desc: "Pick and mix, by the bag." },
  { id: "souvenir", name: "Souvenir Shop", kind: "goods", price: 2100, size: [3, 2], level: 2, model: "shop", palette: ["#457b9d", "#f1faee", "#e63946"], serve: 4, spend: 22, restore: 8, upkeep: 14, appeal: 3, desc: "Mugs, pens and a plush of your mascot." },
  { id: "balloons", name: "Balloon Stand", kind: "goods", price: 800, size: [1, 1], level: 1, model: "cart", palette: ["#ff8fab", "#fff0f6", "#3a86ff"], serve: 2, spend: 8, restore: 6, upkeep: 5, appeal: 2, desc: "Every child leaves with one." },
  { id: "photos", name: "Photo Booth", kind: "goods", price: 1800, size: [2, 2], level: 2, model: "shop", palette: ["#9a8c98", "#f2e9e4", "#c9ada7"], serve: 3, spend: 14, restore: 4, upkeep: 9, appeal: 2, desc: "A print of the day, in a cardboard frame." },
  { id: "restaurant", name: "Park Restaurant", kind: "food", price: 5200, size: [3, 3], level: 4, model: "restaurant", palette: ["#606c38", "#fefae0", "#dda15e"], serve: 6, spend: 32, restore: 70, upkeep: 26, appeal: 5, desc: "Sit-down meals, shade and a proper toilet." },
  { id: "toilet", name: "Toilets", kind: "facility", price: 1600, size: [2, 2], level: 1, model: "toilet", palette: ["#adb5bd", "#f8f9fa", "#457b9d"], serve: 2, spend: 0, restore: 60, upkeep: 8, appeal: 0, comfort: true, desc: "Unglamorous, essential, always needed." },
  { id: "first-aid", name: "First Aid", kind: "facility", price: 2600, size: [2, 2], level: 3, model: "aid", palette: ["#f8f9fa", "#ffffff", "#e63946"], serve: 4, spend: 0, restore: 0, upkeep: 12, appeal: 1, desc: "Plasters, water and a quiet chair." },
  { id: "info", name: "Info Kiosk", kind: "facility", price: 1500, size: [2, 1], level: 1, model: "info", palette: ["#0077b6", "#f0f8ff", "#ffd166"], serve: 2, spend: 0, restore: 10, upkeep: 6, appeal: 1, desc: "Maps and directions, which guests love." },
  { id: "staffroom", name: "Staff Room", kind: "facility", price: 2400, size: [2, 2], level: 2, model: "staffroom", palette: ["#6b705c", "#f2e9e4", "#cb997e"], serve: 2, spend: 0, restore: 0, upkeep: 10, appeal: 0, staff: true, desc: "A kettle and a rota. Staff work better with one." }
];

/* ---------------------------------------------------------------------
   Decorations
   appeal: park beauty · effect: bench / bin / lamp etc.
   --------------------------------------------------------------------- */
export const DECOR = [
  { id: "tree-oak", name: "Oak Tree", price: 180, size: [1, 1], level: 1, model: "oak", appeal: 3, desc: "Leafy, generous shade." },
  { id: "tree-pine", name: "Pine", price: 220, size: [1, 1], level: 1, model: "pine", appeal: 3, desc: "A tall evergreen." },
  { id: "tree-palm", name: "Palm", price: 260, size: [1, 1], level: 2, model: "palm", appeal: 4, desc: "Holiday in one tree." },
  { id: "tree-blossom", name: "Blossom Tree", price: 300, size: [1, 1], level: 2, model: "blossom", appeal: 5, desc: "Pink petals all season." },
  { id: "flowers", name: "Flower Patch", price: 90, size: [1, 1], level: 1, model: "flowers", appeal: 1, desc: "A handful of colour." },
  { id: "flowerbed", name: "Flower Bed", price: 240, size: [2, 1], level: 1, model: "flowerbed", appeal: 2, desc: "A tidy ribbon of blooms." },
  { id: "hedge", name: "Hedge", price: 200, size: [2, 1], level: 1, model: "hedge", appeal: 2, desc: "Neat, green, a little formal." },
  { id: "topiary", name: "Topiary", price: 320, size: [1, 1], level: 3, model: "topiary", appeal: 4, desc: "A shrub with ambitions." },
  { id: "bench", name: "Bench", price: 160, size: [2, 1], level: 1, model: "bench", appeal: 1, effect: "rest", desc: "Guests sit and recover energy." },
  { id: "bin", name: "Litter Bin", price: 120, size: [1, 1], level: 1, model: "bin", appeal: 0, effect: "clean", desc: "Fewer wrappers on the ground." },
  { id: "lamp", name: "Lamp Post", price: 240, size: [1, 1], level: 1, model: "lamp", appeal: 2, effect: "light", desc: "Warm pools of light after dark." },
  { id: "fountain", name: "Fountain", price: 1800, size: [3, 3], level: 2, model: "fountain", appeal: 12, effect: "water", desc: "The park's centrepiece." },
  { id: "statue", name: "Mascot Statue", price: 1400, size: [2, 2], level: 3, model: "statue", appeal: 9, desc: "A bronze of the park mascot." },
  { id: "flag", name: "Flag Pole", price: 300, size: [1, 1], level: 1, model: "flag", appeal: 2, desc: "Snaps in the breeze." },
  { id: "arch", name: "Flower Arch", price: 900, size: [3, 1], level: 2, model: "arch", appeal: 5, desc: "A pretty gateway between areas." },
  { id: "balloon-arch", name: "Balloon Arch", price: 700, size: [3, 1], level: 2, model: "balloonarch", appeal: 4, desc: "A cheerfully ridiculous entrance." },
  { id: "fence", name: "Fence", price: 70, size: [1, 1], level: 1, model: "fence", appeal: 0, solid: true, desc: "Keeps the layout tidy." },
  { id: "pond", name: "Duck Pond", price: 2200, size: [4, 3], level: 4, model: "pond", appeal: 14, effect: "water", solid: true, desc: "Water, lilies and a few ducks." },
  { id: "bridge", name: "Bridge", price: 600, size: [3, 1], level: 3, model: "bridge", appeal: 4, desc: "A little arc over the stream." }
];

/* ---------------------------------------------------------------------
   Paths
   --------------------------------------------------------------------- */
export const PATHS = [
  { id: "path", name: "Paving", price: 30, model: "path", desc: "The basic walkway. Guests follow it." },
  { id: "plaza", name: "Plaza", price: 55, model: "plaza", desc: "Wider paving for busy junctions." },
  { id: "queue", name: "Queue Line", price: 40, model: "queue", desc: "Marks a spot where riders wait." }
];

/* ---------------------------------------------------------------------
   Staff
   --------------------------------------------------------------------- */
export const STAFF = [
  { id: "mechanic", name: "Mechanic", wage: 220, color: "#3a86ff", desc: "Repairs rides and cuts breakdowns.", effect: "condition" },
  { id: "cleaner", name: "Cleaner", wage: 140, color: "#2a9d8f", desc: "Keeps paths clear of litter.", effect: "clean" },
  { id: "entertainer", name: "Entertainer", wage: 200, color: "#ff006e", desc: "Lifts the mood of nearby guests.", effect: "happiness" },
  { id: "security", name: "Security", wage: 240, color: "#1d3557", desc: "Prevents trouble and calms crowds.", effect: "safety" },
  { id: "operator", name: "Ride Operator", wage: 180, color: "#f4a261", desc: "Faster boarding, fewer stoppages.", effect: "throughput" }
];

/* ---------------------------------------------------------------------
   Research
   --------------------------------------------------------------------- */
export const RESEARCH = [
  { id: "thrills", name: "Thrill Engineering", cost: 2, requires: [], desc: "Unlocks the Drop Tower, Star Flyer and Pirate Ship early." },
  { id: "water", name: "Water Systems", cost: 3, requires: ["thrills"], desc: "Unlocks Water Slide, Splash Battle and River Rapids." },
  { id: "coasters", name: "Coaster Design", cost: 4, requires: ["thrills"], desc: "Unlocks the Custom Coaster track builder." },
  { id: "food", name: "Catering", cost: 2, requires: [], desc: "Unlocks the restaurant, pizza and churros." },
  { id: "comfort", name: "Guest Comfort", cost: 2, requires: ["food"], desc: "Benches restore twice as much energy; toilets cost less upkeep." },
  { id: "decor", name: "Landscaping", cost: 2, requires: [], desc: "Unlocks fountains, statues, ponds and blossom trees." },
  { id: "marketing", name: "Marketing", cost: 3, requires: ["decor"], desc: "25% more visitors and a better first impression." },
  { id: "staffing", name: "Staff Training", cost: 3, requires: ["comfort"], desc: "Staff wages fall by 15% and their effects grow." },
  { id: "land", name: "Land Office", cost: 3, requires: ["marketing"], desc: "Land expansions cost 20% less." }
];

/* ---------------------------------------------------------------------
   Levels — XP needed for the next level
   --------------------------------------------------------------------- */
export const LEVEL_XP = [0, 220, 620, 1200, 2000, 3100, 4500, 6200, 8200, 10500, 13200, 16300, 19800, 23800, 28400, 33600, 39500, 46200, 53800, 62400];
export const levelFromXp = (xp) => {
  let lvl = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lvl = i + 1;
  return lvl;
};
export const xpForLevel = (level) => LEVEL_XP[Math.min(LEVEL_XP.length - 1, Math.max(0, level - 1))];
export const xpToNext = (xp) => {
  const lvl = levelFromXp(xp);
  const next = LEVEL_XP[lvl] !== undefined ? LEVEL_XP[lvl] : LEVEL_XP[LEVEL_XP.length - 1] + 12000;
  return Math.max(1, next - xp);
};

/* ---------------------------------------------------------------------
   Challenges
   --------------------------------------------------------------------- */
export const DAILY = [
  { id: "d-served", text: "Serve 40 visitors", metric: "dayServed", goal: 40, coins: 600, xp: 120 },
  { id: "d-income", text: "Earn 2,500 coins in a day", metric: "dayIncome", goal: 2500, coins: 800, xp: 150 },
  { id: "d-build", text: "Build 2 attractions or shops", metric: "dayBuilt", goal: 2, coins: 700, xp: 140 },
  { id: "d-decor", text: "Place 8 decorations", metric: "dayDecor", goal: 8, coins: 450, xp: 90 },
  { id: "d-happy", text: "Reach 80% average happiness", metric: "happinessPct", goal: 80, coins: 900, xp: 180 },
  { id: "d-staff", text: "Hire 3 members of staff", metric: "staff", goal: 3, coins: 500, xp: 100 }
];

export const WEEKLY = [
  { id: "w-served", text: "Serve 400 visitors this week", metric: "weekServed", goal: 400, coins: 3000, xp: 700 },
  { id: "w-income", text: "Earn 30,000 coins this week", metric: "weekIncome", goal: 30000, coins: 4000, xp: 900 },
  { id: "w-coaster", text: "Build a custom coaster", metric: "coastersBuilt", goal: 1, coins: 2500, xp: 600 },
  { id: "w-decor", text: "Place 40 decorations this week", metric: "weekDecor", goal: 40, coins: 2200, xp: 500 }
];

/* ---------------------------------------------------------------------
   Achievements
   --------------------------------------------------------------------- */
export const ACHIEVEMENTS = [
  { id: "first-ride", name: "First Thrill", desc: "Build your first attraction.", metric: "ridesBuilt", goal: 1, coins: 300, xp: 60 },
  { id: "ten-rides", name: "Ride Tycoon", desc: "Build ten attractions.", metric: "ridesBuilt", goal: 10, coins: 1500, xp: 250 },
  { id: "visitors-100", name: "Word Spreads", desc: "Welcome 100 visitors.", metric: "visitorsServed", goal: 100, coins: 600, xp: 120 },
  { id: "visitors-1000", name: "A Destination", desc: "Welcome 1,000 visitors.", metric: "visitorsServed", goal: 1000, coins: 4000, xp: 700 },
  { id: "five-star", name: "Five Stars", desc: "Reach a 5.0 park rating.", metric: "bestRating", goal: 5, coins: 2500, xp: 400 },
  { id: "level-10", name: "Park Director", desc: "Reach park level 10.", metric: "level", goal: 10, coins: 3000, xp: 0 },
  { id: "coaster", name: "Track Record", desc: "Open a custom coaster.", metric: "coastersBuilt", goal: 1, coins: 1200, xp: 260 },
  { id: "rich", name: "Deep Pockets", desc: "Hold 50,000 coins at once.", metric: "coins", goal: 50000, coins: 2000, xp: 300 },
  { id: "staff-20", name: "Good Employer", desc: "Have 20 staff on the payroll.", metric: "staff", goal: 20, coins: 1800, xp: 320 },
  { id: "decor-50", name: "Beautiful Grounds", desc: "Place 50 decorations.", metric: "decorPlaced", goal: 50, coins: 1400, xp: 240 },
  { id: "liked", name: "Popular Park", desc: "Receive 25 likes from other players.", metric: "likes", goal: 25, coins: 2200, xp: 380 },
  { id: "researcher", name: "Innovator", desc: "Complete four research projects.", metric: "researchDone", goal: 4, coins: 2000, xp: 350 }
];

/* ---------------------------------------------------------------------
   Little helpers
   --------------------------------------------------------------------- */
export const RIDE_BY_ID = Object.fromEntries(RIDES.map((r) => [r.id, r]));
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));
export const PATH_BY_ID = Object.fromEntries(PATHS.map((p) => [p.id, p]));
export const STAFF_BY_ID = Object.fromEntries(STAFF.map((s) => [s.id, s]));
export const DEF_BY_ID = { ...RIDE_BY_ID, ...BUILDING_BY_ID, ...DECOR_BY_ID };

export const GUEST_NAMES = ["Ada", "Theo", "Jonas", "Mila", "Oscar", "Luna", "Hugo", "Sofia", "Noah", "Ella", "Finn", "Iris", "Leo", "Nora", "Milo", "Zoe", "Max", "Freja", "Alma", "Ben", "Clara", "Sam", "Olivia", "Elias", "Maya", "Ravi", "Hana", "Isak", "Liva", "Omar", "Tilda", "Aksel", "Elsa", "Mikkel", "Rosa", "Aya"];
export const GUEST_COLORS = ["#e07a5f", "#3d5a80", "#81b29a", "#f2cc8f", "#9b5de5", "#f15bb5", "#00bbf9", "#00f5d4", "#ff9f1c", "#ef476f", "#118ab2", "#8ac926"];
export const GUEST_SHIRTS = ["#ffb4a2", "#bde0fe", "#cdb4db", "#a7c957", "#ffd6a5", "#ffadad", "#9bf6ff", "#caffbf"];

export const CAT_LABEL = { thrill: "Thrill", family: "Family", kiddie: "Kids", water: "Water", dark: "Dark", coaster: "Coaster", transport: "Transport", food: "Food", drink: "Drink", goods: "Shops", facility: "Facilities" };

export const TIPS = [
  "A ride with no path next to it never gets a queue.",
  "Benches and bins quietly raise your rating more than another shop.",
  "Mechanics stop rides from breaking down at the worst moment.",
  "Raise ticket prices slowly: guests notice a bad deal before a good ride.",
  "Water rides earn the most on hot days, dark rides on rainy ones.",
  "Staff cost wages every day, so hire for the crowds you actually have.",
  "A custom coaster with a big first drop scores better than a flat loop.",
  "Land is cheap compared with the rides you will want to put on it."
];
