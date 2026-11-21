// ---------------------------------------------------------------------------
// City Chaos: data. Tools, spawn catalog and tuning live here so the systems
// modules stay about behaviour.
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  { id: 'vehicles', name: 'Vehicles', icon: '<path d="M3 15h18M5 15l2-6h10l2 6v4H5z"/><circle cx="7.5" cy="18.5" r="1.6"/><circle cx="16.5" cy="18.5" r="1.6"/>' },
  { id: 'objects', name: 'Objects', icon: '<path d="M12 3 20 7.5v9L12 21 4 16.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>' },
  { id: 'construction', name: 'Construction', icon: '<path d="M3 20 9 5h2l-6 15zM13 20 19 5h2l-6 15zM6 15h13"/>' },
  { id: 'special', name: 'Special', icon: '<path d="m12 2 2.2 6.3L21 10l-5.4 4.2L17.4 21 12 17.2 6.6 21l1.8-6.8L3 10l6.8-1.7z"/>' },
  { id: 'characters', name: 'Characters', icon: '<circle cx="12" cy="6.5" r="3"/><path d="M6 21c0-4 2.7-6.4 6-6.4s6 2.4 6 6.4"/><path d="M8.5 21v-2.5M15.5 21v-2.5"/>' },
];

const ICON = {
  grab: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M8 12v-1.5a1.5 1.5 0 0 0-3 0V15a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-2"/>',
  weld: '<path d="M4 12h4M16 12h4"/><path d="M9 8v8M15 8v8"/><path d="M11 12h2"/>',
  rope: '<path d="M4 6c3 0 3 4 6 4s3-4 6-4 3 4 4 4"/><path d="M4 14c3 0 3 4 6 4s3-4 6-4 3 4 4 4"/>',
  hinge: '<path d="M4 5h6v14H4z"/><path d="M10 12h5"/><circle cx="15" cy="12" r="1.6"/><path d="M18 6l4 6-4 6"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
  scale: '<path d="M4 20 20 4"/><path d="M20 4h-5M20 4v5"/><path d="M4 20h5M4 20v-5"/>',
  freeze: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
  repair: '<path d="M14.5 4a4.5 4.5 0 0 0 5.6 5.9L10 20a2.8 2.8 0 0 1-4-4l10.1-10.1A4.5 4.5 0 0 0 14.5 4Z"/>',
  delete: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
  camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13.5" r="3.2"/>',
};

export const TOOLS = [
  { id: 'grab', name: 'Physics grabber', key: '1', icon: ICON.grab, desc: 'Pick objects up, carry them and throw them. Wheel sets the carry distance.', hints: ['Hold <b>LMB</b> to grab', '<b>Wheel</b> distance', '<b>R</b> + wheel to spin', '<b>LMB</b> again to throw'] },
  { id: 'weld', name: 'Weld tool', key: '2', icon: ICON.weld, desc: 'Fuse two objects into one rigid piece. Click the first, then the second.', hints: ['Click two objects to weld', '<b>Repair</b> clears welds'] },
  { id: 'rope', name: 'Rope tool', key: '3', icon: ICON.rope, desc: 'Join two objects with a rope. Good for towing and swinging.', hints: ['Click two objects', 'Ropes keep their length'] },
  { id: 'hinge', name: 'Hinge tool', key: '4', icon: ICON.hinge, desc: 'Join two objects on a hinge so they can swing or fold.', hints: ['Click two objects', 'Hinges spin freely'] },
  { id: 'rotate', name: 'Rotate tool', key: '5', icon: ICON.rotate, desc: 'Turn a selected object precisely. Wheel turns, Shift snaps.', hints: ['Click to select', '<b>Wheel</b> turns it', '<b>Shift</b> snaps 15°'] },
  { id: 'scale', name: 'Scale tool', key: '6', icon: ICON.scale, desc: 'Shrink or grow an object. The collider grows with it.', hints: ['Click to select', '<b>Wheel</b> resizes', '<b>Shift</b> for big steps'] },
  { id: 'freeze', name: 'Freeze tool', key: '7', icon: ICON.freeze, desc: 'Lock objects in place so you can build on them, or let them go again.', hints: ['Click to freeze', 'Click again to unfreeze'] },
  { id: 'repair', name: 'Repair tool', key: '8', icon: ICON.repair, desc: 'Put a damaged object, vehicle or building back the way it started.', hints: ['Click to repair', 'Also removes welds & ropes'] },
  { id: 'delete', name: 'Delete tool', key: '9', icon: ICON.delete, desc: 'Remove the object under the crosshair. Buildings come down in one piece.', hints: ['Click to delete', '<b>X</b> deletes quickly'] },
  { id: 'camera', name: 'Free camera', key: '0', icon: ICON.camera, desc: 'Fly anywhere and look at the city. WASD to fly, Q/E down and up.', hints: ['<b>WASD</b> fly', '<b>Q/E</b> down / up', '<b>Shift</b> fast'] },
];

