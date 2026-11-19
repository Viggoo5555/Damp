import { useEffect, useState } from "react";
import type { HardwareProfile } from "../types";
import { useStore } from "../store";
import { HARDWARE_PROFILES, withManualProfile } from "../lib/hardware";
import { bridge, type JobProgress, type ToolStatus } from "../lib/desktop";
import { ArrowRightIcon, BoltIcon, CheckIcon, CpuIcon, DownloadIcon, SparkIcon } from "../components/Icons";
import { Button, Chip, ProgressBar, Surface } from "../components/ui";
import { cx } from "../lib/util";

const TOOL_ROWS = [
  {
    id: "ffmpeg",
    name: "ffmpeg + ffprobe",
    purpose: "Reads the file, measures every second of it, cuts and reframes to 1080 × 1920",
    size: "about 120 MB",
  },
  {
    id: "yt-dlp",
    name: "yt-dlp",
    purpose: "Fetches the video, its own captions and Twitch VOD chat",
    size: "about 30 MB",
  },
];

export function Setup() {
  const { state, finishSetup, setHardwareProfile } = useStore();
  const { hardware } = state;
  const [tools, setTools] = useState<ToolStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge
      .tools()
      .then((status) => {
        if (alive) setTools(status);
      })
      .catch(() => {
        if (alive) setTools({ ready: false, missing: ["ffmpeg", "yt-dlp"] });
      });
    const off = bridge.onProgress((next) => setProgress(next));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const install = async () => {
    if (!bridge) return;
    setInstalling(true);
    setError(null);
    try {
      const response = await bridge.installTools();
      if (!response.ok) setError(response.error ?? "The tools could not be installed.");
      setTools(await bridge.tools());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setInstalling(false);
    }
  };

  const changeProfile = (tier: HardwareProfile["tier"]) => {
    if (tier === hardware.tier) return;
    setHardwareProfile(withManualProfile(hardware, tier));
  };

  const toolsReady = Boolean(tools?.ready);
  const tierLabel = hardware.tier === "studio" ? "Workstation" : hardware.tier === "balanced" ? "Gaming" : "Laptop";

  return (
    <div className="setup">
      <div className="setup__inner">
        <section className="setup__intro">
          <div className="setup__brand">
            <svg width="30" height="30" viewBox="0 0 26 26" aria-hidden="true">
              <path d="M4 4h9l9 9v9h-9L4 13V4Z" fill="currentColor" opacity="0.9" />
              <path d="M13 13h9L13 4v9Z" fill="#cdf25b" />
            </svg>
            <span>Offcut</span>
            <Chip tone="ready">
              <span className="dot" />
              runs on this machine
            </Chip>
          </div>

          <h1 className="setup__title">
            Long streams in.
            <br />
            Short clips out.
          </h1>
          <p className="setup__lede">
            Offcut downloads the real source, reads its captions and chat, measures the audio second by second, and
            cuts the moments that spiked into vertical clips with the real frames and real captions. Nothing is
            invented, and nothing is uploaded.
          </p>

          <Surface className="hw">
            <div className="hw__head">
              <div>
                <h2>Detected hardware</h2>
                <p>
                  {hardware.source === "detected"
                    ? "Read from this machine, not a guess."
                    : "Manual profile — override the auto-detection."}
                </p>
              </div>
              <Chip tone="ready">
                <BoltIcon size={13} />
                {tierLabel}
              </Chip>
            </div>

            <dl className="hw__grid">
              <div>
                <dt>
                  <CpuIcon size={14} /> Graphics
                </dt>
                <dd>{hardware.gpuName}</dd>
                <span>
                  {hardware.vramGb} GB usable VRAM · WebGPU {hardware.webgpu ? "on" : "off"}
                </span>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>{hardware.memoryGb} GB</dd>
                <span>{hardware.os}</span>
              </div>
              <div>
                <dt>CPU</dt>
                <dd>{hardware.threads} threads</dd>
                <span>ffmpeg worker pool</span>
              </div>
              <div>
                <dt>Output</dt>
                <dd>1080 × 1920</dd>
                <span>H.264 · 30 fps · burned captions</span>
              </div>
            </dl>

            <div className="hw__profile">
              <span className="field__label">Not your machine?</span>
              <div className="hw__options">
                {HARDWARE_PROFILES.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={cx("hw__option", hardware.tier === profile.id && "is-active")}
                    onClick={() => changeProfile(profile.id)}
                    aria-pressed={hardware.tier === profile.id}
                  >
                    <span>{profile.label}</span>
                    <small>{profile.vramGb} GB VRAM</small>
                  </button>
                ))}
              </div>
              <p className="hw__detail">
                {HARDWARE_PROFILES.find((profile) => profile.id === hardware.tier)?.detail}
              </p>
            </div>
          </Surface>
        </section>

        <Surface className="shelf">
          <header className="shelf__head">
            <div>
              <h2>Clipping engine</h2>
              <p>{bridge ? "Two command-line tools, installed once into this app's data folder." : "Needs the desktop app."}</p>
            </div>
            <Button
              variant="ink"
              size="sm"
              icon={<DownloadIcon size={15} />}
              onClick={() => void install()}
              disabled={!bridge || installing || toolsReady}
            >
              {installing ? "Installing" : toolsReady ? "Installed" : "Install tools"}
            </Button>
          </header>

          <ul className="shelf__list">
            {TOOL_ROWS.map((row) => {
              const ready = tools ? !tools.missing.includes(row.id) : false;
              return (
                <li key={row.id} className={cx("model", ready && "is-ready")}>
                  <span className="model__icon">{ready ? <CheckIcon size={16} /> : <SparkIcon size={16} />}</span>
                  <div className="model__body">
                    <div className="model__title">
                      <span>{row.name}</span>
                      <span className="model__req">required</span>
                    </div>
                    <p>{row.purpose}</p>
                    {installing && !ready ? (
                      <div className="model__progress">
                        <ProgressBar value={progress?.pct ?? 0} tone="lime" label={`${row.name} download`} />
                        <span className="mono">{progress?.message ?? "Downloading"}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="model__action">
                    <span className="model__size">{row.size}</span>
                    {ready ? (
                      <span className="model__check">ready</span>
                    ) : (
                      <span className="model__pct mono">{tools ? "missing" : "checking"}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {error ? <p className="composer__hint is-error">{error}</p> : null}

          <footer className="shelf__foot">
            <div className="shelf__total">
              <span>
                {toolsReady
                  ? "ffmpeg and yt-dlp are on disk."
                  : bridge
                    ? "The engine cannot cut anything until both are installed."
                    : "Open Offcut itself to install the engine."}
              </span>
              <ProgressBar value={toolsReady ? 100 : installing ? (progress?.pct ?? 0) : 0} label="Engine setup" />
            </div>
            <Button variant="primary" size="lg" iconRight={<ArrowRightIcon size={18} />} onClick={finishSetup}>
              Open the studio
            </Button>
            {toolsReady ? (
              <p className="shelf__note">
                Everything stays local. Offcut writes plain mp4 files you post yourself.
              </p>
            ) : (
              <button type="button" className="link-btn" onClick={finishSetup}>
                Continue without them
              </button>
            )}
          </footer>
        </Surface>

        <p className="setup__foot">
          Offcut is a local tool: it downloads the source you point it at, renders clips on this machine, and leaves
          the uploading to you.
        </p>
      </div>
    </div>
  );
}
