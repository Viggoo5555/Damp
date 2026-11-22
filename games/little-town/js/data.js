/* =====================================================================
   LITTLE TOWN — the catalogue
   Fifty-six buildings and thirty-six decorations. Every entry names its
   own model family and style, so no two cards put the same house on the
   map. Sizes are footprints in tiles.
   ===================================================================== */

export const CAT_LABEL = {
  house: "Homes",
  shop: "Shops",
  service: "Services",
  community: "Community",
  decor: "Decor"
};

const B = (id, name, cat, size, cost, unlock, model, style, icon, desc, extra = {}) => ({
  id, name, cat, size, cost, unlock, model, style, icon, desc,
  pop: 0, jobs: 0, income: 0, appeal: 1, upkeep: 2,
  ...extra
});

/* ---------------------------------------------------------------------
   Homes
   --------------------------------------------------------------------- */
const HOUSES = [
  B("willow-cottage", "Willow Cottage", "house", [3, 3], 900, 1, "house",
    { floors: 1, roof: "thatch", timber: true, chimney: true, garden: true, wall: "#f5e6c8", roofColor: "#b68551", trim: "#8a5a3b" }, "🏡",
    "The little cream cottage every town starts with.", { pop: 4, appeal: 2, upkeep: 3 }),
  B("rosewood-cottage", "Rosewood Cottage", "house", [3, 3], 1300, 1, "house",
    { floors: 1, roof: "gable", timber: true, dormer: true, garden: true, wall: "#f7d9cf", roofColor: "#a94f45", trim: "#7c4034" }, "🏘️",
    "Blush plaster, red tiles and a rose around the door.", { pop: 5, appeal: 3, upkeep: 4 }),
  B("stone-cottage", "Stone Cottage", "house", [3, 3], 1900, 2, "house",
    { floors: 1, roof: "thatch", stone: true, chimney: true, wall: "#cfc4ad", roofColor: "#9d8458", trim: "#6f6552" }, "🏠",
    "Cool stone walls keep the bakery-warm interior cosy.", { pop: 6, appeal: 3, upkeep: 5 }),
  B("timber-house", "Timber House", "house", [3, 3], 2500, 2, "house",
    { floors: 2, roof: "gable", timber: true, dormer: true, chimney: true, wall: "#f2dfba", roofColor: "#8c4f3f", trim: "#5f3a2b" }, "🏚️",
    "Two floors of dark beams and warm plaster.", { pop: 7, appeal: 4, upkeep: 6 }),
  B("canal-house", "Canal House", "house", [2, 3], 2700, 3, "house",
    { floors: 3, roof: "mansard", narrow: true, shutters: true, wall: "#dfe7dd", roofColor: "#596b63", trim: "#44534c" }, "🏢",
    "A tall, narrow house that watches the river.", { pop: 6, appeal: 4, upkeep: 6 }),
  B("gabled-townhouse", "Gabled Townhouse", "house", [3, 3], 3400, 3, "house",
    { floors: 2, roof: "gable", timber: true, balcony: true, wall: "#f3e3c4", roofColor: "#b25d3d", trim: "#70422f" }, "🏠",
    "A stepped gable, a tiny balcony and geraniums.", { pop: 8, appeal: 4, upkeep: 7 }),
  B("family-home", "Family Home", "house", [3, 4], 3900, 3, "house",
    { floors: 2, roof: "hip", garden: true, dormer: true, wall: "#f7ecd8", roofColor: "#8e6b4b", trim: "#6d533b" }, "🏡",
    "Room for a family, a dog and a vegetable patch.", { pop: 10, appeal: 4, upkeep: 7 }),
  B("garden-cottage", "Garden Cottage", "house", [4, 3], 4400, 4, "house",
    { floors: 1, roof: "thatch", garden: true, flowers: true, wall: "#eef0d8", roofColor: "#a98a55", trim: "#6b6c45" }, "🌷",
    "A low thatched roof almost lost in flowers.", { pop: 8, appeal: 6, upkeep: 8 }),
  B("villa", "Vine Villa", "house", [4, 4], 6800, 4, "house",
    { floors: 2, roof: "hip", balcony: true, shutters: true, wall: "#f4e0c6", roofColor: "#9a5340", trim: "#6d3f2e" }, "🏛️",
    "A grand villa with shutters and a vine-covered terrace.", { pop: 12, appeal: 6, upkeep: 10 }),
  B("farmhouse", "Meadow Farmhouse", "house", [4, 3], 5400, 4, "house",
    { floors: 2, roof: "gable", timber: true, chimney: true, garden: true, wall: "#e9dcc0", roofColor: "#7c5c43", trim: "#5c4634" }, "🚜",
    "A working farmhouse with a barn-red roof.", { pop: 10, appeal: 5, upkeep: 8 }),
  B("duplex", "Oak Duplex", "house", [3, 4], 6000, 5, "house",
    { floors: 2, roof: "gable", twin: true, wall: "#f1e3cb", roofColor: "#a55e43", trim: "#6c4632" }, "🏘️",
    "Two front doors, one shared rose trellis.", { pop: 14, appeal: 5, upkeep: 9 }),
  B("apartment", "Maple Apartments", "house", [4, 4], 8800, 5, "house",
    { floors: 3, roof: "mansard", apartment: true, balconies: true, wall: "#eadfd2", roofColor: "#5f6d6b", trim: "#465451" }, "🏢",
    "Three floors of homes above a quiet courtyard.", { pop: 20, appeal: 5, upkeep: 12 }),
  B("riverside-house", "Riverside House", "house", [3, 3], 4800, 5, "house",
    { floors: 2, roof: "hip", balcony: true, flowers: true, wall: "#dfe9e3", roofColor: "#4f6f6a", trim: "#3c5652" }, "🌊",
    "A green-shuttered house with a view of the water.", { pop: 8, appeal: 5, upkeep: 8 }),
  B("hillside-house", "Hillside House", "house", [3, 3], 5200, 6, "house",
    { floors: 2, roof: "gable", stoneBase: true, balcony: true, wall: "#f0e2c7", roofColor: "#8f6748", trim: "#62503a" }, "⛰️",
    "A stone base, a wooden balcony, a long view.", { pop: 9, appeal: 5, upkeep: 8 }),
  B("townhouse-row", "Townhouse Row", "house", [4, 3], 7400, 6, "house",
    { floors: 3, roof: "mansard", row: true, shutters: true, wall: "#f3ddc9", roofColor: "#7b5040", trim: "#543a2d" }, "🏘️",
    "Three narrow homes shoulder to shoulder.", { pop: 16, appeal: 6, upkeep: 11 }),
  B("grand-apartment", "The Crescent", "house", [4, 4], 12500, 8, "house",
    { floors: 4, roof: "mansard", apartment: true, balconies: true, grand: true, wall: "#efe3d0", roofColor: "#596a64", trim: "#43544f" }, "🏛️",
    "The smartest address in town, with a curved crescent facade.", { pop: 28, appeal: 8, upkeep: 18 })
];

