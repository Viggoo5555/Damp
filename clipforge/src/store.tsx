import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AppState,
  Caption,
  Clip,
  ClipPlatform,
  HardwareProfile,
  LocalModel,
  Post,
  Source,
} from "./types";
import { buildShelf } from "./lib/models";
import { defaultEdit, seedContent } from "./lib/engine";

const STORAGE_KEY = "offcut.state.v1";
const STATE_VERSION = 3;

interface PublishEntry {
  clip: Clip;
  platforms: ClipPlatform[];
  copy: Record<ClipPlatform, { title: string; description: string; hashtags: string[] }>;
}

interface StoreValue {
  state: AppState;
  downloadsActive: boolean;
  downloadModel: (id: string) => void;
  downloadAll: () => void;
  removeModel: (id: string) => void;
  finishSetup: () => void;
  setHardwareProfile: (profile: HardwareProfile) => void;
  commitSource: (source: Source, clips: Clip[], chat: number[]) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  updateCaptions: (id: string, captions: Caption[]) => void;
  setClipStatus: (id: string, status: Clip["status"]) => void;
  publish: (entries: PublishEntry[]) => Post[];
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function initialState(hardware: HardwareProfile): AppState {
  const seeded = seedContent();
  return {
    version: STATE_VERSION,
    setupComplete: false,
    hardware,
    models: buildShelf(hardware.tier),
    sources: seeded.sources,
    clips: seeded.clips,
    chat: seeded.chat,
    posts: seeded.posts,
  };
}

function loadState(hardware: HardwareProfile): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState(hardware);
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !Array.isArray(parsed.models) || !Array.isArray(parsed.clips)) {
      return initialState(hardware);
    }
    // Version 1 predates the edit recipe; give those clips a sensible one.
    const clips = parsed.clips.map((clip) => {
      if (clip.edit) return clip;
      const platform = parsed.sources?.find((source) => source.id === clip.sourceId)?.platform ?? "youtube";
      return { ...clip, edit: defaultEdit(platform, clip.crop) };
    });
    return {
      ...parsed,
      version: STATE_VERSION,
      clips,
      // Interrupted downloads restart on the next launch.
      models: parsed.models.map((model) =>
        model.status === "downloading" ? { ...model, status: "idle", progress: 0 } : model,
      ),
    };
  } catch {
    return initialState(hardware);
  }
}

export function StoreProvider({ hardware, children }: { hardware: HardwareProfile; children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState(hardware));
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable in private windows */
    }
  }, [state]);

  const downloadsActive = state.models.some((model) => model.status === "downloading");

  useEffect(() => {
    if (!downloadsActive) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => {
      setState((current) => ({
        ...current,
        models: current.models.map((model) => {
          if (model.status !== "downloading") return model;
          const step = 1.4 + Math.random() * 3.4;
          const progress = Math.min(100, model.progress + step);
          return {
            ...model,
            progress,
            speedMbps: Math.round(70 + Math.random() * 80),
            status: progress >= 100 ? "ready" : "downloading",
          };
        }),
      }));
    }, 220);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [downloadsActive]);

  const downloadModel = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      models: current.models.map((model) =>
        model.id === id && model.status === "idle"
          ? { ...model, status: "downloading", progress: 2, speedMbps: 84 }
          : model,
      ),
    }));
  }, []);

  const downloadAll = useCallback(() => {
    setState((current) => ({
      ...current,
      models: current.models.map((model) =>
        model.status === "idle" ? { ...model, status: "downloading", progress: 2, speedMbps: 84 } : model,
      ),
    }));
  }, []);

  const removeModel = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      models: current.models.map((model) =>
        model.id === id ? { ...model, status: "idle", progress: 0, speedMbps: 0 } : model,
      ),
    }));
  }, []);

  const finishSetup = useCallback(() => {
    setState((current) => ({ ...current, setupComplete: true }));
  }, []);

  const setHardwareProfile = useCallback((profile: HardwareProfile) => {
    setState((current) => ({
      ...current,
      hardware: profile,
      models: buildShelf(profile.tier),
    }));
  }, []);

  const commitSource = useCallback((source: Source, clips: Clip[], chat: number[]) => {
    setState((current) => ({
      ...current,
      sources: [source, ...current.sources],
      clips: [...clips, ...current.clips],
      chat: chat.length ? { ...current.chat, [source.id]: chat } : current.chat,
    }));
  }, []);

  const updateClip = useCallback((id: string, patch: Partial<Clip>) => {
    setState((current) => ({
      ...current,
      clips: current.clips.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip)),
    }));
  }, []);

  const updateCaptions = useCallback((id: string, captions: Caption[]) => {
    setState((current) => ({
      ...current,
      clips: current.clips.map((clip) => (clip.id === id ? { ...clip, captions } : clip)),
    }));
  }, []);

  const setClipStatus = useCallback((id: string, status: Clip["status"]) => {
    setState((current) => ({
      ...current,
      clips: current.clips.map((clip) => (clip.id === id ? { ...clip, status } : clip)),
    }));
  }, []);

  const publish = useCallback((entries: PublishEntry[]) => {
    const created: Post[] = [];
    const publishedAt = Date.now();
    const rpmByPlatform: Record<ClipPlatform, number> = { shorts: 0.074, tiktok: 0.031, reels: 0.052 };
    entries.forEach((entry) => {
      entry.platforms.forEach((platform) => {
        const copy = entry.copy[platform];
        // First hours of a launch are simulated: a clip scores, it earns a proportional head start.
        const views = Math.round(entry.clip.score * (platform === "tiktok" ? 900 : 520) * (0.7 + Math.random() * 0.6));
        const series = Array.from({ length: 30 }, () => 0);
        series[29] = views;
        created.push({
          id: `post-${publishedAt.toString(36)}-${platform}-${entry.clip.id}`,
          clipId: entry.clip.id,
          platform,
          title: copy.title,
          description: copy.description,
          hashtags: copy.hashtags,
          publishedAt,
          status: "live",
          views,
          earnings: +(views * (rpmByPlatform[platform] / 1000)).toFixed(2),
          subscribers: Math.round(views * 0.0042),
          likes: Math.round(views * 0.058),
          watchThrough: 0.58 + Math.random() * 0.24,
          series,
        });
      });
    });
    setState((current) => ({
      ...current,
      posts: [...created, ...current.posts],
      clips: current.clips.map((clip) =>
        entries.some((entry) => entry.clip.id === clip.id) ? { ...clip, status: "published" } : clip,
      ),
    }));
    return created;
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState(hardware));
  }, [hardware]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      downloadsActive,
      downloadModel,
      downloadAll,
      removeModel,
      finishSetup,
      setHardwareProfile,
      commitSource,
      updateClip,
      updateCaptions,
      setClipStatus,
      publish,
      reset,
    }),
    [
      state,
      downloadsActive,
      downloadModel,
      downloadAll,
      removeModel,
      finishSetup,
      setHardwareProfile,
      commitSource,
      updateClip,
      updateCaptions,
      setClipStatus,
      publish,
      reset,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

export type { LocalModel };
