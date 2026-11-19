import { useEffect } from "react";
import type { Clip, Post } from "../types";
import { PLATFORM_LABEL } from "../types";
import type { Period } from "../lib/analytics";
import { totalsFor, trend } from "../lib/analytics";
import { formatMoney, formatNumber } from "../lib/util";
import { AreaChart } from "./Charts";
import { Button, Chip, IconButton, Surface } from "./ui";
import { CloseIcon, InstagramMark, TiktokMark, YoutubeMark } from "./Icons";

export function PostSheet({
  post,
  clip,
  period,
  onClose,
}: {
  post: Post | null;
  clip?: Clip;
  period: Period;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!post) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [post, onClose]);

  if (!post) return null;

  const stats = totalsFor([post], period);
  const points = trend([post], period);
  const Mark =
    post.platform === "shorts" ? YoutubeMark : post.platform === "tiktok" ? TiktokMark : InstagramMark;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet sheet--post glass"
        role="dialog"
        aria-modal="true"
        aria-label={`Performance: ${post.title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet__head">
          <div>
            <p className="sheet__eyebrow">
              <Mark size={13} /> {PLATFORM_LABEL[post.platform]} ·{" "}
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
            <h2>{post.title}</h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <CloseIcon size={18} />
          </IconButton>
        </header>

        <div className="sheet__scroll">
          <div className="post-hero">
            {clip ? (
              <div className="post-hero__poster">
                <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} />
                <div className="clip__grade" style={{ background: clip.tint }} />
                <span className="post-hero__caption">{clip.hook}</span>
              </div>
            ) : null}
            <div className="post-hero__stats">
              <div>
                <span className="stat__label">Views</span>
                <strong className="stat__value">{formatNumber(stats.views)}</strong>
              </div>
              <div>
                <span className="stat__label">Earnings</span>
                <strong className="stat__value">{formatMoney(stats.earnings, true)}</strong>
              </div>
              <div>
                <span className="stat__label">Subs gained</span>
                <strong className="stat__value">+{formatNumber(stats.subscribers)}</strong>
              </div>
              <div>
                <span className="stat__label">Watch-through</span>
                <strong className="stat__value">{Math.round(post.watchThrough * 100)}%</strong>
              </div>
              <div>
                <span className="stat__label">Likes</span>
                <strong className="stat__value">{formatNumber(post.likes)}</strong>
              </div>
              <div>
                <span className="stat__label">RPM</span>
                <strong className="stat__value">${stats.rpm.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <Surface className="post-chart">
            <div className="card-head">
              <div>
                <h3>Views, last {period} days</h3>
                <p>Daily views reported by {PLATFORM_LABEL[post.platform]}.</p>
              </div>
              <Chip>{clip?.chatSpike ? "chat spike source" : `${clip?.score ?? 0} score`}</Chip>
            </div>
            <AreaChart
              data={points.map((point) => point.views)}
              labels={points.map((point) => point.label)}
              formatValue={(value) => `${formatNumber(value)} views`}
              tone="ink"
              height={190}
            />
          </Surface>

          <div className="post-copy">
            <span className="field__label">Published copy</span>
            <p>{post.description}</p>
            <div className="post-copy__tags">
              {post.hashtags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <footer className="sheet__foot">
          <span className="sheet__foot-note">
            Earnings are estimates until the platform settles the month.
          </span>
          <Button variant="glass" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  );
}
