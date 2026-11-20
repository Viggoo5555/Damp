/**
 * Bridge to the Electron main process, where the real clip engine runs.
 * In a plain browser (`npm run dev` without Electron) this is null and the
 * Studio explains that clipping needs the desktop app.
 */

export interface EngineMeta {
  title: string;
  channel: string;
  durationSec: number;
  platform: string;
  webpageUrl: string;
}

export interface EngineClip {
  id: string;
  videoPath: string;
  thumbPath: string;
  clipDir: string;
  title: string;
  hook: string;
  startSec: number;
  endSec: number;
  peakSec: number;
  score: number;
  spikePeak: number;
  chatSpike: boolean;
  hasCaptions: boolean;
  captions: Array<{ t: number; text: string }>;
}

export interface EngineResult {
  meta: EngineMeta;
  clips: EngineClip[];
  chatSeries: number[];
  elapsedSec: number;
  captionsFound: number;
  chatMessages: number;
}

export interface JobProgress {
  stage: string;
  pct: number;
  message: string;
}

/** Whether the main process is mid-run and whether it is holding at a checkpoint. */
export interface JobState {
  running: boolean;
  paused: boolean;
}

export interface ToolStatus {
  ready: boolean;
  missing: string[];
  platform?: string;
}

type RunResponse = { ok: true; result: EngineResult } | { ok: false; error: string };

interface Bridge {
  isDesktop: true;
  platform: string;
  tools: () => Promise<ToolStatus>;
  installTools: () => Promise<{ ok: boolean; error?: string }>;
  run: (payload: { url: string; maxClips?: number; subtitleStyle?: string }) => Promise<RunResponse>;
  cancel: () => Promise<{ ok: boolean }>;
  pause: () => Promise<JobState>;
  resume: () => Promise<JobState>;
  jobState: () => Promise<JobState>;
  onProgress: (callback: (progress: JobProgress) => void) => () => void;
  onJobState: (callback: (state: JobState) => void) => () => void;
  reveal: (target?: string) => Promise<{ ok: boolean }>;
  clipsDir: () => Promise<string>;
  copyText: (text: string) => Promise<{ ok: boolean }>;
}

export const bridge: Bridge | null =
  typeof window !== "undefined" && (window as unknown as { offcut?: Bridge }).offcut
    ? ((window as unknown as { offcut: Bridge }).offcut)
    : null;

export const isDesktop = Boolean(bridge);

/** URL the <video>/<img> tags use for a rendered file on disk. */
export function mediaUrl(filePath: string): string {
  if (!filePath) return "";
  return `offcut-media://local/${encodeURIComponent(filePath)}`;
}

export const OFFCUT_STAGES = [
  "tools",
  "probe",
  "audio",
  "captions",
  "chat",
  "energy",
  "score",
  "download",
  "render",
] as const;

export function stageIndex(stage: string): number {
  const index = OFFCUT_STAGES.indexOf(stage as (typeof OFFCUT_STAGES)[number]);
  return index < 0 ? 0 : index;
}