/* ---------------------------------------------------------------------
   Shops — each one gets a proper storefront, sign and awning.
   --------------------------------------------------------------------- */
const SHOPS = [
  B("corner-bakery", "Corner Bakery", "shop", [3, 3], 2300, 1, "shop",
    { floors: 1, awning: "#d98b6a", wall: "#f7e6c8", roofColor: "#a96545", trim: "#7d4a33", tables: true }, "🥐",
    "Fresh bread, cinnamon buns and a warm window.", { jobs: 4, income: 190, appeal: 4, upkeep: 6 }),
  B("little-cafe", "Little Café", "shop", [3, 3], 2700, 1, "shop",
    { floors: 1, awning: "#7fa887", wall: "#f2e7d3", roofColor: "#7b5d45", trim: "#5b4635", tables: true }, "☕",
    "A green awning, two tables and very good coffee.", { jobs: 4, income: 220, appeal: 5, upkeep: 7 }),
  B("flower-shop", "Wildflower Shop", "shop", [2, 3], 1900, 2, "shop",
    { floors: 1, awning: "#d98aa5", wall: "#f8e6df", roofColor: "#a65b58", trim: "#7c4240", flowers: true }, "💐",
    "Buckets of blooms spill onto the pavement.", { jobs: 2, income: 140, appeal: 5, upkeep: 5 }),
  B("bookshop", "Fox & Quill Books", "shop", [3, 3], 3100, 2, "shop",
    { floors: 2, awning: "#5f7f8f", wall: "#efe1c9", roofColor: "#6d5040", trim: "#4d3a2e", books: true }, "📚",
    "A creaky bookshop with a reading nook upstairs.", { jobs: 3, income: 165, appeal: 5, upkeep: 6 }),
  B("grocery", "Green Grocer", "shop", [3, 3], 3300, 2, "shop",
    { floors: 1, awning: "#8aa96d", wall: "#f1e7cf", roofColor: "#95704d", trim: "#6b523a", crates: true }, "🥕",
    "Vegetables in wooden crates, straight from the farm.", { jobs: 5, income: 250, appeal: 4, upkeep: 8 }),
  B("tea-room", "Willow Tea Room", "shop", [3, 3], 3600, 3, "shop",
    { floors: 2, awning: "#c79aa8", wall: "#f6e4da", roofColor: "#8b5a4b", trim: "#654139", tables: true }, "🫖",
    "Lace curtains, scones and a pot of tea.", { jobs: 4, income: 270, appeal: 6, upkeep: 8 }),
  B("boutique", "Rue Boutique", "shop", [3, 3], 4300, 3, "shop",
    { floors: 2, awning: "#b78ba8", wall: "#f4e6e0", roofColor: "#6f5361", trim: "#513d48" }, "👗",
    "A tiny fashion shop with a very large window.", { jobs: 4, income: 310, appeal: 4, upkeep: 9 }),
  B("ice-cream-parlour", "Cloud Nine Creamery", "shop", [2, 3], 3900, 3, "shop",
    { floors: 1, awning: "#8fc4c9", wall: "#fdf0d9", roofColor: "#b56e55", trim: "#835241", tables: true }, "🍦",
    "Forty flavours and a queue on sunny days.", { jobs: 3, income: 290, appeal: 6, upkeep: 8 }),
  B("patisserie", "Little Lark Patisserie", "shop", [3, 3], 4700, 4, "shop",
    { floors: 2, awning: "#e0b36c", wall: "#f8e9d2", roofColor: "#a76a4a", trim: "#7a4d37", tables: true }, "🧁",
    "Pastel macarons stacked like little hats.", { jobs: 5, income: 350, appeal: 6, upkeep: 10 }),
  B("toy-shop", "Tinker Toy Shop", "shop", [3, 3], 4500, 4, "shop",
    { floors: 2, awning: "#d6a45f", wall: "#efe2ce", roofColor: "#8a5b45", trim: "#634333" }, "🧸",
    "Wooden trains, kites and a wind-up frog.", { jobs: 3, income: 270, appeal: 5, upkeep: 9 }),
  B("restaurant", "The Copper Kettle", "shop", [4, 3], 6800, 4, "shop",
    { floors: 2, awning: "#b05f4f", wall: "#f0dfc7", roofColor: "#6f4738", trim: "#513328", tables: true, grand: true }, "🍽️",
    "A proper restaurant with candles and copper pans.", { jobs: 8, income: 540, appeal: 7, upkeep: 15 }),
  B("supermarket", "Market Hall", "shop", [4, 4], 9200, 5, "shop",
    { floors: 2, awning: "#7f9d7a", wall: "#e9e5d8", roofColor: "#5f6b5c", trim: "#465247", wide: true }, "🛒",
    "A wide market hall for the whole neighbourhood.", { jobs: 12, income: 720, appeal: 4, upkeep: 20 }),
  B("pharmacy", "Apothecary Green", "shop", [3, 3], 5400, 5, "shop",
    { floors: 2, awning: "#6f9c8b", wall: "#edf0e2", roofColor: "#5b6f61", trim: "#435349" }, "💊",
    "Herbal remedies and a green cross above the door.", { jobs: 4, income: 350, appeal: 4, upkeep: 10 }),
  B("cheese-shop", "The Cheese Wheel", "shop", [2, 3], 3700, 5, "shop",
    { floors: 1, awning: "#d6a75e", wall: "#f7e9cc", roofColor: "#946b45", trim: "#6b4b32", crates: true }, "🧀",
    "A little shop that smells of the whole valley.", { jobs: 3, income: 260, appeal: 5, upkeep: 8 }),
  B("bistro", "Linden Bistro", "shop", [3, 3], 5800, 6, "shop",
    { floors: 2, awning: "#8d5f6c", wall: "#efe1d3", roofColor: "#65464b", trim: "#493236", tables: true }, "🍷",
    "Chalkboard menus, tiny tables and evening light.", { jobs: 6, income: 460, appeal: 7, upkeep: 13 }),
  B("barber", "Clip & Comb", "shop", [2, 3], 3300, 6, "shop",
    { floors: 1, awning: "#72889d", wall: "#f2e8db", roofColor: "#7e5b4a", trim: "#594137" }, "💈",
    "A spinning pole, a red chair and a good chat.", { jobs: 3, income: 270, appeal: 4, upkeep: 8 }),
  B("record-shop", "Silver Groove Records", "shop", [3, 3], 4100, 7, "shop",
    { floors: 2, awning: "#9b7fa5", wall: "#eee2d6", roofColor: "#5c505e", trim: "#433a45" }, "🎶",
    "Vinyl in the window and music on the pavement.", { jobs: 3, income: 300, appeal: 6, upkeep: 9 }),
  B("bakery-supply", "The Flour Loft", "shop", [3, 3], 5000, 7, "shop",
    { floors: 2, awning: "#c59a63", wall: "#f5e7cd", roofColor: "#8a6648", trim: "#634a34" }, "🍞",
    "Sacks of flour and a warm bakery upstairs.", { jobs: 4, income: 330, appeal: 5, upkeep: 10 })
];

