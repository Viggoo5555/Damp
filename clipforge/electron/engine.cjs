"use strict";

/**
 * Offcut clip engine.
 *
 * Everything here is real work on real media:
 *   yt-dlp  -> fetch the source video / audio / captions
 *   ffmpeg  -> measure loudness, cut, reframe to 1080x1920, burn captions
 *   ffprobe -> inspect the source
 *
 * No fabricated data: if a stage fails, the job fails with the tool's own error.
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const IS_WIN = process.platform === "win32";
const EXE = IS_WIN ? ".exe" : "";

const YTDLP_WIN = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
const FFMPEG_WIN_ZIP =
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";

const BOT_CHECK = /sign in to confirm|confirm you.{0,3}re not a bot|http error 429/i;

/* ------------------------------------------------------------------ */
/* Process helpers                                                     */
/* ------------------------------------------------------------------ */

function execFile(file, args, options = {}) {
  const { cwd, timeoutMs = 0, onLine, onSpawn, env } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, windowsHide: true, env: env ? { ...process.env, ...env } : process.env });
    if (onSpawn) onSpawn(child);

    let stdout = "";
    let stderr = "";
    let lineBuffer = "";
    let timer = null;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* already gone */
        }
        reject(new Error(`${path.basename(file)} timed out`));
      }, timeoutMs);
    }

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (onLine) {
        lineBuffer += text;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? "";
        lines.forEach((line) => onLine(line));
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (onLine) {
        lineBuffer += text;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? "";
        lines.forEach((line) => onLine(line));
      }
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const error = new Error(
          `${path.basename(file)} exited with ${code}${stderr ? `: ${stderr.trim().split(/\r?\n/).slice(-3).join(" ")}` : ""}`,
        );
        error.code = code;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

function which(name) {
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const candidates = IS_WIN ? [`${name}.exe`, `${name}.bat`] : [name];
  for (const dir of dirs) {
    for (const candidate of candidates) {
      const full = path.join(dir, candidate);
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return full;
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Tool bootstrap (Windows ships nothing, so fetch once into appData)  */
/* ------------------------------------------------------------------ */

async function downloadTo(url, dest, onProgress) {
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "offcut/1.1" } });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}) for ${url}`);
  const total = Number(response.headers.get("content-length") || 0);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const handle = await fsp.open(dest, "w");
  let received = 0;
  try {
    for await (const chunk of response.body) {
      await handle.write(chunk);
      received += chunk.length;
      if (onProgress) onProgress(received, total);
    }
  } finally {
    await handle.close();
  }
  return dest;
}

async function findInDir(dir, fileName) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.toLowerCase() === fileName.toLowerCase()) return full;
    }
  }
  return null;
}

/** Reports whether the tools are already installed, without downloading anything. */
function checkTools({ binDir }) {
  const names = IS_WIN
    ? [path.join(binDir, "ffmpeg.exe"), path.join(binDir, "ffprobe.exe"), path.join(binDir, "yt-dlp.exe")]
    : [which("ffmpeg"), which("yt-dlp") || which("yt-dlp_linux")];
  const missing = [];
  if (!names[0] || !fs.existsSync(names[0])) missing.push("ffmpeg");
  if (!names[names.length - 1] || !fs.existsSync(names[names.length - 1])) missing.push("yt-dlp");
  return {
    ready: missing.length === 0,
    missing,
    ffmpeg: names[0] || "",
    ytdlp: names[names.length - 1] || "",
    binDir,
  };
}

/** Returns { ffmpeg, ffprobe, ytdlp } or throws with a readable message. */
async function ensureTools({ binDir, onProgress = () => {} }) {
  await fsp.mkdir(binDir, { recursive: true });

  let ffmpeg = path.join(binDir, `ffmpeg${EXE}`);
  let ffprobe = path.join(binDir, `ffprobe${EXE}`);
  let ytdlp = path.join(binDir, `yt-dlp${EXE}`);

  const exists = (file) => fs.existsSync(file);

  if (exists(ffmpeg) && exists(ffprobe) && exists(ytdlp)) {
    return { ffmpeg, ffprobe, ytdlp };
  }

  if (!IS_WIN) {
    // Development / Linux: use whatever is on PATH.
    const systemFfmpeg = which("ffmpeg");
    const systemFfprobe = which("ffprobe");
    const systemYtdlp = which("yt-dlp") || which("yt-dlp_linux");
    if (!systemFfmpeg) throw new Error("ffmpeg is not installed. Install it, then try again.");
    return {
      ffmpeg: systemFfmpeg,
      ffprobe: systemFfprobe || systemFfmpeg.replace(/ffmpeg$/, "ffprobe"),
      ytdlp: systemYtdlp || "",
    };
  }

  // Windows: fetch the two binaries once, into %APPDATA%\Offcut\bin.
  if (!exists(ffmpeg) || !exists(ffprobe)) {
    onProgress({ stage: "tools", message: "Downloading ffmpeg (about 150 MB, once)", pct: 2 });
    const zipPath = path.join(binDir, "ffmpeg.zip");
    await downloadTo(FFMPEG_WIN_ZIP, zipPath, (received, total) => {
      onProgress({
        stage: "tools",
        message: `Downloading ffmpeg — ${Math.round(received / 1048576)} MB${total ? ` of ${Math.round(total / 1048576)} MB` : ""}`,
        pct: total ? Math.min(55, (received / total) * 55) : 8,
      });
    });
    onProgress({ stage: "tools", message: "Unpacking ffmpeg", pct: 58 });
    const unpackDir = path.join(binDir, "ffmpeg-unpack");
    await fsp.rm(unpackDir, { recursive: true, force: true });
    await fsp.mkdir(unpackDir, { recursive: true });
    // Windows 10+ ships bsdtar, which reads .zip.
    try {
      await execFile("tar", ["-xf", zipPath, "-C", unpackDir]);
    } catch {
      // Older Windows images without bsdtar: PowerShell can unpack zips.
      await execFile("powershell", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${unpackDir}' -Force`,
      ]);
    }
    const found = await findInDir(unpackDir, "ffmpeg.exe");
    if (!found) throw new Error("ffmpeg unpacked but ffmpeg.exe was not found in the archive.");
    const foundProbe = await findInDir(unpackDir, "ffprobe.exe");
    await fsp.copyFile(found, ffmpeg);
    if (foundProbe) await fsp.copyFile(foundProbe, ffprobe);
    await fsp.rm(unpackDir, { recursive: true, force: true });
    await fsp.rm(zipPath, { force: true });
  }

  if (!exists(ytdlp)) {
    onProgress({ stage: "tools", message: "Downloading yt-dlp", pct: 66 });
    await downloadTo(YTDLP_WIN, ytdlp, (received, total) => {
      onProgress({
        stage: "tools",
        message: `Downloading yt-dlp — ${Math.round(received / 1048576)} MB${total ? ` of ${Math.round(total / 1048576)} MB` : ""}`,
        pct: total ? 66 + (received / total) * 26 : 72,
      });
    });
  }

  if (!exists(ffprobe)) ffprobe = ffmpeg;
  onProgress({ stage: "tools", message: "Tools ready", pct: 95 });
  return { ffmpeg, ffprobe, ytdlp };
}

