import type { Caption, Clip, ClipPlatform, CropMode, EditRecipe, Platform, Post, Source } from "../types";
import { clamp, hashString, mulberry32 } from "./util";

/* ------------------------------------------------------------------ *
 * Seed library — a channel with history, so every screen has signal. *
 * ------------------------------------------------------------------ */

export const TINT_PRESETS = [
  "linear-gradient(180deg, rgba(13,20,32,0) 30%, rgba(13,20,32,.35) 78%, rgba(13,20,32,.86) 100%)",
  "linear-gradient(180deg, rgba(13,20,32,.06) 20%, rgba(13,20,32,.5) 80%, rgba(13,20,32,.9) 100%)",
];

/* --------------------------------------------------------------- *
 * Edit recipe + viral pass                                       *
 * --------------------------------------------------------------- */

export function defaultEdit(platform: Platform, crop: CropMode): EditRecipe {
  return {
    pacing: "match",
    punchIns: true,
    reactionZoom: crop !== "gameplay",
    soundFx: platform === "twitch",
    motion: true,
    captionEmphasis: true,
    loop: true,
    music: "duck",
  };
}

export interface ViralReport {
  score: number;
  parts: { hook: number; pacing: number; loop: number; clarity: number; payoff: number };
  hooks: string[];
  titles: string[];
  hashtags: string[];
  notes: string[];
  bestFrame: number;
}

/** A deterministic read on how well this cut is built to travel, given its edit. */
export function viralReport(clip: Clip): ViralReport {
  const edit = clip.edit;
  const length = clip.endSec - clip.startSec;
  const tempo = length <= 28 ? 9 : length <= 40 ? 5 : length <= 52 ? 1 : -4;
  const editBonus =
    (edit.punchIns ? 2 : 0) +
    (edit.reactionZoom && clip.crop !== "gameplay" ? 2 : 0) +
    (edit.soundFx ? 1 : 0) +
    (edit.motion ? 1 : 0) +
    (edit.captionEmphasis ? 2 : 0) +
    (edit.loop ? 2 : 0) +
    (edit.music !== "none" ? 1 : 0) +
    (edit.pacing === "fast" ? 2 : edit.pacing === "cinematic" ? (length >= 40 ? 1 : -2) : 0);

  const score = clamp(Math.round(38 + clip.score * 0.3 + clip.spikePeak * 14 + tempo + editBonus), 41, 98);
  const hook = clamp(
    Math.round(50 + (clip.score - 75) * 1.3 + clip.spikePeak * 12 + (edit.captionEmphasis ? 4 : 0)),
    28,
    99,
  );
  const pacing = clamp(
    Math.round(56 + tempo * 1.6 + (edit.punchIns ? 8 : 0) + (edit.pacing === "fast" ? 7 : 0) + (edit.motion ? 4 : 0)),
    30,
    99,
  );
  const loop = clamp(Math.round(46 + (edit.loop ? 34 : 0) + (edit.music !== "none" ? 6 : 0)), 30, 96);
  const clarity = clamp(
    Math.round(58 + (edit.captionEmphasis ? 15 : 0) + (clip.subtitleStyle === "clean" ? 4 : 8) + clip.captions.length),
    35,
    99,
  );
  const payoff = clamp(Math.round(50 + clip.spikePeak * 42 + (clip.score - 70) * 0.9), 30, 99);

  const notes: string[] = [];
  if (length > 42) notes.push("Trim the setup — the first seconds are explanation, not payoff.");
  if (clip.chatSpike) notes.push("Chat peaked before the punchline. Open 1.4 s earlier and lead with it.");
  if (!edit.loop) notes.push("End back on the first frame so the replay feels deliberate.");
  if (!edit.punchIns) notes.push("Add a punch-in where the reaction lands; still frames lose the swipe.");
  if (edit.captionEmphasis) notes.push("Emphasise one punch word per line — it reads at a glance.");
  if (notes.length < 2) notes.push("Cut 0.4 s of dead air after the payoff, then loop.");

  return {
    score,
    parts: { hook, pacing, loop, clarity, payoff },
    hooks: Array.from(
      new Set([
        clip.hook,
        clip.chatSpike ? "chat told them not to" : "nobody was ready for this",
        length <= 30 ? "watch the last three seconds" : "this escalated quickly",
      ]),
    ).slice(0, 3),
    titles: Array.from(
      new Set([
        clip.title,
        `${clip.title} (wait for it)`,
        clip.chatSpike ? "chat called it before it happened" : "the last five seconds broke them",
      ]),
    ).slice(0, 3),
    hashtags: ["#shorts", "#fyp", "#clips", "#streamer"],
    notes: notes.slice(0, 3),
    bestFrame: Math.round(length * 0.46),
  };
}