/* ---------------------------------------------------------------------
   Services — town hall, school, library, and the rest of civic life.
   --------------------------------------------------------------------- */
const SERVICES = [
  B("post-office", "Post Office", "service", [3, 3], 5000, 3, "civic",
    { kind: "post", floors: 1, wall: "#f2e5cc", roofColor: "#8c5b45", trim: "#644334" }, "📮",
    "Letters, parcels and the town noticeboard.", { jobs: 4, appeal: 3, upkeep: 8 }),
  B("school", "Village School", "service", [5, 4], 12500, 4, "civic",
    { kind: "school", floors: 2, wall: "#ead9b9", roofColor: "#7d5541", trim: "#5c4030", bell: true }, "🏫",
    "A bell tower, a playground and a very busy gate.", { jobs: 12, appeal: 7, upkeep: 20 }),
  B("library", "Linden Library", "service", [4, 4], 9200, 4, "civic",
    { kind: "library", floors: 2, wall: "#e9e2cf", roofColor: "#6a5a4c", trim: "#4e4137", columns: true }, "📖",
    "Tall windows, hushed rooms and free stories.", { jobs: 5, appeal: 7, upkeep: 14 }),
  B("town-hall", "Town Hall", "service", [5, 4], 15500, 5, "civic",
    { kind: "hall", floors: 2, wall: "#f0e2c4", roofColor: "#6f5048", trim: "#4e3731", tower: true, clock: true, columns: true }, "🏛️",
    "The clock tower everyone sets their watch by.", { jobs: 10, appeal: 9, upkeep: 24 }),
  B("clinic", "Meadow Clinic", "service", [4, 3], 8800, 5, "civic",
    { kind: "clinic", floors: 2, wall: "#eff1e8", roofColor: "#6c7a72", trim: "#4e5b54" }, "🩺",
    "A calm green surgery with a friendly doctor.", { jobs: 6, appeal: 5, upkeep: 14 }),
  B("bank", "Savings Bank", "service", [4, 3], 10500, 6, "civic",
    { kind: "bank", floors: 2, wall: "#e9e0cd", roofColor: "#5c5850", trim: "#413e38", columns: true }, "🏦",
    "Stone columns and a very solid front door.", { jobs: 6, appeal: 4, upkeep: 15 }),
  B("police-station", "Constabulary", "service", [4, 3], 9800, 6, "civic",
    { kind: "police", floors: 2, wall: "#e7e2d3", roofColor: "#55605e", trim: "#3e4745" }, "🚓",
    "A blue lamp, a front desk and a safe high street.", { jobs: 7, appeal: 4, upkeep: 15 }),
  B("fire-station", "Fire Station", "service", [4, 3], 9400, 6, "civic",
    { kind: "fire", floors: 1, wall: "#e8d8c5", roofColor: "#7b4a3a", trim: "#563329", garage: true }, "🚒",
    "Two red engines and a very tall practice tower.", { jobs: 7, appeal: 4, upkeep: 15 }),
  B("museum", "The Village Museum", "service", [5, 4], 14500, 7, "civic",
    { kind: "museum", floors: 2, wall: "#eee3d2", roofColor: "#635c51", trim: "#474139", dome: true, columns: true }, "🏺",
    "Local history, old maps and a glass dome.", { jobs: 8, appeal: 9, upkeep: 22 }),
  B("theatre", "The Little Theatre", "service", [5, 4], 18500, 8, "civic",
    { kind: "theatre", floors: 2, wall: "#e6d5c5", roofColor: "#5c4142", trim: "#412e2f", marquee: true }, "🎭",
    "Red velvet seats and a marquee of warm bulbs.", { jobs: 12, appeal: 10, upkeep: 28 }),
  B("church", "St. Linden's", "service", [4, 5], 16500, 7, "civic",
    { kind: "church", floors: 1, wall: "#e9e2d1", roofColor: "#5f5750", trim: "#443e38", spire: true }, "⛪",
    "A stone church, a tall spire and a quiet green.", { jobs: 4, appeal: 9, upkeep: 18 }),
  B("train-station", "Linden Station", "service", [5, 3], 20500, 9, "civic",
    { kind: "station", floors: 1, wall: "#e8dcc3", roofColor: "#6d5145", trim: "#4e3a31", canopy: true }, "🚉",
    "The morning train brings new residents and visitors.", { jobs: 8, appeal: 7, upkeep: 25 }),
  B("hotel", "The Linden Arms", "service", [5, 4], 22500, 9, "civic",
    { kind: "hotel", floors: 3, wall: "#efe0c9", roofColor: "#624c40", trim: "#46362d", balconies: true }, "🛎️",
    "A coaching inn with warm windows and a good kitchen.", { jobs: 14, income: 620, appeal: 9, upkeep: 30 })
];