export const TOOL_KEYS = TOOLS.map((tool) => tool.id);

// ---------------------------------------------------------------------------
// Spawn catalog
// size is the visual/collision box in metres, mass in kilograms.
// ---------------------------------------------------------------------------
const vehicles = [
  { id: 'sedan', name: 'Sedan', desc: 'A dependable four-door. Neutral handling, seats four. Mass 1,250 kg.', vehicle: 'sedan', color: 0xb8c3c9, mass: 1250, size: [2, 0.8, 4.4], speed: 34 },
  { id: 'coupe', name: 'Sport coupe', desc: 'Light, low and quick. Grips hard, spins easily if you are careless.', vehicle: 'coupe', color: 0xd8553f, mass: 980, size: [1.95, 0.66, 4.2], speed: 42 },
  { id: 'van', name: 'Cargo van', desc: 'Boxy, tall and heavy on the brakes. Great for blocking a street.', vehicle: 'van', color: 0xd7d3c4, mass: 1900, size: [2.15, 1.6, 5.2], speed: 28 },
  { id: 'pickup', name: 'Pickup truck', desc: 'Torquey and stable. Flips less than a car when it hits a kerb.', vehicle: 'pickup', color: 0x4c6b7d, mass: 2300, size: [2.25, 1.15, 5.6], speed: 30 },
  { id: 'truck', name: 'Box truck', desc: '4,500 kg of momentum. Stops for nothing, especially not a fence.', vehicle: 'truck', color: 0xe4e0d5, mass: 4500, size: [2.5, 2.4, 7.2], speed: 24 },
  { id: 'bus', name: 'City bus', desc: 'Nine tonnes of civic pride. Wide turning circle, enormous weight.', vehicle: 'bus', color: 0x3f7fa1, mass: 9000, size: [2.6, 2.7, 11], speed: 21 },
  { id: 'plane', name: 'Light plane', desc: 'A small prop plane. Full throttle and pull up to leave the runway.', vehicle: 'plane', color: 0xe8e3d6, mass: 1300, size: [10.5, 1.6, 8.5], speed: 55 },
  { id: 'heli', name: 'Helicopter', desc: 'Rotor lift, yaw with the mouse, climb with throttle. A wobbly dream.', vehicle: 'heli', color: 0x314b41, mass: 1600, size: [3, 2.2, 9], speed: 46 },
  { id: 'trailer', name: 'Trailer', desc: 'An empty cargo trailer. Hitch it to anything with the rope tool.', vehicle: 'trailer', color: 0xa9adb0, mass: 1600, size: [2.3, 2.2, 6], speed: 0 },
];

