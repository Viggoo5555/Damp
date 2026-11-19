import type { HardwareProfile } from "../types";
import { useStore } from "../store";
import { HARDWARE_PROFILES, withManualProfile } from "../lib/hardware";
import { shelfSize } from "../lib/models";
import { ArrowRightIcon, BoltIcon, CheckIcon, CpuIcon, DownloadIcon, SparkIcon } from "../components/Icons";
import { Button, Chip, ProgressBar, Surface } from "../components/ui";
import { cx } from "../lib/util";

export function Setup() {
  const { state, downloadModel, downloadAll, finishSetup, setHardwareProfile } = useStore();
  const { hardware, models } = state;

  const required = models.filter((model) => model.required);
  const requiredReady = required.every((model) => model.status === "ready");
  const downloading = models.some((model) => model.status === "downloading");
  const allReady = models.every((model) => model.status === "ready");
  const totalSize = shelfSize(models);
  const downloaded = models.reduce((total, model) => total + (model.sizeGb * model.progress) / 100, 0);

  const changeProfile = (tier: HardwareProfile["tier"]) => {
    if (tier === hardware.tier) return;
    const hasDownloads = models.some((model) => model.progress > 0);
    if (hasDownloads && !window.confirm("Switching shelf clears downloaded models. Continue?")) return;
    setHardwareProfile(withManualProfile(hardware, tier));
  };

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
            Offcut pulls the source, reads the transcript and the chat, finds the minute everyone reacted to,
            then cuts, reframes and edits it to match the source — and scores every cut for how far it will
            travel. Everything happens on your hardware.
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
                {hardware.tier === "studio" ? "Workstation" : hardware.tier === "balanced" ? "Gaming" : "Laptop"} shelf
              </Chip>
            </div>

            <dl className="hw__grid">
              <div>
                <dt>
                  <CpuIcon size={14} /> Graphics
                </dt>
                <dd>{hardware.gpuName}</dd>
                <span>{hardware.vramGb} GB usable VRAM · WebGPU {hardware.webgpu ? "on" : "off"}</span>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>{hardware.memoryGb} GB</dd>
                <span>{hardware.os}</span>
              </div>
              <div>
                <dt>CPU</dt>
                <dd>{hardware.threads} threads</dd>
                <span>Transcription worker pool</span>
              </div>
              <div>
                <dt>Output</dt>
                <dd>1080 × 1920</dd>
                <span>H.264 · 60 fps · burned captions</span>
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
              <h2>Recommended models</h2>
              <p>
                Picked for {hardware.vramGb} GB VRAM · {totalSize.toFixed(1)} GB total
              </p>
            </div>
            <Button
              variant="ink"
              size="sm"
              icon={<DownloadIcon size={15} />}
              onClick={downloadAll}
              disabled={allReady || downloading}
            >
              {downloading ? "Downloading" : allReady ? "All downloaded" : "Download all"}
            </Button>
          </header>

          <ul className="shelf__list">
            {models.map((model) => (
              <li key={model.id} className={cx("model", model.status === "ready" && "is-ready")}>
                <span className="model__icon">
                  {model.status === "ready" ? <CheckIcon size={16} /> : <SparkIcon size={16} />}
                </span>
                <div className="model__body">
                  <div className="model__title">
                    <span>{model.name}</span>
                    {model.required ? <span className="model__req">required</span> : null}
                  </div>
                  <p>{model.purpose}</p>
                  {model.status === "downloading" ? (
                    <div className="model__progress">
                      <ProgressBar value={model.progress} tone="lime" label={`${model.name} download`} />
                      <span className="mono">
                        {((model.sizeGb * model.progress) / 100).toFixed(2)} / {model.sizeGb} GB ·{" "}
                        {model.speedMbps} MB/s
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="model__action">
                  <span className="model__size">{model.sizeGb < 0.1 ? `${Math.round(model.sizeGb * 1000)} MB` : `${model.sizeGb} GB`}</span>
                  {model.status === "idle" ? (
                    <Button variant="glass" size="sm" onClick={() => downloadModel(model.id)}>
                      Get
                    </Button>
                  ) : model.status === "ready" ? (
                    <span className="model__check">ready</span>
                  ) : (
                    <span className="model__pct mono">{Math.round(model.progress)}%</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <footer className="shelf__foot">
            <div className="shelf__total">
              <span>
                {downloaded.toFixed(1)} of {totalSize.toFixed(1)} GB
              </span>
              <ProgressBar value={(downloaded / totalSize) * 100} label="Shelf download progress" />
            </div>
            <Button
              variant="primary"
              size="lg"
              disabled={!requiredReady}
              iconRight={<ArrowRightIcon size={18} />}
              onClick={finishSetup}
            >
              Open the studio
            </Button>
            {!requiredReady ? (
              <button type="button" className="link-btn" onClick={finishSetup}>
                I'll download them later
              </button>
            ) : (
              <p className="shelf__note">
                Required models are on disk. Nothing is sent anywhere until you publish.
              </p>
            )}
          </footer>
        </Surface>

        <p className="setup__foot">
          Preview build: model downloads, rendering and publishing run against a local simulator. Your edits and
          channel history stay in this browser profile.
        </p>
      </div>
    </div>
  );
}