/* ---------------------------------------------------------------------
   Community places
   --------------------------------------------------------------------- */
const COMMUNITY = [
  B("village-green", "Village Green", "community", [4, 4], 1600, 1, "green",
    { kind: "green" }, "🌿", "A soft lawn, a bench and room to breathe.", { appeal: 7, upkeep: 3 }),
  B("playground", "Playground", "community", [3, 3], 2300, 2, "green",
    { kind: "playground" }, "🛝", "Swings, a slide and a sandpit full of buckets.", { appeal: 7, upkeep: 4 }),
  B("fountain-plaza", "Fountain Plaza", "community", [4, 4], 3400, 2, "green",
    { kind: "fountain" }, "⛲", "The meeting place at the heart of town.", { appeal: 9, upkeep: 6 }),
  B("rose-garden", "Rose Garden", "community", [4, 3], 2700, 3, "green",
    { kind: "rosegarden" }, "🌹", "Trellises, gravel paths and every shade of rose.", { appeal: 8, upkeep: 4 }),
  B("gazebo", "Bandstand Gazebo", "community", [2, 2], 1900, 3, "green",
    { kind: "gazebo" }, "🎪", "A white gazebo for Sunday concerts.", { appeal: 5, upkeep: 3 }),
  B("bandstand", "Concert Bandstand", "community", [3, 3], 3800, 4, "green",
    { kind: "bandstand" }, "🎺", "Brass bands, deck chairs and summer evenings.", { appeal: 7, upkeep: 6 }),
  B("sports-court", "Tennis Court", "community", [4, 4], 5000, 5, "green",
    { kind: "sports" }, "🎾", "A green court with a net and a chalk line.", { appeal: 7, upkeep: 8 }),
  B("picnic-grove", "Picnic Grove", "community", [4, 4], 3100, 4, "green",
    { kind: "picnic" }, "🧺", "Shade, picnic tables and birdsong.", { appeal: 8, upkeep: 4 }),
  B("community-centre", "Community Centre", "community", [4, 3], 7800, 5, "civic",
    { kind: "centre", floors: 2, wall: "#e9ddc9", roofColor: "#6c5546", trim: "#4e3d32" }, "🏠",
    "Clubs, classes and a hall for every occasion.", { jobs: 5, appeal: 7, upkeep: 12 })
];

