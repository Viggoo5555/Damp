import type { HardwareProfile } from "../types";

export function detectOs(): string {
  const ua = navigator.userAgent;
  if (/Windows NT 11/.test(ua)) return "Windows 11";
  if (/Windows NT 10/.test(ua)) return "Windows 10";
  if (/Mac OS X 1[0-9]/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Your machine";
}

interface GpuAdapterLike {
  info?: { vendor?: string; architecture?: string; description?: string };
  requestAdapterInfo?: () => Promise<{ vendor?: string; architecture?: string; description?: string }>;
}

interface GpuLike {
  requestAdapter: () => Promise<GpuAdapterLike | null>;
}

async function readGpu(): Promise<{ vendor: string; description: string; webgpu: boolean }> {
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu;
  if (!gpu) return { vendor: "", description: "", webgpu: false };
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { vendor: "", description: "", webgpu: false };
    const info = adapter.info ?? (await adapter.requestAdapterInfo?.()) ?? {};
    const vendor = (info.vendor ?? "").toLowerCase();
    const raw = [info.description, info.architecture].filter(Boolean).join(" · ");
    // Headless and software adapters report SwiftShader / llvmpipe; neither is a real GPU.
    const description = /swiftshader|llvmpipe|software|microsoft basic/i.test(raw) ? "Integrated graphics" : raw;
    return { vendor, description, webgpu: true };
  } catch {
    return { vendor: "", description: "", webgpu: false };
  }
}

export async function detectHardware(): Promise<HardwareProfile> {
  const threads = navigator.hardwareConcurrency || 8;
  const memoryGb = Math.round((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0) || 16;
  const gpu = await readGpu();

  // Browsers do not expose VRAM. Estimate from the adapter class and system memory,
  // which is close enough to pick a model shelf.
  let vramGb = gpu.webgpu ? 8 : 4;
  if (gpu.vendor.includes("apple")) vramGb = Math.max(8, Math.round(memoryGb * 0.6));
  else if (gpu.vendor.includes("intel")) vramGb = 4;
  else if (gpu.webgpu && memoryGb >= 32) vramGb = 12;
  else if (gpu.webgpu) vramGb = 8;

  const tier: HardwareProfile["tier"] = vramGb >= 12 ? "studio" : vramGb >= 6 ? "balanced" : "lite";

  return {
    os: detectOs(),
    cpu: gpu.webgpu ? "Detected via WebGPU" : "CPU only",
    threads,
    memoryGb,
    gpuName: gpu.description || (gpu.webgpu ? "Discrete GPU" : "Integrated graphics"),
    gpuVendor: gpu.vendor || "unknown",
    vramGb,
    webgpu: gpu.webgpu,
    tier,
    source: "detected",
  };
}

export const HARDWARE_PROFILES: Array<{
  id: HardwareProfile["tier"];
  label: string;
  detail: string;
  vramGb: number;
  memoryGb: number;
}> = [
  {
    id: "lite",
    label: "Laptop / integrated graphics",
    detail: "4 GB VRAM · subtitles and scoring at a lower precision",
    vramGb: 4,
    memoryGb: 8,
  },
  {
    id: "balanced",
    label: "Gaming PC",
    detail: "8–11 GB VRAM · the default shelf for most machines",
    vramGb: 8,
    memoryGb: 16,
  },
  {
    id: "studio",
    label: "Workstation",
    detail: "12 GB+ VRAM · fastest passes, higher precision",
    vramGb: 16,
    memoryGb: 32,
  },
];

export function withManualProfile(profile: HardwareProfile, tier: HardwareProfile["tier"]): HardwareProfile {
  const preset = HARDWARE_PROFILES.find((item) => item.id === tier);
  if (!preset) return profile;
  return {
    ...profile,
    tier: preset.id,
    vramGb: preset.vramGb,
    source: "manual",
  };
}