/** The strongest recipe available for this cut, for the one-tap boost. */
export function recommendedEdit(clip: Clip): EditRecipe {
  const base = clip.edit;
  const candidates: EditRecipe[] = [
    {
      ...base,
      pacing: "fast",
      punchIns: true,
      reactionZoom: true,
      soundFx: true,
      motion: true,
      captionEmphasis: true,
      loop: true,
      music: "duck",
    },
    {
      ...base,
      pacing: "match",
      punchIns: true,
      reactionZoom: clip.crop !== "gameplay",
      soundFx: base.soundFx,
      motion: true,
      captionEmphasis: true,
      loop: true,
      music: "duck",
    },
    {
      ...base,
      pacing: "cinematic",
      punchIns: true,
      reactionZoom: true,
      soundFx: false,
      motion: true,
      captionEmphasis: true,
      loop: true,
      music: "bed",
    },
  ];
  return candidates.reduce((best, candidate) =>
    viralReport({ ...clip, edit: candidate }).score > viralReport({ ...clip, edit: best }).score
      ? candidate
      : best,
  );
}

const SPOKEN_LINES = [
  "okay okay okay, hear me out",
  "that is not what the recipe said",
  "no, no, you have to stir it",
  "i'm telling you it's fine",
  "why is it green",
  "chat, is this legal",
  "i have never seen that happen before",
  "that was actually insane",
  "who approved this",
  "i'm not even mad, i'm impressed",
  "one more game, i swear",
  "we are so back",
  "that's a clip, don't clip it",
  "you saw that too, right",
  "the timer said forty seconds",
  "i'm going to need a minute",
  "this is the funniest thing all week",
  "bro, the smoke alarm",
  "twelve dollars for that",
  "i'm not crying, you are",
  "that was the run",
  "no shot, no shot",
  "tell me you got that",
  "okay chat, what do we do",
  "i have made a mistake",
];

function makeCaptions(seed: number, count: number, durationSec: number): Caption[] {
  const rng = mulberry32(seed);
  const step = durationSec / count;
  return Array.from({ length: count }, (_, index) => ({
    t: +(0.2 + index * step + rng() * step * 0.22).toFixed(2),
    text: SPOKEN_LINES[Math.floor(rng() * SPOKEN_LINES.length)],
  }));
}

function makeChatSeries(seed: number, length = 110): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length }, (_, index) => {
    const base = 18 + Math.sin(index / 9) * 6 + rng() * 14;
    const burst = index % 23 === 0 ? 40 + rng() * 55 : 0;
    return Math.round(base + burst);
  });
}

function series(seed: number, total: number, ageDays: number): number[] {
  const rng = mulberry32(seed);
  const values = Array.from({ length: 30 }, () => 0);
  const start = Math.max(0, 30 - ageDays);
  const weights: number[] = [];
  for (let d = 0; d < 30 - start; d += 1) {
    weights.push(1.9 * Math.exp(-d / 4.2) + 0.22 + rng() * 0.35);
  }
  const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
  weights.forEach((weight, index) => {
    values[start + index] = Math.round((weight / weightSum) * total);
  });
  return values;
}

const now = Date.now();
const DAY = 86_400_000;

const seedSources: Source[] = [
  {
    id: "src-twitch-1",
    platform: "twitch",
    url: "https://twitch.tv/nix/videos/2184337192",
    title: "ranked grind to diamond — day 4",
    channel: "nix",
    durationSec: 11_840,
    addedAt: now - DAY * 2.2,
    clipCount: 6,
  },
  {
    id: "src-yt-1",
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=8Qv3kR2mT1a",
    title: "we tried the worst cooking hacks on the internet",
    channel: "Two Pans",
    durationSec: 2530,
    addedAt: now - DAY * 6,
    clipCount: 5,
  },
];

