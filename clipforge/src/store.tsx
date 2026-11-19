import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppState, Caption, Clip, HardwareProfile, Source } from "./types";

// A new key and version: anything stored by the old sample library is discarded.
const STORAGE_KEY = "offcut.state.v2";
const STATE_VERSION = 4;

interface StoreValue {
  state: AppState;
  finishSetup: () => void;
  setHardwareProfile: (profile: HardwareProfile) => void;
  commitSource: (source: Source, clips: Clip[], chat: number[]) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  updateCaptions: (id: string, captions: Caption[]) => void;
  setClipStatus: (id: string, status: Clip["status"]) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function emptyState(hardware: HardwareProfile): AppState {
  return {
    version: STATE_VERSION,
    setupComplete: false,
    hardware,
    sources: [],
    clips: [],
    chat: {},
  };
}

function loadState(hardware: HardwareProfile): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState(hardware);
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.clips)) {
      return emptyState(hardware);
    }
    return {
      ...parsed,
      hardware,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      chat: parsed.chat && typeof parsed.chat === "object" ? parsed.chat : {},
      setupComplete: Boolean(parsed.setupComplete),
    };
  } catch {
    return emptyState(hardware);
  }
}

export function StoreProvider({ hardware, children }: { hardware: HardwareProfile; children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState(hardware));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable in private windows */
    }
  }, [state]);

  const finishSetup = useCallback(() => {
    setState((current) => ({ ...current, setupComplete: true }));
  }, []);

  const setHardwareProfile = useCallback((profile: HardwareProfile) => {
    setState((current) => ({ ...current, hardware: profile }));
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

  const value = useMemo<StoreValue>(
    () => ({
      state,
      finishSetup,
      setHardwareProfile,
      commitSource,
      updateClip,
      updateCaptions,
      setClipStatus,
    }),
    [state, finishSetup, setHardwareProfile, commitSource, updateClip, updateCaptions, setClipStatus],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}
