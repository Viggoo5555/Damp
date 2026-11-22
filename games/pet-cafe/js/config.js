/* =====================================================================
   PET CAFÉ — configuration
   Everything you need to point the game at your own Firebase project
   lives in this one file. Paste your web app settings into `firebase`
   and the game switches from "save on this device" to real accounts,
   cloud saves, visits, likes, friends and the weekly competition.

   The values below are the same public Firebase project the rest of
   Damp uses, so Pet Café works out of the box. Replace them with your
   own project if you like — nothing else in the game needs to change.
   ===================================================================== */

export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w",
    authDomain: "damp-2406a.firebaseapp.com",
    projectId: "damp-2406a",
    appId: "1:940989851976:web:f8fd07c258afa71fd22b7d"
  },

  // Accounts are username + password. The game turns the username into an
  // email address under the hood, which is what makes usernames unique.
  mailSuffix: "@damp.example",

  collections: {
    saves: "petcafe_saves",
    publicCafes: "petcafe_public",
    likes: "petcafe_likes",
    ratings: "petcafe_ratings",
    follows: "petcafe_follows",
    entries: "petcafe_entries",
    votes: "petcafe_votes",
    presence: "petcafe_presence"
  },

  startCoins: 850,
  startXp: 0,
  storageKey: "pet-cafe-v1",
  maxActiveAnimals: 6,
  maxOrders: 4,
  maxLayoutItems: 140,
  dailyCoins: 140,
  dailyXp: 30,

  // Café shell in metres. The patio grows with the two expansions.
  room: { w: 16, d: 12, h: 4.1, patio: 5 },
  grid: 0.5
};

export const CLOUD_READY = !!(CONFIG.firebase.apiKey && CONFIG.firebase.apiKey.indexOf("PASTE") !== 0);
