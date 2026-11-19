import type { HardwareProfile, LocalModel } from "../types";

interface ModelSpec {
  id: string;
  name: string;
  purpose: string;
  sizeGb: number;
  required: boolean;
}

const SHELVES: Record<HardwareProfile["tier"], ModelSpec[]> = {
  lite: [
    {
      id: "whisper-small",
      name: "Whisper small",
      purpose: "Word-level subtitles in 99 languages",
      sizeGb: 0.5,
      required: true,
    },
    {
      id: "qwen-3b",
      name: "Qwen 3B Instruct",
      purpose: "Scores moments for laughs, hooks and payoffs",
      sizeGb: 2.1,
      required: true,
    },
    {
      id: "vad",
      name: "Silero VAD",
      purpose: "Finds speech and laughter, cuts dead air",
      sizeGb: 0.02,
      required: true,
    },
    {
      id: "reframe-lite",
      name: "Reframe mobile",
      purpose: "Keeps faces in the vertical frame",
      sizeGb: 0.3,
      required: false,
    },
  ],
  balanced: [
    {
      id: "whisper-turbo",
      name: "Whisper large-v3 turbo",
      purpose: "Word-level subtitles in 99 languages",
      sizeGb: 1.6,
      required: true,
    },
    {
      id: "llama-8b",
      name: "Llama 3.1 8B · Q4",
      purpose: "Scores moments for laughs, hooks and payoffs",
      sizeGb: 4.9,
      required: true,
    },
    {
      id: "vad",
      name: "Silero VAD",
      purpose: "Finds speech and laughter, cuts dead air",
      sizeGb: 0.02,
      required: true,
    },
    {
      id: "siglip-reframe",
      name: "SigLIP2 reframe",
      purpose: "Keeps faces and action inside the 9:16 frame",
      sizeGb: 0.9,
      required: true,
    },
  ],
  studio: [
    {
      id: "whisper-turbo",
      name: "Whisper large-v3 turbo",
      purpose: "Word-level subtitles in 99 languages",
      sizeGb: 1.6,
      required: true,
    },
    {
      id: "llama-8b-q6",
      name: "Llama 3.1 8B · Q6",
      purpose: "Scores moments for laughs, hooks and payoffs",
      sizeGb: 6.7,
      required: true,
    },
    {
      id: "vad",
      name: "Silero VAD",
      purpose: "Finds speech and laughter, cuts dead air",
      sizeGb: 0.02,
      required: true,
    },
    {
      id: "siglip-reframe",
      name: "SigLIP2 reframe",
      purpose: "Keeps faces and action inside the 9:16 frame",
      sizeGb: 0.9,
      required: true,
    },
    {
      id: "demucs",
      name: "Demucs stems",
      purpose: "Balances voice and game audio under captions",
      sizeGb: 1.1,
      required: false,
    },
  ],
};

export function buildShelf(tier: HardwareProfile["tier"]): LocalModel[] {
  return SHELVES[tier].map((spec) => ({
    ...spec,
    status: "idle",
    progress: 0,
    speedMbps: 0,
  }));
}

export function shelfSize(models: LocalModel[]): number {
  return models.reduce((total, model) => total + model.sizeGb, 0);
}
