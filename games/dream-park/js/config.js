/* =====================================================================
   DREAM PARK — configuration
   The Firebase values are the public settings of the Damp project the
   other games use, so accounts and cloud parks work out of the box.
   ===================================================================== */

export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w",
    authDomain: "damp-2406a.firebaseapp.com",
    projectId: "damp-2406a",
    appId: "1:940989851976:web:f8fd07c258afa71fd22b7d"
  },

  // Usernames become addresses under the hood, which is what keeps them
  // unique without asking anyone for an email.
  mailSuffix: "@damp.example",

  collections: {
    saves: "dreampark_saves",
    parks: "dreampark_parks",
    likes: "likes",
    follows: "dreampark_follows",
    presence: "dreampark_presence",
    entries: "dreampark_entries",
    votes: "dreampark_votes"
  },

  storageKey: "dream-park-v1",
  startCoins: 12000,
  maxVisitors: 48,
  dayLength: 210,          // seconds of real time per park day
  openHour: 9,
  closeHour: 22,
  maxObjects: 260
};

export const CLOUD_READY = !!(CONFIG.firebase.apiKey && CONFIG.firebase.apiKey.indexOf("PASTE") !== 0);