const objectProps = [
  { id: 'table', name: 'Dining table', desc: 'Solid wood, four legs, one wobbly corner.', build: 'table', color: 0x9a7150, mass: 45, size: [2, 0.92, 1] },
  { id: 'chair', name: 'Chair', desc: 'A chair. Good for throwing at other chairs.', build: 'chair', color: 0x8d6a4b, mass: 8, size: [0.62, 0.95, 0.62] },
  { id: 'sofa', name: 'Sofa', desc: 'Two and a half metres of upholstery. Surprisingly bouncy.', build: 'sofa', color: 0x6e7f6a, mass: 75, size: [2.4, 0.9, 0.95] },
  { id: 'cabinet', name: 'Cabinet', desc: 'Tall office cabinet. Top-heavy, tips over readily.', build: 'cabinet', color: 0x7c8288, mass: 60, size: [1.2, 1.9, 0.6] },
  { id: 'fridge', name: 'Fridge', desc: 'An appliance with ambitions. Dents, then splits.', build: 'fridge', color: 0xd8dcda, mass: 95, size: [0.85, 1.9, 0.78] },
  { id: 'tv', name: 'Television', desc: 'Flat, fragile and heavier than it looks.', build: 'tv', color: 0x22282c, mass: 22, size: [1.3, 0.82, 0.14] },
  { id: 'barrel', name: 'Steel barrel', desc: 'Rolls beautifully, dents, then pops its lid.', build: 'barrel', color: 0x6f8a93, mass: 60, size: [0.7, 1.05, 0.7] },
  { id: 'crate', name: 'Wooden crate', desc: 'A sturdy crate for stacking very badly.', build: 'crate', color: 0xa57c4f, mass: 38, size: [1, 1, 1] },
  { id: 'box', name: 'Cardboard box', desc: 'Light, soft and endlessly entertaining.', build: 'box', color: 0xb08a5c, mass: 5, size: [0.85, 0.7, 0.85] },
  { id: 'bench', name: 'Park bench', desc: 'Cast iron and slats. A stoic witness to everything.', build: 'bench', color: 0x5f6b62, mass: 55, size: [1.8, 0.85, 0.6] },
];

const construction = [
  { id: 'wood-beam', name: 'Wooden beam', desc: '4 m of timber. Welds happily to other timber.', build: 'beam', material: 'wood', color: 0xb08a5c, mass: 55, size: [4, 0.3, 0.3] },
  { id: 'steel-beam', name: 'Steel beam', desc: 'Heavy I-beam for frames that should not fold.', build: 'ibeam', material: 'metal', color: 0x878f95, mass: 320, size: [5, 0.4, 0.4] },
  { id: 'block', name: 'Concrete block', desc: '1.2 m cube of very stubborn concrete.', build: 'cube', material: 'concrete', color: 0xa9aaa5, mass: 850, size: [1.2, 1.2, 1.2] },
  { id: 'wall', name: 'Wall panel', desc: 'A 4 × 3 m wall you can freeze, weld and knock through.', build: 'wall', material: 'concrete', color: 0xb9b9b0, mass: 900, size: [4, 3, 0.25] },
  { id: 'floor', name: 'Floor slab', desc: 'Six metre slab. The start of every questionable tower.', build: 'slab', material: 'concrete', color: 0x9e9f9a, mass: 1400, size: [6, 0.35, 6] },
  { id: 'platform', name: 'Platform', desc: 'A wide 8 m deck for stunts and ramps to nowhere.', build: 'slab', material: 'metal', color: 0x78828a, mass: 900, size: [8, 0.4, 8] },
  { id: 'ramp', name: 'Ramp', desc: 'A ramp. Physics will decide what it is really for.', build: 'ramp', material: 'metal', color: 0x8f9a9f, mass: 600, size: [6, 2.4, 6] },
  { id: 'bridge-span', name: 'Bridge span', desc: 'Ten metres of road deck on two legs. Bridge anything.', build: 'span', material: 'concrete', color: 0x969a99, mass: 2600, size: [10, 1.6, 4] },
];

