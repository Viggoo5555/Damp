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
import type { Clip, Source } from "../types";
import { cx } from "../lib/util";
import { bridge, mediaUrl } from "../lib/desktop";
import {
  CloseIcon,
  LoopIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  VolumeIcon,
} from "./Icons";
import { Chip, IconButton } from "./ui";

const RATES = [0.5, 1, 1.5, 2];

function clock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function Playback({
  clip,
  source,
  onClose,
}: {
  clip: Clip;
  source?: Source;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(Math.max(1, clip.endSec - clip.startSec));
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(true);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setFailed(true));
    } else {
      video.pause();
    }
  }, []);

  const seekTo = useCallback((next: number) => {
    const video = videoRef.current;
    if (!video) return;
    const limit = Number.isFinite(video.duration) ? video.duration : duration;
    const clamped = Math.min(Math.max(next, 0), limit || 0);
    video.currentTime = clamped;
    setTime(clamped);
  }, [duration]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName) && event.key !== "Escape") return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowRight" || event.key === "l") {
        event.preventDefault();
        seekTo((videoRef.current?.currentTime ?? 0) + 2);
      } else if (event.key === "ArrowLeft" || event.key === "j") {
        event.preventDefault();
        seekTo((videoRef.current?.currentTime ?? 0) - 2);
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        setMuted((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    shellRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, seekTo, toggle]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    video.playbackRate = rate;
    video.loop = loop;
  }, [volume, muted, rate, loop]);

  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const sourceLabel = [source?.channel, source?.platform === "twitch" ? "Twitch" : "YouTube"]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="player" role="dialog" aria-modal="true" aria-label={`Watching ${clip.title}`} ref={shellRef} tabIndex={-1}>
      <div className="player__wash" style={{ backgroundImage: `url("${clip.poster}")` }} aria-hidden="true" />

      <header className="player__head">
        <div className="player__titles">
          <p className="player__kicker">{sourceLabel || "Your render"}</p>
          <h2>{clip.title}</h2>
        </div>
        <div className="player__head-meta">
          <Chip tone={clip.status === "exported" ? "ready" : "neutral"}>{clip.status}</Chip>
          <span className="player__spec mono">
            {Math.round(clip.endSec - clip.startSec)}s · 1080 × 1920
          </span>
          <IconButton label="Close player" className="icon-btn--onDark" onClick={onClose}>
            <CloseIcon size={18} />
          </IconButton>
        </div>
      </header>

      <div className="player__stage">
        <div className="player__frame">
          <video
            ref={videoRef}
            className="player__video"
            src={mediaUrl(clip.videoPath ?? "")}
            poster={clip.poster}
            playsInline
            autoPlay
            loop={loop}
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              const next = event.currentTarget.duration;
              if (Number.isFinite(next) && next > 0.2) setDuration(next);
              setLoading(false);
            }}
            onCanPlay={() => setLoading(false)}
            onWaiting={() => setLoading(true)}
            onPlaying={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />

          {loading && !failed ? (
            <span className="player__load" aria-hidden="true">
              <span className="spinner" />
            </span>
          ) : null}

          {failed ? (
            <div className="player__fail" role="alert">
              <strong>This file would not open</strong>
              <p>
                The mp4 may have been moved or deleted since it was rendered. Re-run the source in the studio, or reveal
                the folder to check.
              </p>
              {clip.videoPath ? (
                <button type="button" className="btn btn--glass btn--sm" onClick={() => void bridge?.reveal(clip.videoPath)}>
                  Show file
                </button>
              ) : null}
            </div>
          ) : null}

          {!playing && !failed && !loading ? (
            <button type="button" className="player__big" onClick={toggle} aria-label="Play">
              <PlayIcon size={30} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="player__controls glass glass--ink">
        <div className="player__scrub">
          <span className="player__clock mono">{clock(time)}</span>
          <input
            type="range"
            className="player__seek"
            min={0}
            max={Math.max(0.1, duration)}
            step={0.01}
            value={Math.min(time, duration)}
            aria-label="Scrub"
            style={{
              background: `linear-gradient(to right, var(--lime) ${progress}%, rgba(255,255,255,0.24) ${progress}%)`,
            }}
            onChange={(event) => seekTo(Number(event.target.value))}
          />
          <span className="player__clock mono">{clock(duration)}</span>
        </div>

        <div className="player__row">
          <div className="player__group">
            <button type="button" className="player__btn player__btn--main" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
            </button>

            <button
              type="button"
              className="player__btn"
              onClick={() => setMuted((current) => !current)}
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
            >
              {muted || volume === 0 ? <MuteIcon size={18} /> : <VolumeIcon size={18} />}
            </button>
            <input
              type="range"
              className="player__vol"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(event) => {
                const next = Number(event.target.value);
                setVolume(next);
                setMuted(next === 0);
              }}
            />

            <span className="player__divider" aria-hidden="true" />

            <button
              type="button"
              className={cx("player__btn", loop && "is-on")}
              onClick={() => setLoop((current) => !current)}
              aria-pressed={loop}
              aria-label="Loop the clip"
              title="Loop the clip"
            >
              <LoopIcon size={18} />
            </button>

            <div className="player__rates" role="group" aria-label="Playback speed">
              {RATES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cx("player__rate", rate === value && "is-on")}
                  aria-pressed={rate === value}
                  onClick={() => setRate(value)}
                >
                  {value}×
                </button>
              ))}
            </div>
          </div>

          <div className="player__group player__group--end">
            <span className="player__keys" aria-hidden="true">
              space play · ← → seek · m mute · esc close
            </span>
            {clip.videoPath ? (
              <button type="button" className="player__btn player__btn--text" onClick={() => void bridge?.reveal(clip.videoPath)}>
                Show file
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const PlayerContext = createContext<{ play: (clip: Clip, source?: Source) => void } | null>(null);

/** Puts one overlay player above the app so any screen can hand it a rendered clip. */
export function PlayerHost({ children }: { children: ReactNode }) {
  const [watching, setWatching] = useState<{ clip: Clip; source?: Source } | null>(null);

  const play = useCallback((clip: Clip, source?: Source) => {
    if (!clip.videoPath) return;
    setWatching({ clip, source });
  }, []);

  const value = useMemo(() => ({ play }), [play]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {watching ? (
        <Playback clip={watching.clip} source={watching.source} onClose={() => setWatching(null)} />
      ) : null}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  return value ?? { play: () => {} };
}