const seedClipsBase: Array<Omit<Clip, "edit">> = [
  {
    id: "clip-t1",
    sourceId: "src-twitch-1",
    title: "he had one HP and still sent it",
    hook: "he's literally one HP",
    poster: "posters/streamer.jpg",
    posterPosition: "50% 26%",
    tint: TINT_PRESETS[1],
    startSec: 1820,
    endSec: 1858,
    score: 96,
    chatSpike: true,
    spikePeak: 1,
    captions: makeCaptions(11, 7, 38),
    subtitleStyle: "pop",
    crop: "auto",
    status: "published",
  },
  {
    id: "clip-t2",
    sourceId: "src-twitch-1",
    title: "the chat carried this round",
    hook: "chat, look at the timer",
    poster: "posters/streamer.jpg",
    posterPosition: "46% 34%",
    tint: TINT_PRESETS[0],
    startSec: 2740,
    endSec: 2795,
    score: 91,
    chatSpike: true,
    spikePeak: 0.82,
    captions: makeCaptions(12, 8, 55),
    subtitleStyle: "karaoke",
    crop: "facecam",
    status: "published",
  },
  {
    id: "clip-t3",
    sourceId: "src-twitch-1",
    title: "explaining the plan for forty seconds",
    hook: "so the plan is—",
    poster: "posters/streamer.jpg",
    posterPosition: "52% 20%",
    tint: TINT_PRESETS[0],
    startSec: 4100,
    endSec: 4162,
    score: 84,
    chatSpike: false,
    spikePeak: 0.34,
    captions: makeCaptions(13, 9, 62),
    subtitleStyle: "clean",
    crop: "facecam",
    status: "ready",
  },
  {
    id: "clip-t4",
    sourceId: "src-twitch-1",
    title: "this is why we don't queue at 3am",
    hook: "who is awake right now",
    poster: "posters/streamer.jpg",
    posterPosition: "48% 40%",
    tint: TINT_PRESETS[1],
    startSec: 6230,
    endSec: 6290,
    score: 88,
    chatSpike: true,
    spikePeak: 0.95,
    captions: makeCaptions(14, 7, 60),
    subtitleStyle: "pop",
    crop: "auto",
    status: "published",
  },
  {
    id: "clip-t5",
    sourceId: "src-twitch-1",
    title: "she read the chat out loud and instantly regretted it",
    hook: "read what he said",
    poster: "posters/streamer.jpg",
    posterPosition: "54% 30%",
    tint: TINT_PRESETS[0],
    startSec: 7910,
    endSec: 7960,
    score: 93,
    chatSpike: true,
    spikePeak: 0.76,
    captions: makeCaptions(15, 7, 50),
    subtitleStyle: "karaoke",
    crop: "facecam",
    status: "ready",
  },
  {
    id: "clip-t6",
    sourceId: "src-twitch-1",
    title: "the comeback nobody asked for",
    hook: "we are not losing to this",
    poster: "posters/nightcity.jpg",
    posterPosition: "50% 55%",
    tint: TINT_PRESETS[1],
    startSec: 9100,
    endSec: 9145,
    score: 79,
    chatSpike: false,
    spikePeak: 0.28,
    captions: makeCaptions(16, 6, 45),
    subtitleStyle: "clean",
    crop: "gameplay",
    status: "draft",
  },
  {
    id: "clip-y1",
    sourceId: "src-yt-1",
    title: "we tried the worst cooking hacks",
    hook: "who approved this recipe",
    poster: "posters/podcast.jpg",
    posterPosition: "50% 42%",
    tint: TINT_PRESETS[1],
    startSec: 420,
    endSec: 476,
    score: 94,
    chatSpike: false,
    spikePeak: 0,
    captions: makeCaptions(21, 8, 56),
    subtitleStyle: "pop",
    crop: "auto",
    status: "published",
  },
  {
    id: "clip-y2",
    sourceId: "src-yt-1",
    title: "the 4am kitchen incident",
    hook: "the smoke alarm was a warning",
    poster: "posters/podcast.jpg",
    posterPosition: "46% 48%",
    tint: TINT_PRESETS[0],
    startSec: 1010,
    endSec: 1058,
    score: 89,
    chatSpike: false,
    spikePeak: 0,
    captions: makeCaptions(22, 7, 48),
    subtitleStyle: "karaoke",
    crop: "auto",
    status: "ready",
  },
  {
    id: "clip-y3",
    sourceId: "src-yt-1",
    title: "our guest has never boiled water",
    hook: "you've never—",
    poster: "posters/podcast.jpg",
    posterPosition: "54% 36%",
    tint: TINT_PRESETS[0],
    startSec: 1580,
    endSec: 1625,
    score: 86,
    chatSpike: false,
    spikePeak: 0,
    captions: makeCaptions(23, 6, 45),
    subtitleStyle: "pop",
    crop: "auto",
    status: "draft",
  },
  {
    id: "clip-y4",
    sourceId: "src-yt-1",
    title: "the $12 ingredient that ruined dinner",
    hook: "twelve dollars for that",
    poster: "posters/podcast.jpg",
    posterPosition: "42% 44%",
    tint: TINT_PRESETS[1],
    startSec: 2040,
    endSec: 2084,
    score: 81,
    chatSpike: false,
    spikePeak: 0,
    captions: makeCaptions(24, 7, 44),
    subtitleStyle: "clean",
    crop: "auto",
    status: "draft",
  },
  {
    id: "clip-y5",
    sourceId: "src-yt-1",
    title: "we read the comments so you don't have to",
    hook: "this one is personal",
    poster: "posters/podcast.jpg",
    posterPosition: "58% 40%",
    tint: TINT_PRESETS[0],
    startSec: 2320,
    endSec: 2358,
    score: 77,
    chatSpike: false,
    spikePeak: 0,
    captions: makeCaptions(25, 6, 38),
    subtitleStyle: "clean",
    crop: "auto",
    status: "draft",
  },
];

