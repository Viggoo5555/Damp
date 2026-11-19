import type { Clip, Source } from "../types";
import { cx, timecode } from "../lib/util";
import { viralReport } from "../lib/engine";
import { BoltIcon, PlayIcon, TwitchMark, YoutubeMark } from "./Icons";
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
  return (
    <button
      type="button"
      className={cx("clip", compact && "clip--compact", selected && "is-selected")}
      onClick={onOpen}
    >
      <span className="clip__poster">
        <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} loading="lazy" />
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
        {clip.videoPath ? null : <span className="clip__demo">demo</span>}
        <span className="clip__play">
          <PlayIcon size={16} />
        </span>
      </span>
      <span className="clip__meta">
        <span className="clip__title">{clip.title}</span>
        <span className="clip__sub">
          <PlatformMark size={13} />
          {source?.channel ?? "your channel"}
          <span className="clip__sep">·</span>
          <span className="mono">{timecode(clip.startSec)}</span>
          <span className={cx("status", `status--${clip.status}`)}>{clip.status}</span>
        </span>
      </span>
    </button>
  );
}