/* ------------------------------------------------------------------ */
/* Source inspection                                                   */
/* ------------------------------------------------------------------ */

function isLocalFile(input) {
  return /^[a-zA-Z]:[\\/]/.test(input) || input.startsWith("/") || input.startsWith("file:");
}

function localPath(input) {
  return input.startsWith("file:") ? decodeURIComponent(new URL(input).pathname) : input;
}

async function probeLocal(ffprobe, file) {
  const { stdout } = await execFile(ffprobe, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const info = JSON.parse(stdout);
  const video = info.streams.find((stream) => stream.codec_type === "video");
  return {
    title: path.basename(file).replace(/\.[^.]+$/, ""),
    channel: "Local file",
    durationSec: Number(info.format.duration || video?.duration || 0),
    width: video?.width || 0,
    height: video?.height || 0,
    thumbnailUrl: "",
    webpageUrl: "",
    platform: "local",
  };
}

async function probeRemote(ytdlp, input, onLine) {
  const { stdout } = await execFile(
    ytdlp,
    [
      "--no-warnings",
      "--no-playlist",
      "--skip-download",
      "--dump-single-json",
      "--socket-timeout",
      "20",
      input,
    ],
    { timeoutMs: 120_000, onLine },
  );
  const info = JSON.parse(stdout.trim().split(/\r?\n/).pop());
  return {
    title: info.title || "Untitled source",
    channel: info.uploader || info.channel || info.creator || "Unknown channel",
    durationSec: Number(info.duration || 0),
    width: info.width || 0,
    height: info.height || 0,
    thumbnailUrl: info.thumbnail || "",
    webpageUrl: info.webpage_url || input,
    platform: (info.extractor_key || "").toLowerCase().includes("twitch") ? "twitch" : "youtube",
  };
}

/* ------------------------------------------------------------------ */
/* Captions                                                            */
/* ------------------------------------------------------------------ */

function vttTime(value) {
  const [clock, ms = "0"] = value.trim().split(/[.,]/);
  const parts = clock.split(":").map(Number);
  const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  return seconds + Number(ms.slice(0, 3).padEnd(3, "0")) / 1000;
}

function parseVtt(raw) {
  const cues = [];
  const blocks = raw.replace(/^WEBVTT.*$/m, "").split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((line) => line.trim() && !/^(WEBVTT|NOTE|Kind:|Language:)/.test(line));
    const timeLine = lines.find((line) => line.includes("-->"));
    if (!timeLine) continue;
    const [from, to] = timeLine.split("-->");
    const text = lines
      .filter((line) => !line.includes("-->"))
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    cues.push({ start: vttTime(from), end: vttTime(to.split(/\s+/)[0] || to), text });
  }
  // Auto-captions repeat rolling lines; drop the duplicates.
  return cues.filter((cue, index) => index === 0 || cue.text !== cues[index - 1].text);
}

