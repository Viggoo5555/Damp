/* =====================================================================
   BAKE OFF! — configuration
   Point the game at a Firebase project here. The values below are the
   public settings of the same Damp project the other games use, so
   accounts, cloud saves, matchmaking and the leaderboard work out of
   the box. Nothing else in the game needs changing.
   ===================================================================== */

export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w",
    authDomain: "damp-2406a.firebaseapp.com",
    projectId: "damp-2406a",
    appId: "1:940989851976:web:f8fd07c258afa71fd22b7d"
  },

  // Usernames are turned into addresses under the hood, which is what
  // makes them unique without asking anyone for an email.
  mailSuffix: "@damp.example",

  collections: {
    saves: "bakeoff_saves",
    profiles: "bakeoff_profiles",
    matches: "bakeoff_matches",
    claims: "bakeoff_claims",
    follows: "bakeoff_follows",
    invites: "bakeoff_invites",
    presence: "bakeoff_presence"
  },

  maxPlayers: 8,
  minPlayers: 2,
  storageKey: "bake-off-v1",
  startCoins: 900,

  // Match phase lengths in seconds. The whole show runs about 3½ minutes
  // from theme to results.
  phaseSeconds: {
    theme: 7,
    prepare: 62,
    bake: 50,
    decorate: 78,
    show: 22,
    vote: 26,
    results: 30
  },

  rewardCap: { coins: 1500, xp: 800 }
};

export const CLOUD_READY = !!(CONFIG.firebase.apiKey && CONFIG.firebase.apiKey.indexOf("PASTE") !== 0);