export const BUILDINGS = [...HOUSES, ...SHOPS, ...SERVICES, ...COMMUNITY];

/* ---------------------------------------------------------------------
   Decorations — trees, flowers, street furniture, gardens and play.
   --------------------------------------------------------------------- */
const D = (id, name, group, size, cost, unlock, model, style, icon, desc, extra = {}) => ({
  id, name, cat: "decor", group, size, cost, unlock, model, style, icon, desc,
  pop: 0, jobs: 0, income: 0, appeal: 2, upkeep: 0,
  ...extra
});

export const DECOR = [
  D("old-oak", "Old Oak", "Trees", [1, 1], 120, 1, "tree", { kind: "oak", s: 1.15 }, "🌳", "A broad oak with a century of rings.", { appeal: 3 }),
  D("birch-grove", "Silver Birch", "Trees", [1, 1], 110, 1, "tree", { kind: "birch", s: 1 }, "🌿", "Pale bark and trembling leaves.", { appeal: 2 }),
  D("pine-stand", "Scots Pine", "Trees", [1, 1], 130, 2, "tree", { kind: "pine", s: 1.1 }, "🌲", "A tall pine that smells of the hills.", { appeal: 3 }),
  D("willow-tree", "Weeping Willow", "Trees", [2, 2], 220, 3, "tree", { kind: "willow", s: 1.1 }, "🌳", "Long green curtains for a riverbank.", { appeal: 4 }),
  D("blossom-tree", "Blossom Tree", "Trees", [1, 1], 180, 2, "tree", { kind: "blossom", s: 1 }, "🌸", "Pink blossom that falls like confetti.", { appeal: 4 }),
  D("poplar-tree", "Lombardy Poplar", "Trees", [1, 1], 140, 3, "tree", { kind: "poplar", s: 1.2 }, "🍃", "A slim green spire along the road.", { appeal: 2 }),

  D("tulip-bed", "Tulip Bed", "Flowers", [1, 1], 60, 1, "flower", { kind: "tulip" }, "🌷", "A neat row of spring tulips.", { appeal: 2 }),
  D("rose-bush", "Rose Bush", "Flowers", [1, 1], 70, 1, "flower", { kind: "rose" }, "🌹", "Deep red roses with a heavy scent.", { appeal: 2 }),
  D("lavender-patch", "Lavender Patch", "Flowers", [2, 1], 90, 2, "flower", { kind: "lavender" }, "💜", "Bees love this purple haze.", { appeal: 3 }),
  D("sunflower-patch", "Sunflowers", "Flowers", [1, 1], 85, 2, "flower", { kind: "sunflower" }, "🌻", "Tall sunflowers turning to the light.", { appeal: 3 }),
  D("bluebell-patch", "Bluebells", "Flowers", [1, 2], 80, 3, "flower", { kind: "bluebell" }, "🔔", "A blue wash beneath the trees.", { appeal: 2 }),
  D("flower-cart", "Flower Cart", "Flowers", [2, 1], 320, 3, "flower", { kind: "cart" }, "🌼", "A painted cart overflowing with posies.", { appeal: 4 }),

  D("lamp-post", "Lamp Post", "Street", [1, 1], 90, 1, "street", { kind: "lamp" }, "🏮", "Warm light for evening walks.", { appeal: 2 }),
  D("park-bench", "Park Bench", "Street", [2, 1], 70, 1, "street", { kind: "bench" }, "🪑", "A green bench with a plaque.", { appeal: 2 }),
  D("bike-rack", "Bike Rack", "Street", [1, 1], 80, 2, "street", { kind: "bike" }, "🚲", "Room for six bicycles and one basket.", { appeal: 2 }),
  D("mailbox", "Post Box", "Street", [1, 1], 50, 1, "street", { kind: "mailbox" }, "📬", "The red post box on the corner.", { appeal: 1 }),
  D("notice-board", "Notice Board", "Street", [1, 1], 60, 2, "street", { kind: "notice" }, "📌", "Fête posters and lost cat notices.", { appeal: 2 }),
  D("bus-stop", "Bus Shelter", "Street", [2, 1], 260, 4, "street", { kind: "bus" }, "🚌", "A glass shelter and a timetable.", { appeal: 3 }),
  D("cafe-table", "Café Table", "Street", [1, 1], 90, 2, "street", { kind: "table" }, "☕", "Two chairs and a tiny vase.", { appeal: 2 }),
  D("market-stall", "Market Stall", "Street", [2, 2], 290, 3, "street", { kind: "stall" }, "🍎", "Striped canvas and crates of apples.", { appeal: 4 }),

  D("hedge-row", "Clipped Hedge", "Gardens", [2, 1], 60, 1, "garden", { kind: "hedge" }, "🌿", "A tidy box hedge.", { appeal: 1 }),
  D("picket-fence", "Picket Fence", "Gardens", [2, 1], 45, 1, "garden", { kind: "fence" }, "🤍", "White pickets and a small gate.", { appeal: 1 }),
  D("stone-wall", "Stone Wall", "Gardens", [2, 1], 55, 2, "garden", { kind: "wall" }, "🧱", "Dry stone, moss and wild thyme.", { appeal: 1 }),
  D("pergola", "Rose Pergola", "Gardens", [2, 2], 380, 4, "garden", { kind: "pergola" }, "🌺", "A shaded walk under climbing roses.", { appeal: 5 }),
  D("potted-plants", "Potted Plants", "Gardens", [1, 1], 40, 1, "garden", { kind: "pots" }, "🪴", "Terracotta pots by a doorway.", { appeal: 2 }),
  D("birdbath", "Bird Bath", "Gardens", [1, 1], 55, 2, "garden", { kind: "birdbath" }, "🐦", "A stone bath and a very bold robin.", { appeal: 2 }),

  D("small-pond", "Lily Pond", "Water", [3, 2], 340, 3, "water", { kind: "pond" }, "🪷", "Lilies, reeds and a wooden jetty.", { appeal: 5 }),
  D("garden-fountain", "Small Fountain", "Water", [2, 2], 380, 2, "water", { kind: "fountain" }, "⛲", "A little fountain for a courtyard.", { appeal: 4 }),
  D("village-well", "Village Well", "Water", [1, 1], 160, 1, "water", { kind: "well" }, "🪣", "An old well with a bucket and rope.", { appeal: 3 }),

  D("swing-set", "Swing Set", "Play", [2, 1], 240, 2, "play", { kind: "swing" }, "🎠", "Two swings under an apple tree.", { appeal: 4 }),
  D("sandpit", "Sandpit", "Play", [2, 1], 150, 2, "play", { kind: "sand" }, "🏖️", "Buckets, spades and a small castle.", { appeal: 3 }),
  D("seesaw", "Seesaw", "Play", [2, 1], 130, 3, "play", { kind: "seesaw" }, "⚖️", "Up, down, up, down.", { appeal: 3 }),
  D("slide", "Slide", "Play", [1, 2], 210, 3, "play", { kind: "slide" }, "🛝", "A red slide and a soft landing.", { appeal: 4 }),

  D("stone-statue", "Founder's Statue", "Landmarks", [2, 2], 900, 4, "decor", { kind: "statue" }, "🗿", "The town founder, in weathered stone.", { appeal: 6 }),
  D("dovecote", "Dovecote", "Landmarks", [2, 2], 480, 4, "decor", { kind: "dovecote" }, "🕊️", "White doves and a tiny round door.", { appeal: 4 }),
  D("laundry-line", "Laundry Line", "Landmarks", [2, 2], 120, 3, "decor", { kind: "laundry" }, "👕", "Sheets drying in the summer breeze.", { appeal: 2 })
];