function dedupeCues(cues) {
  const out = [];
  for (const cue of cues) {
    const previous = out[out.length - 1];
    if (previous && cue.text === previous.text) {
      previous.end = Math.max(previous.end, cue.end);
      continue;
    }
    if (previous && cue.start - previous.end < 0.15 && previous.text.endsWith(cue.text.split(" ")[0])) continue;
    out.push({ ...cue });
  }
  return out;
}

async function fetchCaptions(ytdlp, input, workDir, onLine) {
  try {
    await execFile(
      ytdlp,
      [
        "--no-warnings",
        "--no-playlist",
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "en.*,en,en-US,en-GB",
        "--sub-format",
        "vtt",
        "--convert-subs",
        "vtt",
        "-o",
        path.join(workDir, "caption.%(ext)s"),
        "--socket-timeout",
        "20",
        input,
      ],
      { timeoutMs: 180_000, onLine },
    );
  } catch {
    return []; // no captions is a normal outcome, not a failure
  }
  const entries = await fsp.readdir(workDir).catch(() => []);
  const files = entries.filter((name) => name.startsWith("caption") && name.endsWith(".vtt"));
  if (!files.length) return [];
  const raw = await fsp.readFile(path.join(workDir, files[0]), "utf8");
  return dedupeCues(parseVtt(raw)).filter((cue) => cue.end > cue.start);
}

/* ------------------------------------------------------------------ */
/* Audio energy                                                        */
/* ------------------------------------------------------------------ */

async function measureEnergy(ffmpeg, wavPath, onLine) {
  const { stderr } = await execFile(
    ffmpeg,
    [
      "-hide_banner",
      "-nostats",
      "-i",
      wavPath,
      "-af",
      "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
      "-f",
      "null",
      "-",
    ],
    { timeoutMs: 900_000, onLine },
  );

  // ametadata prints "frame:N pts:N pts_time:T" then the key=value line on stderr.
  const samples = [];
  let pendingTime = null;
  for (const line of stderr.split(/\r?\n/)) {
    if (line.startsWith("frame:")) {
      const match = /pts_time:([-\d.]+)/.exec(line);
      pendingTime = match ? Number(match[1]) : null;
    } else if (line.includes("RMS_level=")) {
      const value = Number(line.split("RMS_level=")[1]);
      if (pendingTime !== null && Number.isFinite(value) && value > -120) {
        samples.push({ t: pendingTime, rms: value });
      }
    }
  }
  return samples;
}

async function findPeakOffset(ffmpeg, file) {
  try {
    const { stderr } = await execFile(ffmpeg, [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ]);
    const match = /max_volume:\s*(-?[\d.]+) dB/.exec(stderr);
    return match ? Number(match[1]) : -6;
  } catch {
    return -6;
  }
}

/* ------------------------------------------------------------------ */
/* Twitch chat (best effort, real API)                                 */
/* ------------------------------------------------------------------ */

