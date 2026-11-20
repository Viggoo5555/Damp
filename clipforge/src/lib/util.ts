export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    const short = value / 1_000_000;
    return `${short >= 10 ? short.toFixed(1) : short.toFixed(2)}M`;
  }
  if (value >= 1000) {
    const short = value / 1000;
    return `${short >= 100 ? Math.round(short) : short.toFixed(1)}K`;
  }
  return `${Math.round(value)}`;
}

export function formatMoney(value: number, precise = false): string {
  if (precise || Math.abs(value) < 100) {
    return `$${value.toFixed(2)}`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function timecode(seconds: number, withMillis = false): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const base = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
  if (!withMillis) return base;
  const ms = Math.floor((seconds % 1) * 10);
  return `${base}.${ms}`;
}

export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const day = 86_400_000;
  if (diff < 3_600_000) {
    const minutes = Math.max(1, Math.round(diff / 60_000));
    return `${minutes} min ago`;
  }
  if (diff < day) return `${Math.round(diff / 3_600_000)} h ago`;
  if (diff < day * 7) return `${Math.round(diff / day)} d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function detectPlatform(url: string): "youtube" | "twitch" | null {
  const value = url.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("twitch.tv")) return "twitch";
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
  return null;
}

export function seriesTotal(series: number[]): number {
  return series.reduce((sum, value) => sum + value, 0);
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