export const DEFS = [...BUILDINGS, ...DECOR];
export const DEF_BY_ID = Object.fromEntries(DEFS.map((d) => [d.id, d]));

/* ---------------------------------------------------------------------
   Roads and paths. Kept out of the building catalogue; all are auto-tiled
   from their neighbours so streets curve naturally.
   --------------------------------------------------------------------- */
export const ROADS = [
  { id: "cobble-street", name: "Cobbled Street", cost: 40, unlock: 1, kind: "road", icon: "🧱", desc: "Auto-connecting stone street with pavements.", appeal: 1 },
  { id: "flagstone-path", name: "Flagstone Path", cost: 22, unlock: 1, kind: "path", icon: "🪨", desc: "A narrow footpath between gardens.", appeal: 1 },
  { id: "crossing", name: "Zebra Crossing", cost: 55, unlock: 2, kind: "crossing", icon: "🦓", desc: "A safe crossing over any street tile.", appeal: 1 },
  { id: "plaza", name: "Cobbled Square", cost: 70, unlock: 2, kind: "plaza", icon: "⬜", desc: "Wide paving for a square or market.", appeal: 2 },
  { id: "bridge", name: "Stone Bridge", cost: 480, unlock: 3, kind: "bridge", icon: "🌉", desc: "An arched bridge — the only way over the river.", appeal: 3 }
];
export const ROAD_BY_ID = Object.fromEntries(ROADS.map((r) => [r.id, r]));