async function fetchTwitchChat(url, onEvent) {
  try {
    const vodId = /\/videos\/(\d+)/.exec(url)?.[1];
    if (!vodId) return { buckets: [], note: "no VOD id" };
    const clientId = "kimne78kx3ncx6brgo4mv6wki5h68xi";
    const query = `query($id:ID!,$cursor:String){video(id:$id){createdAt lengthSeconds comments(first:100,after:$cursor){edges{cursor node{createdAt}}pageInfo{hasNextPage}}}}`;

    const messages = [];
    let cursor = null;
    let startedAt = null;
    for (let page = 0; page < 40; page += 1) {
      const response = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: { "client-id": clientId, "content-type": "application/json" },
        body: JSON.stringify({ query, variables: { id: vodId, cursor } }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Twitch returned ${response.status}`);
      const payload = await response.json();
      const video = payload?.data?.video;
      const comments = video?.comments;
      if (startedAt === null) {
        const parsed = Date.parse(video?.createdAt || "");
        startedAt = Number.isFinite(parsed) ? parsed : 0;
      }
      if (!comments?.edges?.length) break;
      for (const edge of comments.edges) {
        const at = Date.parse(edge.node.createdAt);
        // Chat times are absolute; the scorer needs seconds into the VOD.
        if (Number.isFinite(at)) messages.push(Math.max(0, at - startedAt));
      }
      onEvent?.(messages.length);
      if (!comments.pageInfo?.hasNextPage) break;
      cursor = comments.edges[comments.edges.length - 1].cursor;
    }
    return { messages, note: `${messages.length} chat messages` };
  } catch (error) {
    onEvent?.(0, error);
    return { messages: [], note: error.message };
  }
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

const LAUGH = /\b(haha+|hah|hehe|lol|lmao|lmfao|rofl|dead|dying|i'?m dead|💀|😂|🤣|laugh(s|ing|ed)?|cackle|giggle)\b/i;
const FUNNY_CUES = [
  /\b(no way|wait|hold on|what|bro|dude|oh my god|omg|stop|why|how)\b/i,
  /\b(actually|literally|never|always|worst|best|insane|crazy|unbelievable|cursed)\b/i,
  /\b(oops|oops|mistake|failed|fail|wrong|broke|fell|dropped|burned)\b/i,
];

function cueFunny(text) {
  let score = 0;
  if (LAUGH.test(text)) score += 4;
  if (/!\s*$/.test(text)) score += 1.2;
  if (/\?\s*$/.test(text)) score += 0.6;
  if (/[A-Z]{3,}/.test(text)) score += 0.8;
  if (/\b([a-z])\1{2,}\b/i.test(text)) score += 1.2;
  for (const pattern of FUNNY_CUES) if (pattern.test(text)) score += 0.9;
  const words = text.split(/\s+/).length;
  if (words >= 3 && words <= 16) score += 0.8;
  if (words > 30) score -= 1;
  return score;
}

function normalize(values) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-6) return values.map(() => 0.5);
  return values.map((value) => (value - min) / (max - min));
}

function smooth(series, radius = 4) {
  return series.map((_, index) => {
    const from = Math.max(0, index - radius);
    const to = Math.min(series.length - 1, index + radius);
    let sum = 0;
    for (let i = from; i <= to; i += 1) sum += series[i];
    return sum / (to - from + 1);
  });
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Turns a loudness envelope + captions + (optional) chat timeline into ranked moments.
 * Loud *and* dense speech *and* laugh-shaped words win; steady room tone never does.
 */
function pickMoments({ energy, cues, chat, durationSec, wanted }) {
  const step = 0.5;
  const frames = Math.max(1, Math.round(durationSec / step));

  const loudness = new Array(frames).fill(-60);
  energy.forEach((sample) => {
    const index = Math.min(frames - 1, Math.max(0, Math.round(sample.t / step)));
    loudness[index] = Math.max(loudness[index], sample.rms);
  });
  for (let i = 1; i < frames; i += 1) if (loudness[i] === -60) loudness[i] = loudness[i - 1];
  for (let i = frames - 2; i >= 0; i -= 1) if (loudness[i] === -60) loudness[i] = loudness[i + 1];

  const baseline = median(loudness);
  const loudnessNorm = normalize(loudness);

  const chatPerSec = new Array(frames).fill(0);
  if (chat && chat.length) {
    for (const at of chat) {
      const index = Math.floor(at / step);
      if (index >= 0 && index < frames) chatPerSec[index] += 1;
    }
  }
  const chatSmooth = smooth(chatPerSec, 20);
  const chatNorm = normalize(chatSmooth);

  const cueList = cues.map((cue) => ({ ...cue, funny: cueFunny(cue.text) }));
  const wordsPerSec = new Array(frames).fill(0);
  cueList.forEach((cue) => {
    const words = cue.text.split(/\s+/).length;
    const from = Math.max(0, Math.floor(cue.start / step));
    const to = Math.min(frames - 1, Math.ceil(cue.end / step));
    const share = words / Math.max(1, to - from + 1);
    for (let i = from; i <= to; i += 1) wordsPerSec[i] += share;
  });
  const speechNorm = normalize(smooth(wordsPerSec, 6));

  const targetLen = 30;
  const candidates = [];
  for (let start = 2; start + 12 < durationSec; start += 1.5) {
    const from = Math.floor(start / step);
    const to = Math.min(frames - 1, Math.floor((start + targetLen) / step));
    if (to <= from + 2) continue;

    let peak = 0;
    let sum = 0;
    for (let i = from; i <= to; i += 1) {
      peak = Math.max(peak, loudnessNorm[i]);
      sum += loudnessNorm[i];
    }
    const loudAvg = sum / (to - from + 1);

    const windowCues = cueList.filter((cue) => cue.start >= start - 2 && cue.end <= start + targetLen + 6);
    const textScore = windowCues.reduce((total, cue) => {
      const position = Math.max(0, 1 - Math.abs(cue.start - (start + targetLen * 0.6)) / (targetLen * 0.9));
      return total + cue.funny * (0.55 + position * 0.45);
    }, 0);
    const textNorm = Math.min(1, textScore / 7);

    let speechSum = 0;
    for (let i = from; i <= to; i += 1) speechSum += speechNorm[i];
    const speechAvg = speechSum / (to - from + 1);

    let chatSum = 0;
    for (let i = from; i <= to; i += 1) chatSum += chatNorm[i];
    const chatAvg = chatPerSec.some((value) => value > 0) ? chatSum / (to - from + 1) : 0;
    const hasChat = chatPerSec.some((value) => value > 0);

    const score =
      (0.42 * loudAvg + 0.34 * peak) * (hasChat ? 0.72 : 1) +
      (hasChat ? 0.34 * chatAvg : 0) +
      0.28 * textNorm +
      0.12 * speechAvg;

    candidates.push({ start, score, peak, textNorm, chatAvg, loudAvg });
  }

  candidates.sort((a, b) => b.score - a.score);

  const picked = [];
  const spacing = Math.min(targetLen + 6, Math.max(12, durationSec / Math.max(1, wanted) - 4));
  for (const candidate of candidates) {
    if (picked.length >= wanted) break;
    if (picked.some((other) => Math.abs(other.start - candidate.start) < spacing)) continue;
    picked.push(candidate);
  }
  picked.sort((a, b) => a.start - b.start);

  return picked.map((candidate) => refineWindow(candidate, { cueList, loudness, step, durationSec, baseline, frames }));
}

/** Grows a 30 s seed into a clip that starts on a sentence and ends on one. */
function refineWindow(candidate, { cueList, loudness, step, durationSec, baseline, frames }) {
  const seedStart = candidate.start;
  const seedEnd = candidate.start + 30;

  // The loudest point inside the window is the payoff; the clip must contain it.
  let peakIndex = Math.floor(seedStart / step);
  let peakValue = -Infinity;
  for (let i = Math.floor(seedStart / step); i <= Math.min(frames - 1, Math.floor(seedEnd / step)); i += 1) {
    if (loudness[i] > peakValue) {
      peakValue = loudness[i];
      peakIndex = i;
    }
  }
  const peakSec = peakIndex * step;

  const inside = cueList.filter((cue) => cue.end > seedStart - 1 && cue.start < seedEnd + 4);
  let start = seedStart;
  let end = seedEnd;

  if (inside.length) {
    const first = inside[0];
    if (first.start >= seedStart - 6 && first.start <= peakSec) start = Math.max(1, first.start - 0.6);
    const last = inside[inside.length - 1];
    if (last.end > peakSec + 2) end = Math.min(durationSec - 0.4, last.end + 1.1);
  }

  const length = end - start;
  if (length < 16) end = Math.min(durationSec - 0.4, start + 18);
  if (end - start > 46) end = start + 42;
  if (end > durationSec) end = durationSec;

  const clipCues = cueList
    .filter((cue) => cue.end > start && cue.start < end)
    .map((cue) => ({
      t: Math.max(0, cue.start - start),
      text: cue.text,
      funny: cue.funny,
    }));

  const bestCue = [...clipCues].sort((a, b) => b.funny - a.funny)[0];
  const firstCue = clipCues[0];
  const peakNorm = Math.max(0, Math.min(1, (peakValue - baseline + 24) / 42));

  return {
    startSec: Number(start.toFixed(2)),
    endSec: Number(end.toFixed(2)),
    peakSec: Number((start + Math.max(0.5, peakSec - start)).toFixed(2)),
    score: Math.round(Math.max(42, Math.min(98, 46 + candidate.score * 52 + candidate.textNorm * 6))),
    spikePeak: Number(peakNorm.toFixed(2)),
    textScore: candidate.textNorm,
    chatScore: candidate.chatAvg,
    cues: clipCues,
    title: bestCue ? cleanTitle(bestCue.text) : "",
    hook: firstCue ? cleanTitle(firstCue.text) : "",
  };
}

function cleanTitle(text) {
  const trimmed = text
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/^(so|and|but|well|like|okay|ok|um|uh)[,\s]+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (sentence.length <= 64) return sentence;
  return `${sentence.slice(0, 61).replace(/[\s,.]+\S*$/, "")}…`;
}

/* ------------------------------------------------------------------ */
/* Captions -> ASS                                                     */
/* ------------------------------------------------------------------ */

function assTime(seconds) {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function wrapLines(text, maxChars = 26) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line ? `${line} ${word}` : word).length <= maxChars) line = line ? `${line} ${word}` : word;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(-2).join("\\N");
}

function buildAss(cues, style = "pop", lengthSec = 30) {
  const preset =
    style === "clean"
      ? { font: "Archivo Black", size: 54, primary: "&H00FFFFFF", outline: 3, margin: 220, bold: 0 }
      : style === "karaoke"
        ? { font: "Archivo Black", size: 62, primary: "&H0000E8FF", outline: 4, margin: 430, bold: 1 }
        : { font: "Archivo Black", size: 68, primary: "&H00FFFFFF", outline: 6, margin: 330, bold: 1 };

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Line,${preset.font},${preset.size},${preset.primary},&H000000FF,&H00000000,&H64000000,${preset.bold},0,0,0,100,100,0,0,1,${preset.outline},0,2,60,60,${preset.margin},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const events = [];
  let previousEnd = 0;
  cues.forEach((cue, index) => {
    const next = cues[index + 1];
    const from = Math.max(cue.t ?? cue.start ?? 0, 0);
    const fallbackEnd = next ? Math.max(from + 0.6, next.t - 0.04) : from + 2.4;
    const to = Math.min(cue.end !== undefined ? cue.end : fallbackEnd, lengthSec);
    if (to <= from) return;
    const start = Math.max(from, previousEnd - 0.05);
    if (start >= to) return;
    events.push(
      `Dialogue: 0,${assTime(start)},${assTime(to)},Line,,0,0,0,,${wrapLines(cue.text.toUpperCase())}`,
    );
    previousEnd = to;
  });

  return `${[...header, ...events].join("\n")}\n`;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function srtFromCues(cues) {
  return cues
    .map((cue, index) => {
      const from = (cue.t ?? 0).toFixed(2);
      const to = (cue.t + 2.4).toFixed(2);
      return `${index + 1}\n00:00:${from.padStart(5, "0")} --> 00:00:${to.padStart(5, "0")}\n${cue.text}\n`;
    })
    .join("\n");
}

/** Copies the bundled caption font next to a generated fontconfig file so libass can find it. */
async function prepareFonts({ fontSource, targetDir }) {
  await fsp.mkdir(targetDir, { recursive: true });
  const fontFile = path.join(targetDir, "ArchivoBlack-Regular.ttf");
  try {
    await fsp.access(fontFile);
  } catch {
    await fsp.copyFile(fontSource, fontFile);
  }
  const cacheDir = path.join(targetDir, "cache");
  await fsp.mkdir(cacheDir, { recursive: true });
  const configPath = path.join(targetDir, "fonts.conf");
  const xml = [
    '<?xml version="1.0"?>',
    '<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">',
    "<fontconfig>",
    `  <dir>${targetDir}</dir>`,
    `  <cachedir>${cacheDir}</cachedir>`,
    "</fontconfig>",
    "",
  ].join("\n");
  await fsp.writeFile(configPath, xml);
  return configPath;
}

async function detectContentRect(ffmpeg, file, { start = 0, length = 30 } = {}) {
  const counts = new Map();
  const points = [0.15, 0.45, 0.8].map((share) => start + Math.max(0, length * share));
  for (const at of points) {
    try {
      const { stderr } = await execFile(
        ffmpeg,
        [
          "-hide_banner",
          "-ss",
          String(at),
          "-t",
          "3",
          "-i",
          file,
          "-vf",
          "cropdetect=24:2:0",
          "-f",
          "null",
          "-",
        ],
        { timeoutMs: 60_000 },
      );
      for (const match of stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)) {
        const [w, h, x, y] = match.slice(1).map(Number);
        if (w < 240 || h < 160) continue;
        const key = `${w}:${h}:${x}:${y}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    } catch {
      /* no detection is fine; the frame stays whole */
    }
  }
  let best = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = key;
    }
  }
  if (!best) return null;
  const [w, h, x, y] = best.split(":").map(Number);
  return { w, h, x, y };
}