const seedPlatform = (sourceId: string): Platform =>
  sourceId === "src-twitch-1" ? "twitch" : "youtube";

const seedClips: Clip[] = seedClipsBase.map((clip) => ({
  ...clip,
  edit: defaultEdit(seedPlatform(clip.sourceId), clip.crop),
}));

const seedPosts: Post[] = [
  {
    id: "post-1",
    clipId: "clip-t1",
    platform: "shorts",
    title: "he had ONE HP and still went for it 💀",
    description:
      "Ranked at 3am is a different game. Full VOD on the channel — this one had chat absolutely losing it.",
    hashtags: ["#shorts", "#twitch", "#gaming", "#ranked"],
    publishedAt: now - DAY * 12,
    status: "live",
    views: 412_400,
    earnings: 29.84,
    subscribers: 1420,
    likes: 31_200,
    watchThrough: 0.86,
    series: series(101, 412_400, 12),
  },
  {
    id: "post-2",
    clipId: "clip-t1",
    platform: "tiktok",
    title: "one hp. one chance. one very loud scream.",
    description: "he said he had it under control. he did not have it under control.",
    hashtags: ["#twitchclips", "#fyp", "#gaming"],
    publishedAt: now - DAY * 11,
    status: "live",
    views: 738_900,
    earnings: 22.1,
    subscribers: 2260,
    likes: 88_100,
    watchThrough: 0.71,
    series: series(102, 738_900, 11),
  },
  {
    id: "post-3",
    clipId: "clip-t2",
    platform: "reels",
    title: "chat called the play before he did",
    description: "The timer said forty seconds. Chat said twelve. Chat was right.",
    hashtags: ["#streamer", "#clips", "#gaming"],
    publishedAt: now - DAY * 9,
    status: "live",
    views: 96_300,
    earnings: 6.2,
    subscribers: 410,
    likes: 7_400,
    watchThrough: 0.68,
    series: series(103, 96_300, 9),
  },
  {
    id: "post-4",
    clipId: "clip-t4",
    platform: "shorts",
    title: "this is why we don't queue at 3am",
    description: "The lobby at 3am is undefeated. Chat was zero help, as usual.",
    hashtags: ["#shorts", "#latednight", "#twitch"],
    publishedAt: now - DAY * 7,
    status: "live",
    views: 208_800,
    earnings: 15.6,
    subscribers: 780,
    likes: 18_900,
    watchThrough: 0.79,
    series: series(104, 208_800, 7),
  },
  {
    id: "post-5",
    clipId: "clip-t5",
    platform: "tiktok",
    title: "she read the chat out loud and immediately regretted it",
    description: "Never read the chat on stream. Never.",
    hashtags: ["#twitch", "#streamerclips", "#fyp"],
    publishedAt: now - DAY * 5,
    status: "live",
    views: 331_200,
    earnings: 9.94,
    subscribers: 1180,
    likes: 41_600,
    watchThrough: 0.74,
    series: series(105, 331_200, 5),
  },
  {
    id: "post-6",
    clipId: "clip-t3",
    platform: "shorts",
    title: "forty seconds of planning, zero seconds of execution",
    description: "The plan was beautiful. The plan did not survive contact with the lobby.",
    hashtags: ["#shorts", "#gaming", "#funny"],
    publishedAt: now - DAY * 3,
    status: "live",
    views: 64_800,
    earnings: 4.8,
    subscribers: 260,
    likes: 5_900,
    watchThrough: 0.81,
    series: series(106, 64_800, 3),
  },
  {
    id: "post-7",
    clipId: "clip-y1",
    platform: "shorts",
    title: "we tried the worst cooking hacks on the internet",
    description: "Some of these should be illegal. One of them nearly was.",
    hashtags: ["#shorts", "#cooking", "#trythis"],
    publishedAt: now - DAY * 4,
    status: "live",
    views: 187_500,
    earnings: 13.1,
    subscribers: 690,
    likes: 16_200,
    watchThrough: 0.72,
    series: series(107, 187_500, 4),
  },
  {
    id: "post-8",
    clipId: "clip-y2",
    platform: "reels",
    title: "the 4am kitchen incident",
    description: "A smoke alarm, a fire extinguisher and absolutely no regrets.",
    hashtags: ["#cooking", "#fail", "#kitchen"],
    publishedAt: now - DAY * 2,
    status: "live",
    views: 88_600,
    earnings: 5.7,
    subscribers: 300,
    likes: 8_100,
    watchThrough: 0.66,
    series: series(108, 88_600, 2),
  },
];