/* ---------------------------------------------------------------------
   Levels, quests, achievements, seasons
   --------------------------------------------------------------------- */
export function xpForLevel(level) {
  let total = 0;
  for (let i = 1; i < level; i++) total += Math.round(160 * Math.pow(i, 1.35));
  return total;
}
export function levelFromXp(xp) {
  let level = 1;
  while (level < 40 && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export const DAILY_POOL = [
  { id: "d-houses", text: "Build 3 houses", metric: "houses", need: 3, coins: 700, xp: 90 },
  { id: "d-shops", text: "Add 2 shops", metric: "shops", need: 2, coins: 650, xp: 80 },
  { id: "d-decor", text: "Place 4 decorations", metric: "decor", need: 4, coins: 420, xp: 55 },
  { id: "d-pop", text: "Reach 18 residents", metric: "population", need: 18, coins: 800, xp: 110 },
  { id: "d-happy", text: "Reach 68% happiness", metric: "happiness", need: 68, coins: 750, xp: 100 },
  { id: "d-roads", text: "Lay 12 road tiles", metric: "roads", need: 12, coins: 480, xp: 60 },
  { id: "d-upgrade", text: "Upgrade any building", metric: "upgrades", need: 1, coins: 600, xp: 75 },
  { id: "d-income", text: "Collect 4,000 coins of income", metric: "income", need: 4000, coins: 850, xp: 120 },
  { id: "d-trees", text: "Plant 3 trees", metric: "trees", need: 3, coins: 360, xp: 45 },
  { id: "d-park", text: "Build a park or garden", metric: "green", need: 1, coins: 500, xp: 65 },
  { id: "d-spend", text: "Invest 3,500 coins in the town", metric: "spent", need: 3500, coins: 900, xp: 120 },
  { id: "d-services", text: "Open a service building", metric: "services", need: 1, coins: 700, xp: 85 }
];

export const WEEKLY_POOL = [
  { id: "w-houses", text: "Build 8 houses this week", metric: "houses", need: 8, coins: 3200, xp: 400 },
  { id: "w-pop", text: "Grow the town to 90 residents", metric: "population", need: 90, coins: 3800, xp: 480 },
  { id: "w-roads", text: "Lay 70 road tiles", metric: "roads", need: 70, coins: 2800, xp: 320 },
  { id: "w-shops", text: "Open 6 shops", metric: "shops", need: 6, coins: 3000, xp: 360 },
  { id: "w-happy", text: "Hold 80% happiness", metric: "happiness", need: 80, coins: 4200, xp: 520 },
  { id: "w-upgrade", text: "Upgrade 3 buildings", metric: "upgrades", need: 3, coins: 3400, xp: 420 },
  { id: "w-decor", text: "Place 20 decorations", metric: "decor", need: 20, coins: 2600, xp: 300 },
  { id: "w-daily", text: "Claim 5 daily quests", metric: "dailyClaimed", need: 5, coins: 4000, xp: 500 }
];

export const ACHIEVEMENTS = [
  { id: "a-first", name: "A Place to Call Home", desc: "Build your first house", metric: "houses", need: 1, xp: 40 },
  { id: "a-five-homes", name: "Little Neighbourhood", desc: "Build 5 houses", metric: "houses", need: 5, xp: 120 },
  { id: "a-first-shop", name: "Open for Business", desc: "Build your first shop", metric: "shops", need: 1, xp: 60 },
  { id: "a-ten-shops", name: "Market High Street", desc: "Build 10 shops", metric: "shops", need: 10, xp: 240 },
  { id: "a-ten-buildings", name: "Growing Pains", desc: "Place 10 buildings", metric: "buildings", need: 10, xp: 100 },
  { id: "a-25-buildings", name: "Town Planner", desc: "Place 25 buildings", metric: "buildings", need: 25, xp: 260 },
  { id: "a-50-buildings", name: "Mayor Material", desc: "Place 50 buildings", metric: "buildings", need: 50, xp: 600 },
  { id: "a-pop10", name: "Hello, Neighbour", desc: "Reach 10 residents", metric: "population", need: 10, xp: 80 },
  { id: "a-pop50", name: "Busy Streets", desc: "Reach 50 residents", metric: "population", need: 50, xp: 220 },
  { id: "a-pop100", name: "A Proper Town", desc: "Reach 100 residents", metric: "population", need: 100, xp: 500 },
  { id: "a-happy", name: "Smiles All Round", desc: "Reach 85% happiness", metric: "happiness", need: 85, xp: 300 },
  { id: "a-roads", name: "Well Connected", desc: "Lay 40 road tiles", metric: "roads", need: 40, xp: 160 },
  { id: "a-decor", name: "Flower Boxes", desc: "Place 15 decorations", metric: "decor", need: 15, xp: 140 },
  { id: "a-upgrade", name: "Fresh Paint", desc: "Upgrade a building", metric: "upgrades", need: 1, xp: 70 },
  { id: "a-upgrades5", name: "Grand Designs", desc: "Upgrade 5 buildings", metric: "upgrades", need: 5, xp: 250 },
  { id: "a-level5", name: "Village Elder", desc: "Reach player level 5", metric: "level", need: 5, xp: 0 },
  { id: "a-level10", name: "Lord of the Manor", desc: "Reach player level 10", metric: "level", need: 10, xp: 0 },
  { id: "a-likes", name: "Town Pride", desc: "Receive 5 likes on your published town", metric: "likes", need: 5, xp: 180 }
];

export const SEASONS = [
  { id: "spring", name: "Spring", icon: "🌸", event: "Blossom Festival", bonus: "New residents arrive 25% faster", ground: "#9bbb6d", foliage: "#8fbe6a", sky: "#cfe8ec" },
  { id: "summer", name: "Summer", icon: "☀️", event: "Midsummer Fair", bonus: "Shops earn 15% more", ground: "#93b55f", foliage: "#6ea85a", sky: "#bfe4ef" },
  { id: "autumn", name: "Autumn", icon: "🍂", event: "Harvest Week", bonus: "Decorations add double appeal", ground: "#b3a15f", foliage: "#c4864a", sky: "#e8dcc0" },
  { id: "winter", name: "Winter", icon: "❄️", event: "Lights & Lanterns", bonus: "Cafés and restaurants earn double", ground: "#e8ece4", foliage: "#9aa98f", sky: "#d9e5ea" }
];

export const TIPS = [
  "Buildings need a road or path beside the door before residents can use them.",
  "Short streets feel busier: connect homes directly to shops and green space.",
  "Parks, cafés and fountains raise happiness — and happiness raises income.",
  "A bridge is the only road tile that can cross the river.",
  "Upgrade a building to add a floor or a new awning. It earns more too.",
  "Expand land when the town feels full. The river bank unlocks at level 3.",
  "Visitors to a published town can like it but never edit it.",
  "Daily quests reset each real day; weekly challenges reset on Monday."
];