async function renderClip({ ffmpeg, input, clip, workDir, outDir, index, onProgress, local, onSpawn, fontConfig }) {
  const id = `clip-${Date.now().toString(36)}-${index}`;
  const clipDir = path.join(outDir, id);
  await fsp.mkdir(clipDir, { recursive: true });

  const duration = Math.max(4, clip.endSec - clip.startSec);
  const assPath = path.join(clipDir, "captions.ass");
  await fsp.writeFile(assPath, buildAss(clip.cues, clip.subtitleStyle || "pop", duration));
  const hasCaptions = clip.cues.length > 0;

  const rect = await detectContentRect(ffmpeg, input, {
    start: local ? clip.startSec : 0,
    length: duration,
  });
  const cropPrefix = rect ? `crop=${rect.w}:${rect.h}:${rect.x}:${rect.y},` : "";

  const videoPath = path.join(clipDir, `${id}.mp4`);
  const filters = [
    `[0:v]${cropPrefix}split=2[bg][fg]`,
    "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=32,eq=brightness=-0.08:saturation=1.05[bgb]",
    "[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fgs]",
    "[bgb][fgs]overlay=(W-w)/2:(H-h)/2,fps=30,setsar=1[comp]",
    hasCaptions ? `[comp]subtitles=captions.ass[v]` : "[comp]null[v]",
  ].join(";");

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(local ? clip.startSec : 0),
    "-i",
    input,
    "-t",
    String(duration),
    "-filter_complex",
    filters,
    "-map",
    "[v]",
    "-map",
    "0:a:0?",
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-t",
    String(duration),
    videoPath,
  ];

  await execFile(ffmpeg, args, {
    cwd: clipDir,
    timeoutMs: 900_000,
    onSpawn,
    env: fontConfig ? { FONTCONFIG_FILE: fontConfig } : undefined,
    onLine: (line) => {
      const match = /time=(\d+):(\d+):([\d.]+)/.exec(line);
      if (match && onProgress) {
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        onProgress(Math.min(99, (seconds / duration) * 100));
      }
    },
  });

  const thumbPath = path.join(clipDir, `${id}.jpg`);
  const thumbAt = local ? clip.peakSec : Math.max(0.4, clip.peakSec - clip.startSec);
  await execFile(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(thumbAt),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-update",
    "1",
    "-q:v",
    "3",
    thumbPath,
  ]).catch(() => {});

  return { id, videoPath, thumbPath: fs.existsSync(thumbPath) ? thumbPath : "", clipDir };
}

