import { useEffect, useRef, useState } from "react";
import type { Clip, Source } from "../types";
import { cx, timecode } from "../lib/util";
import { viralReport } from "../lib/engine";
import { mediaUrl } from "../lib/desktop";
import { BoltIcon, PlayIcon, TwitchMark, YoutubeMark } from "./Icons";
import { usePlayer } from "./Player";
import { ScoreBadge } from "./ui";

export function ClipCard({
  clip,
  source,
  onOpen,
  compact = false,
  selected = false,
}: {
  clip: Clip;
  source?: Source;
  onOpen: () => void;
  compact?: boolean;
  selected?: boolean;
}) {
  const PlatformMark = source?.platform === "twitch" ? TwitchMark : YoutubeMark;
  const viral = viralReport(clip).score;
  const { play } = usePlayer();
  const [hovering, setHovering] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const startPreview = () => {
    if (!clip.videoPath) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHovering(true), 260);
  };

  const stopPreview = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setHovering(false);
  };

  return (
    <div
      className={cx("clip", compact && "clip--compact", selected && "is-selected")}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
    >
      <div className="clip__poster">
        <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} loading="lazy" />

        {hovering && clip.videoPath ? (
          <video
            className="clip__preview"
            src={mediaUrl(clip.videoPath)}
            poster={clip.poster}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedData={(event) => {
              const video = event.currentTarget;
              video.currentTime = 0.15;
              void video.play().catch(() => {});
            }}
          />
        ) : null}

        <span className="clip__grade" style={{ background: clip.tint }} />
        <span className="clip__top">
          <ScoreBadge score={clip.score} />
          <span className="clip__duration">{clip.endSec - clip.startSec}s</span>
        </span>
        {clip.chatSpike ? (
          <span className="clip__spike">
            <BoltIcon size={12} />
            chat spike
          </span>
        ) : null}
        <span
          className={cx("clip__viral", viral >= 85 && "is-hot")}
          title={`Viral potential ${viral}/100`}
        >
          <span className="clip__viral-dot" />
          viral {viral}
        </span>
        <span className={cx("clip__caption", `clip__caption--${clip.subtitleStyle}`)}>{clip.hook}</span>

        <button
          type="button"
          className="clip__open"
          aria-label={`Open ${clip.title}`}
          onClick={onOpen}
        />

        {clip.videoPath ? (
          <button
            type="button"
            className="clip__play"
            aria-label={`Watch ${clip.title}`}
            title="Play in Offcut"
            onClick={() => play(clip, source)}
          >
            <PlayIcon size={16} />
          </button>
        ) : (
          <span className="clip__play" aria-hidden="true">
            <PlayIcon size={16} />
          </span>
        )}
      </div>

      <div className="clip__meta">
        <button type="button" className="clip__title" onClick={onOpen}>
          {clip.title}
        </button>
        <div className="clip__sub">
          <PlatformMark size={13} />
          {source?.channel ?? "your channel"}
          <span className="clip__sep">·</span>
          <span className="mono">{timecode(clip.startSec)}</span>
          <span className={cx("status", `status--${clip.status}`)}>{clip.status}</span>
        </div>
      </div>
    </div>
  );
}