export function seedContent(): { sources: Source[]; clips: Clip[]; chat: Record<string, number[]>; posts: Post[] } {
  return {
    sources: seedSources,
    clips: seedClips,
    chat: { "src-twitch-1": makeChatSeries(77) },
    posts: seedPosts,
  };
}

/* ------------------------------------------------- *
 * Live analysis — deterministic per pasted link.    *
 * ------------------------------------------------- */

const SOURCE_TITLES: Record<Platform, string[]> = {
  youtube: [
    "we tried the worst cooking hacks on the internet",
    "24 hours in a lighthouse",
    "the budget build that actually worked",
    "reacting to my old videos",
    "the most cursed food video on this site",
    "i made my own internet provider",
  ],
  twitch: [
    "ranked grind to diamond — day 4",
    "just chatting then maybe ranked",
    "cozy stream, three hour build",
    "subathon hour eleven",
    "viewer games until someone cries",
    "late night queue, no map knowledge",
  ],
};

const CHANNEL_NAMES = ["nix", "kettle", "juniper", "moth", "pascal", "two pans"];

const GEN_TITLES = [
  "he really thought that would work",
  "chat called it before it happened",
  "one more game, one more clip",
  "this is the funniest minute of the stream",
  "the run ended here",
  "i have never seen that before",
  "not the ending we wanted",
  "why is that even allowed",
  "the lobby was not ready for this",
  "this is why we stream",
];

const GEN_HOOKS = [
  "wait, wait, wait",
  "no shot",
  "chat, what was that",
  "i'm done",
  "he actually did it",
  "tell me you saw that",
  "one more game",
  "this is the run",
  "that's a clip",
  "why is that allowed",
];

export interface GeneratedSource {
  source: Source;
  clips: Clip[];
  chat: number[];
}

export interface GeneratedSourceMeta {
  title?: string;
  channel?: string;
  durationSec?: number;
  poster?: string;
  posterPosition?: string;
}