/* ------------------------------------------------------------------ */
/* Job orchestration                                                   */
/* ------------------------------------------------------------------ */

async function runJob(options) {
  const {
    input,
    tools,
    outDir,
    workDir,
    maxClips = 5,
    subtitleStyle = "pop",
    fontSource = "",
    emit = () => {},
    register = () => {},
  } = options;

  const started = Date.now();
  const local = isLocalFile(input);
  const file = local ? localPath(input) : input;
  await fsp.mkdir(workDir, { recursive: true });
  await fsp.mkdir(outDir, { recursive: true });

  emit({ stage: "probe", pct: 2, message: local ? "Reading the file" : "Reading the video" });
  const meta = local ? await probeLocal(tools.ffprobe, file) : await probeRemote(tools.ytdlp, file);
  if (!meta.durationSec || meta.durationSec < 20) {
    throw new Error("That source is shorter than 20 seconds — nothing to find.");
  }
  emit({ stage: "probe", pct: 6, message: `${meta.title} · ${Math.round(meta.durationSec / 60)} min`, meta });

  // 1. Audio for analysis.
  emit({ stage: "audio", pct: 8, message: "Downloading the audio track" });
  let sourceForRender = file;
  let wavPath = path.join(workDir, "analysis.wav");

  if (local) {
    await execFile(tools.ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      file,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "8000",
      wavPath,
    ], { timeoutMs: 900_000 });
  } else {
    const audioBase = path.join(workDir, "source-audio");
    const dlArgs = [
      "--no-warnings",
      "--no-playlist",
      "-f",
      "bestaudio/best",
      "--extract-audio",
      "--audio-format",
      "wav",
      "--postprocessor-args",
      "ExtractAudio:-ac 1 -ar 8000",
      "-o",
      `${audioBase}.%(ext)s`,
      "--socket-timeout",
      "20",
      file,
    ];
    try {
      await execFile(tools.ytdlp, dlArgs, {
        timeoutMs: 1_800_000,
        onLine: (line) => {
          const pct = /\[download\]\s+([\d.]+)%/.exec(line);
          if (pct) emit({ stage: "audio", pct: 8 + Number(pct[1]) * 0.22, message: `Downloading audio ${pct[1]}%` });
        },
      });
    } catch (error) {
      if (BOT_CHECK.test(error.message)) {
        emit({ stage: "audio", pct: 8, message: "Site wants a sign-in check — retrying with your browser cookies" });
        await retryWithCookies(tools.ytdlp, dlArgs, file);
      } else throw error;
    }
    const produced = `${audioBase}.wav`;
    if (!fs.existsSync(produced)) throw new Error("The audio track could not be extracted from that source.");
    wavPath = produced;
  }

  // 2. Captions.
  emit({ stage: "captions", pct: 32, message: "Reading the transcript" });
  const cues = local ? [] : await fetchCaptions(tools.ytdlp, file, workDir, () => {});
  emit({
    stage: "captions",
    pct: 36,
    message: cues.length ? `${cues.length} caption lines` : "No captions on this source — clips will be audio-led",
  });

  // 3. Chat, for Twitch.
  let chat = [];
  if (meta.platform === "twitch") {
    emit({ stage: "chat", pct: 38, message: "Reading the VOD chat" });
    const result = await fetchTwitchChat(meta.webpageUrl || file, (count, error) => {
      if (error) emit({ stage: "chat", pct: 44, message: `Chat unavailable (${error.message}) — using audio` });
      else emit({ stage: "chat", pct: 44, message: `${count} chat messages read` });
    });
    chat = result.messages;
  }

  // 4. Energy.
  emit({ stage: "energy", pct: 46, message: "Measuring loudness across the whole video" });
  const durationSec = meta.durationSec;
  const energy = await measureEnergy(tools.ffmpeg, wavPath, (line) => {
    const match = /time=(\d+):(\d+):([\d.]+)/.exec(line);
    if (match) {
      const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      const pct = 46 + Math.min(20, (seconds / durationSec) * 20);
      emit({ stage: "energy", pct, message: `Measuring loudness ${Math.round((seconds / durationSec) * 100)}%` });
    }
  });

  // 5. Score.
  let fontConfig = null;
  if (fontSource && fs.existsSync(fontSource)) {
    try {
      fontConfig = await prepareFonts({ fontSource, targetDir: path.join(workDir, "fonts") });
    } catch {
      fontConfig = null;
    }
  }

  emit({ stage: "score", pct: 66, message: "Scoring moments for laughs, spikes and payoffs" });
  const moments = pickMoments({
    energy,
    cues,
    chat,
    durationSec,
    wanted: Math.max(1, Math.min(8, maxClips)),
  });
  if (!moments.length) throw new Error("No usable moment stood out in that video.");
  emit({ stage: "score", pct: 70, message: `${moments.length} moments picked`, moments });

  // 6. Cut + render each.
  const clips = [];
  for (let index = 0; index < moments.length; index += 1) {
    const moment = moments[index];
    const basePct = 70 + (index / moments.length) * 28;
    emit({
      stage: "render",
      pct: basePct,
      message: `Rendering clip ${index + 1} of ${moments.length}`,
      active: index,
    });

    let sectionFile = file;
    let sectionLocal = local;
    if (!local) {
      emit({ stage: "download", pct: basePct + 1, message: `Downloading the section for clip ${index + 1}` });
      const sectionBase = path.join(workDir, `section-${index}`);
      const sectionArgs = [
        "--no-warnings",
        "--no-playlist",
        "-f",
        "bv*[height<=1080]+ba/b[height<=1080]/b",
        "--download-sections",
        `*${moment.startSec}-${moment.endSec}`,
        "--force-keyframes-at-cuts",
        "-o",
        `${sectionBase}.%(ext)s`,
        "--socket-timeout",
        "20",
        file,
      ];
      try {
        await execFile(tools.ytdlp, sectionArgs, { timeoutMs: 900_000, onLine: () => {} });
      } catch (error) {
        if (BOT_CHECK.test(error.message)) await retryWithCookies(tools.ytdlp, sectionArgs, file);
        else throw error;
      }
      const entries = (await fsp.readdir(workDir)).filter((name) => name.startsWith(`section-${index}.`));
      const found = entries.find((name) => /\.(mp4|mkv|webm|mov)$/i.test(name));
      if (!found) throw new Error("The video section could not be downloaded.");
      sectionFile = path.join(workDir, found);
      sectionLocal = false;
    }

    const rendered = await renderClip({
      ffmpeg: tools.ffmpeg,
      input: sectionFile,
      clip: { ...moment, subtitleStyle },
      workDir,
      outDir,
      index,
      local: sectionLocal,
      fontConfig,
      onSpawn: register,
      onProgress: (pct) =>
        emit({
          stage: "render",
          pct: basePct + (pct / 100) * (28 / moments.length),
          message: `Rendering clip ${index + 1} of ${moments.length} — ${Math.round(pct)}%`,
          active: index,
        }),
    });

    clips.push({
      ...rendered,
      sourceId: "",
      title: moment.title || `Moment at ${Math.round(moment.startSec)}s`,
      hook: moment.hook || moment.title || "",
      startSec: moment.startSec,
      endSec: moment.endSec,
      peakSec: moment.peakSec,
      score: moment.score,
      spikePeak: moment.spikePeak,
      chatSpike: moment.chatScore > 0.45 && chat.length > 0,
      chatScore: Number(moment.chatScore.toFixed(2)),
      captions: moment.cues.map((cue) => ({ t: Number(cue.t.toFixed(2)), text: cue.text })),
      hasCaptions: moment.cues.length > 0,
    });
  }

  // Chat timeline for the UI: 10 s buckets, scaled to 100.
  let chatSeries = [];
  if (chat.length) {
    const buckets = new Array(Math.max(1, Math.ceil(durationSec / 10))).fill(0);
    for (const at of chat) {
      const index = Math.min(buckets.length - 1, Math.floor((at / 1000) / 10));
      if (index >= 0) buckets[index] += 1;
    }
    const peak = Math.max(...buckets, 1);
    chatSeries = buckets.map((value) => Math.round((value / peak) * 100));
  }

  emit({ stage: "done", pct: 100, message: `${clips.length} clips rendered`, meta });
  return {
    meta,
    clips,
    chatSeries,
    elapsedSec: Math.round((Date.now() - started) / 1000),
    captionsFound: cues.length,
    chatMessages: chat.length,
  };
}

async function retryWithCookies(ytdlp, args, url) {
  for (const browser of ["chrome", "edge", "firefox", "brave"]) {
    try {
      await execFile(ytdlp, [...args, "--cookies-from-browser", browser], { timeoutMs: 1_800_000 });
      return;
    } catch {
      /* try the next browser */
    }
  }
  throw new Error(
    "YouTube asked this network to sign in. Sign in to YouTube in Chrome (or Edge/Firefox) on this PC and try again — Offcut reuses those cookies automatically.",
  );
}

module.exports = {
  ensureTools,
  runJob,
  probeRemote,
  probeLocal,
  isLocalFile,
  parseVtt,
  pickMoments,
  buildAss,
  measureEnergy,
  renderClip,
  prepareFonts,
  detectContentRect,
  checkTools,
};