const special = [
  { id: 'boom-barrel', name: 'Boom barrel', desc: 'Arcade explosives, harmless until something hits it hard. Then: confetti, fire and a very large shove.', build: 'boomBarrel', color: 0xd1543f, mass: 70, size: [0.8, 1.15, 0.8] },
  { id: 'fireworks', name: 'Firework crate', desc: 'A crate of arcade rockets. Strike it and the sky gets loud.', build: 'fireworks', color: 0xd9a03a, mass: 40, size: [1.1, 0.9, 1.1] },
  { id: 'bouncy', name: 'Bouncy pad', desc: 'A springy launch pad. Cars, crates and pedestrians all come back up.', build: 'bouncy', color: 0x62bcc6, mass: 140, size: [3.4, 0.5, 3.4] },
  { id: 'gravity', name: 'Gravity well', desc: 'Pulls loose physics objects toward it. A surprisingly good city cleaner.', build: 'gravity', color: 0x7f6ae0, mass: 500, size: [1.6, 1.6, 1.6] },
  { id: 'fan', name: 'Industrial fan', desc: 'A very large fan. Pushes props, debris and anything not bolted down.', build: 'fan', color: 0x8a9ba3, mass: 180, size: [1.6, 1.9, 0.9] },
  { id: 'wrecking-ball', name: 'Wrecking ball', desc: 'A tonne of steel on a rope. The classic answer to a building.', build: 'ball', color: 0x4b5155, mass: 950, size: [1.7, 1.7, 1.7] },
];

const characters = [
  { id: 'pedestrian', name: 'Pedestrian', desc: 'A resident of the city. Walks a route, dodges traffic, reacts to chaos.', build: 'pedestrian', color: 0x5f8fa6, mass: 78, size: [0.6, 1.75, 0.5] },
  { id: 'ragdoll-blue', name: 'Ragdoll – navy', desc: 'A fully jointed, entirely non-graphic physics ragdoll.', build: 'ragdoll', color: 0x3f6f9c, mass: 72, size: [0.6, 1.75, 0.35] },
  { id: 'ragdoll-orange', name: 'Ragdoll – orange', desc: 'Another ragdoll, another colour, equally floppy.', build: 'ragdoll', color: 0xd08b45, mass: 72, size: [0.6, 1.75, 0.35] },
  { id: 'ragdoll-green', name: 'Ragdoll – olive', desc: 'A ragdoll in work clothes. Test your weld tool on a person.', build: 'ragdoll', color: 0x6f8a4f, mass: 72, size: [0.6, 1.75, 0.35] },
];

function withCategory(items, cat) {
  return items.map((item) => ({ ...item, cat }));
}

export const CATALOG = [
  ...withCategory(vehicles.map((item) => ({ ...item, build: 'vehicle' })), 'vehicles'),
  ...withCategory(objectProps, 'objects'),
  ...withCategory(construction, 'construction'),
  ...withCategory(special, 'special'),
  ...withCategory(characters, 'characters'),
];

export const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]));

export const TOOL_HINTS = {
  spawn: ['<b>Tab</b> opens the spawn menu', '<b>F</b> enter a vehicle', '<b>V</b> free camera'],
};

// Physics and render budgets, scaled by the quality menus.
export const QUALITY = {
  low: { pixelRatio: 1, shadows: 1024, shadowRange: 55, fogFar: 250, debris: 70, props: 90, npc: 10, physicsHz: 45, shake: 0.7 },
  medium: { pixelRatio: 1.35, shadows: 2048, shadowRange: 75, fogFar: 330, debris: 150, props: 160, npc: 18, physicsHz: 60, shake: 1 },
  high: { pixelRatio: 2, shadows: 4096, shadowRange: 95, fogFar: 420, debris: 240, props: 240, npc: 26, physicsHz: 60, shake: 1.2 },
};

export const TIME_PRESETS = {
  day: { sun: [0.72, 0.92, 0.32], skyTop: 0x3f7fc4, skyBottom: 0xc8dbe4, sunColor: 0xfff3d6, sunIntensity: 2.5, hemi: 1.0, ambient: 0x9fb6c2, ambientIntensity: 0.8, fog: 0xc2d4dc, night: 0 },
  dusk: { sun: [-0.55, 0.28, 0.62], skyTop: 0x2b3d5c, skyBottom: 0xe9a166, sunColor: 0xffb072, sunIntensity: 1.7, hemi: 0.55, ambient: 0x8d7f88, ambientIntensity: 0.45, fog: 0xd9b193, night: 0.45 },
  night: { sun: [0.28, 0.55, -0.7], skyTop: 0x060d1c, skyBottom: 0x172a3c, sunColor: 0x9db8e0, sunIntensity: 0.5, hemi: 0.22, ambient: 0x33475c, ambientIntensity: 0.32, fog: 0x101c27, night: 1 },
};
