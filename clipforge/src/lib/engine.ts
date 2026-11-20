import type { Clip, CropMode, EditRecipe, Platform } from "../types";
import { clamp } from "./util";

/** Grading overlays carried by every rendered cut. */
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

export const PIPELINE_STEPS = [
  { id: "tools", label: "Checking the tools", detail: "ffmpeg and yt-dlp" },
  { id: "probe", label: "Reading the source", detail: "Title, length, real resolution" },
  { id: "audio", label: "Downloading the audio", detail: "The whole track, for loudness analysis" },
  { id: "captions", label: "Reading the transcript", detail: "The source's own captions" },
  { id: "chat", label: "Reading the chat", detail: "Twitch VOD message bursts" },
  { id: "energy", label: "Measuring loudness", detail: "Every second of the source" },
  { id: "score", label: "Scoring moments", detail: "Spikes, laughs and payoffs" },
  { id: "download", label: "Downloading the picks", detail: "Only the sections that scored" },
  { id: "render", label: "Cutting to 9:16", detail: "1080 × 1920, captions burned in" },
];
