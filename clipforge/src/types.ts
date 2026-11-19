export type Platform = "youtube" | "twitch";
export type ClipPlatform = "shorts" | "tiktok" | "reels";
export type Screen = "browse" | "studio" | "export" | "library";
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
  /** Thumbnail URL: a real frame pulled from the rendered clip. */
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
  status: "draft" | "ready" | "exported";
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

export interface AppState {
  version: number;
  setupComplete: boolean;
  hardware: HardwareProfile;
  sources: Source[];
  clips: Clip[];
  chat: Record<string, number[]>;
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