export function generateSource(
  url: string,
  platform: Platform,
  sequence: number,
  meta?: GeneratedSourceMeta,
): GeneratedSource {
  const seed = hashString(`${url}|${sequence}`);
  const rng = mulberry32(seed);
  const id = `src-${platform}-${seed.toString(36).slice(0, 6)}`;
  const clipCount = 4 + Math.floor(rng() * 3);
  const posterSet = meta?.poster
    ? [meta.poster]
    : platform === "twitch"
      ? ["posters/streamer.jpg", "posters/nightcity.jpg"]
      : ["posters/podcast.jpg", "posters/streamer.jpg"];

  const source: Source = {
    id,
    platform,
    url,
    title: meta?.title || SOURCE_TITLES[platform][Math.floor(rng() * SOURCE_TITLES[platform].length)],
    channel: meta?.channel || CHANNEL_NAMES[Math.floor(rng() * CHANNEL_NAMES.length)],
    durationSec:
      meta?.durationSec ??
      (platform === "twitch" ? 5400 + Math.floor(rng() * 9000) : 1200 + Math.floor(rng() * 2400)),
    addedAt: Date.now(),
    clipCount,
  };

  const usedTitles = new Set<string>();
  const clips: Clip[] = Array.from({ length: clipCount }, (_, index) => {
    let title = GEN_TITLES[Math.floor(rng() * GEN_TITLES.length)];
    let guard = 0;
    while (usedTitles.has(title) && guard < 12) {
      title = GEN_TITLES[Math.floor(rng() * GEN_TITLES.length)];
      guard += 1;
    }
    usedTitles.add(title);

    const length = 22 + Math.floor(rng() * 36);
    const start = 300 + Math.floor(rng() * Math.max(600, source.durationSec - length - 400));
    const spike = platform === "twitch" && rng() > 0.36;
    const score = Math.max(72, Math.min(97, Math.round(78 + rng() * 20 + (spike ? 4 : 0))));
    const crop = (["auto", "facecam", "gameplay"] as const)[index % 3];
    const subtitleStyle = (["pop", "clean", "karaoke"] as const)[index % 3];

    return {
      id: `clip-${seed.toString(36).slice(0, 5)}-${index}`,
      sourceId: id,
      title,
      hook: GEN_HOOKS[Math.floor(rng() * GEN_HOOKS.length)],
      poster: posterSet[index % posterSet.length],
      posterPosition: meta?.posterPosition ?? `${42 + Math.round(rng() * 16)}% ${24 + Math.round(rng() * 24)}%`,
      tint: TINT_PRESETS[index % TINT_PRESETS.length],
      startSec: start,
      endSec: start + length,
      score,
      chatSpike: spike,
      spikePeak: spike ? 0.6 + rng() * 0.4 : 0.18 + rng() * 0.2,
      captions: makeCaptions(seed + index * 31, 6 + Math.floor(rng() * 3), length),
      subtitleStyle,
      crop,
      edit: defaultEdit(platform, crop),
      status: "draft",
    };
  });

  const chat = platform === "twitch" ? makeChatSeries(seed + 9) : [];

  return { source, clips, chat };
}

export const PIPELINE_STEPS = [
  { id: "fetch", label: "Pulling the source", detail: "Video, audio and metadata" },
  { id: "transcribe", label: "Transcribing", detail: "Word-level timings for subtitles" },
  { id: "chat", label: "Reading the chat", detail: "Message velocity and emote bursts" },
  { id: "score", label: "Scoring moments", detail: "Laughs, hooks, payoffs, dead air" },
  { id: "cut", label: "Cutting and reframing", detail: "9:16 crop that follows the action" },
  { id: "edit", label: "Matching the edit", detail: "Pacing, punch-ins and sound read from the source" },
  { id: "captions", label: "Burning subtitles", detail: "Two-line captions, safe margins" },
  { id: "viral", label: "Running the viral pass", detail: "Hook, loop point and thumbnail frame" },
  { id: "render", label: "Rendering", detail: "1080 × 1920, 60 fps, H.264" },
];

export function suggestCopy(clip: Clip, platform: ClipPlatform): { title: string; description: string; hashtags: string[] } {
  const base = clip.title.replace(/^[a-z]/, (char) => char.toUpperCase());
  const suffix: Record<ClipPlatform, string> = {
    shorts: " #shorts",
    tiktok: " #fyp",
    reels: " #reels",
  };
  const hashtags: Record<ClipPlatform, string[]> = {
    shorts: ["#shorts", "#streamer", "#clips"],
    tiktok: ["#fyp", "#twitchclips", "#gaming"],
    reels: ["#reels", "#streamer", "#funny"],
  };
  return {
    title: `${base} — ${clip.hook}${suffix[platform]}`.slice(0, 100),
    description: `${clip.hook}. Cut from a ${platform === "shorts" ? "long-form" : "live"} source with Offcut. Full video on the channel.`,
    hashtags: hashtags[platform],
  };
}
