export type Platform = "youtube" | "twitch";
export type ClipPlatform = "shorts" | "tiktok" | "reels";
export type Screen = "browse" | "studio" | "publish" | "analytics";
export type SubtitleStyle = "pop" | "clean" | "karaoke";
export type CropMode = "auto" | "facecam" | "gameplay";
export type PacingMode = "match" | "fast" | "cinematic";

export interface EditRecipe {
  pacing: PacingMode;
  punchIns: boolean;
  reactionZoom: boolean;
  soundFx: boolean;
  motion: boolean;
  captionEmphasis: boolean;
  loop: boolean;
  music: "none" | "bed" | "duck";
}

export interface HardwareProfile {
  os: string;
  cpu: string;
  threads: number;
  memoryGb: number;
  gpuName: string;
  gpuVendor: string;
  vramGb: number;
  webgpu: boolean;
  tier: "lite" | "balanced" | "studio";
  source: "detected" | "manual";
}

export interface LocalModel {
  id: string;
  name: string;
  purpose: string;
  sizeGb: number;
  status: "idle" | "downloading" | "ready";
  progress: number;
  required: boolean;
  speedMbps: number;
}

export interface Source {
  id: string;
  platform: Platform;
  url: string;
  title: string;
  channel: string;
  durationSec: number;
  addedAt: number;
  clipCount: number;
}

export interface Caption {
  t: number;
  text: string;
}

export interface Clip {
  id: string;
  sourceId: string;
  title: string;
  hook: string;
  /** Thumbnail URL: a real frame from the rendered clip, or a demo poster. */
  poster: string;
  posterPosition: string;
  tint: string;
  startSec: number;
  endSec: number;
  score: number;
  chatSpike: boolean;
  spikePeak: number;
  captions: Caption[];
  subtitleStyle: SubtitleStyle;
  crop: CropMode;
  edit: EditRecipe;
  status: "draft" | "ready" | "published";
  /** Absolute path of the rendered mp4, when this cut really exists on disk. */
  videoPath?: string;
  /** Absolute path of the extracted thumbnail frame. */
  thumbPath?: string;
  /** Loudest second inside the clip, in source time. */
  peakSec?: number;
  /** True when the source had captions and they were burned into the file. */
  hasCaptions?: boolean;
  /** Real Twitch chat peak (0-1) when the source is a Twitch VOD. */
  chatScore?: number;
}

export interface Post {
  id: string;
  clipId: string;
  platform: ClipPlatform;
  title: string;
  description: string;
  hashtags: string[];
  publishedAt: number;
  status: "live" | "scheduled" | "publishing";
  views: number;
  earnings: number;
  subscribers: number;
  likes: number;
  watchThrough: number;
  series: number[];
}

export interface AppState {
  version: number;
  setupComplete: boolean;
  hardware: HardwareProfile;
  models: LocalModel[];
  sources: Source[];
  clips: Clip[];
  chat: Record<string, number[]>;
  posts: Post[];
}

export interface ClipRequest {
  url: string;
  platform: Platform;
  nonce: number;
  title?: string;
  channel?: string;
  durationSec?: number;
  poster?: string;
  posterPosition?: string;
}

export const PLATFORM_LABEL: Record<ClipPlatform, string> = {
  shorts: "YouTube Shorts",
  tiktok: "TikTok",
  reels: "Instagram Reels",
};

export const PLATFORM_HANDLE: Record<ClipPlatform, string> = {
  shorts: "@kettleclips",
  tiktok: "@kettle.clips",
  reels: "@kettle.clips",
};
