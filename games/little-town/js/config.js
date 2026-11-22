/* =====================================================================
   LITTLE TOWN — configuration
   All values are public; the Firebase project is the same one the other
   Damp games use, so accounts and cloud towns work out of the box.
   ===================================================================== */

export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w",
    authDomain: "damp-2406a.firebaseapp.com",
    projectId: "damp-2406a",
    appId: "1:940989851976:web:f8fd07c258afa71fd22b7d"
  },

  mailSuffix: "@damp.example",

  collections: {
    saves: "littletown_saves",
    towns: "littletown_towns",
    likes: "likes",
    follows: "littletown_follows",
    presence: "littletown_presence",
    entries: "littletown_entries",
    votes: "littletown_votes"
  },

  storageKey: "little-town-v1",
  startCoins: 16000,
  grid: 26,
  tile: 3,
  dayLength: 190,           // real seconds per town day
  maxResidents: 260,
  maxVisibleResidents: 54,
  maxObjects: 240,
  startPopulation: 2,

  // Each step widens the buildable square around the village centre.
  landSteps: [
    { level: 1, half: 6, cost: 0, name: "Old Market Plot" },
    { level: 2, half: 8, cost: 8500, name: "Mill Lane" },
    { level: 3, half: 10, cost: 20000, name: "Riverside" },
    { level: 4, half: 12, cost: 42000, name: "South Bank" },
    { level: 5, half: 13, cost: 82000, name: "The Meadows" }
  ]
};

export const CLOUD_READY = !!(CONFIG.firebase.apiKey && CONFIG.firebase.apiKey.indexOf("PASTE") !== 0);
