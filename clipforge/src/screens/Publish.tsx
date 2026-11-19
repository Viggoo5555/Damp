import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Clip, ClipPlatform, Screen } from "../types";
import { PLATFORM_HANDLE, PLATFORM_LABEL } from "../types";
import { useStore } from "../store";
import { viralReport } from "../lib/engine";
import { cx, formatNumber, timecode } from "../lib/util";
import { Button, Chip, ProgressBar, Surface } from "../components/ui";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  InstagramMark,
  PlayIcon,
  ScissorsIcon,
  TiktokMark,
  TwitchMark,
  YoutubeMark,
} from "../components/Icons";

const PLATFORMS: Array<{ id: ClipPlatform; icon: (props: { size?: number }) => ReactNode }> = [
  { id: "shorts", icon: YoutubeMark },
  { id: "tiktok", icon: TiktokMark },
  { id: "reels", icon: InstagramMark },
];

interface CopyDraft {
  title: string;
  description: string;
  hashtags: string;
}

interface UploadJob {
  targets: Array<{ clipId: string; platform: ClipPlatform }>;
  index: number;
  progress: number;
  count: number;
  done: boolean;
}

function baseCopy(clip: Clip, sourceTitle: string | undefined): CopyDraft {
  return {
    title: clip.title.replace(/^[a-z]/, (char) => char.toUpperCase()),
    description: `${clip.hook} — pulled from ${sourceTitle ?? "the stream"}. Full video on the channel.`,
    hashtags: "#shorts #streamer #clips",
  };
}

export function Publish({
  onNavigate,
  focusClipId,
}: {
  onNavigate: (screen: Screen) => void;
  focusClipId: string | null;
}) {
  const { state, publish } = useStore();
  const candidates = useMemo(
    () => state.clips.filter((clip) => clip.status !== "published"),
    [state.clips],
  );
  const [selected, setSelected] = useState<string[]>(() => {
    if (focusClipId && state.clips.some((clip) => clip.id === focusClipId && clip.status !== "published")) {
      return [focusClipId];
    }
    const ready = state.clips.find((clip) => clip.status === "ready");
    return ready ? [ready.id] : [];
  });
  const [targets, setTargets] = useState<Record<ClipPlatform, boolean>>({
    shorts: true,
    tiktok: true,
    reels: false,
  });
  const [drafts, setDrafts] = useState<Record<string, CopyDraft>>({});
  const [job, setJob] = useState<UploadJob | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const finished = useRef(false);

  const activePlatforms = PLATFORMS.filter((platform) => targets[platform.id]);
  const readyCount = state.clips.filter((clip) => clip.status === "ready").length;

  const clipById = (id: string) => state.clips.find((clip) => clip.id === id);
  const sourceTitle = (clip: Clip) => state.sources.find((source) => source.id === clip.sourceId)?.title;

  const draftFor = (clip: Clip): CopyDraft =>
    drafts[clip.id] ?? baseCopy(clip, sourceTitle(clip));

  const updateDraft = (clip: Clip, patch: Partial<CopyDraft>) => {
    setDrafts((current) => ({
      ...current,
      [clip.id]: { ...draftFor(clip), ...patch },
    }));
  };

  const toggleClip = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  useEffect(() => {
    if (!focusClipId) return;
    setSelected((current) => (current.includes(focusClipId) ? current : [focusClipId, ...current]));
  }, [focusClipId]);

  const totalPosts = selected.length * activePlatforms.length;

  const startUpload = () => {
    if (totalPosts === 0) return;
    finished.current = false;
    setResult(null);
    const jobTargets = selected.flatMap((clipId) =>
      activePlatforms.map((platform) => ({ clipId, platform: platform.id })),
    );
    setJob({ targets: jobTargets, index: 0, progress: 0, count: jobTargets.length, done: false });
  };

  useEffect(() => {
    if (!job || job.done) return;
    const timer = window.setInterval(() => {
      setJob((current) => {
        if (!current || current.done) return current;
        const progress = current.progress + 6 + Math.random() * 9;
        if (progress < 100) return { ...current, progress };
        if (current.index < current.targets.length - 1) {
          return { ...current, index: current.index + 1, progress: 0 };
        }
        return { ...current, progress: 100, done: true };
      });
    }, 150);
    return () => window.clearInterval(timer);
  }, [job?.index, job?.done]);

  useEffect(() => {
    if (!job?.done || finished.current) return;
    finished.current = true;
    const entries = selected
      .map((clipId) => {
        const clip = clipById(clipId);
        if (!clip) return null;
        const draft = draftFor(clip);
        const hashtagList = draft.hashtags
          .split(/[\s,]+/)
          .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
          .filter(Boolean);
        const copy = Object.fromEntries(
          activePlatforms.map((platform) => [
            platform.id,
            {
              title: draft.title,
              description: draft.description,
              hashtags: Array.from(
                new Set([
                  ...hashtagList,
                  ...(platform.id === "tiktok" ? ["#fyp"] : []),
                  ...(platform.id === "reels" ? ["#reels"] : []),
                ]),
              ).slice(0, 6),
            },
          ]),
        ) as Record<ClipPlatform, { title: string; description: string; hashtags: string[] }>;
        return { clip, platforms: activePlatforms.map((platform) => platform.id), copy };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const created = publish(entries);
    setResult(created.length);
  }, [job?.done]);

  if (result !== null) {
    return (
      <Surface className="published glass--tall">
        <span className="published__mark">
          <CheckIcon size={26} />
        </span>
        <h2>{result} posts are live</h2>
        <p>
          Titles, descriptions and hashtags went out with each cut. Most of a Short's views land in the first 48
          hours — check Performance after the first day.
        </p>
        <div className="published__list">
          {selected.map((clipId) => {
            const clip = clipById(clipId);
            if (!clip) return null;
            return (
              <div key={clipId} className="published__row">
                <img src={clip.poster} alt="" />
                <div>
                  <strong>{draftFor(clip).title}</strong>
                  <span>
                    {activePlatforms.map((platform) => PLATFORM_LABEL[platform.id]).join(" · ")} ·{" "}
                    <span className="mono">
                      {timecode(clip.startSec)}–{timecode(clip.endSec)}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="published__actions">
          <Button variant="primary" iconRight={<ArrowRightIcon size={17} />} onClick={() => onNavigate("analytics")}>
            Track performance
          </Button>
          <Button variant="ghost" icon={<ScissorsIcon size={16} />} onClick={() => onNavigate("studio")}>
            Cut another stream
          </Button>
        </div>
      </Surface>
    );
  }

  return (
    <div className="publish">
      <div className="publish__left">
        <div className="section-head section-head--tight">
          <div>
            <h2>Your cuts</h2>
            <p>
              {readyCount > 0
                ? `${readyCount} marked ready. Pick what goes out today.`
                : "Mark cuts ready in the studio to send them here."}
            </p>
          </div>
        </div>

        {candidates.length === 0 ? (
          <Surface className="panel-empty">
            <ScissorsIcon size={22} />
            <h3>Nothing waiting</h3>
            <p>Every cut is published. Pull another source to keep the queue moving.</p>
            <Button variant="glass" onClick={() => onNavigate("studio")}>
              Back to the studio
            </Button>
          </Surface>
        ) : (
          <ul className="pick-list">
            {candidates.map((clip) => {
              const source = state.sources.find((item) => item.id === clip.sourceId);
              const isSelected = selected.includes(clip.id);
              return (
                <li key={clip.id}>
                  <button
                    type="button"
                    className={cx("pick", isSelected && "is-selected")}
                    onClick={() => toggleClip(clip.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="pick__check">{isSelected ? <CheckIcon size={13} /> : null}</span>
                    <span className="pick__poster">
                      <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} />
                      <span className="pick__play">
                        <PlayIcon size={11} />
                      </span>
                    </span>
                    <span className="pick__body">
                      <span className="pick__title">{clip.title}</span>
                      <span className="pick__meta">
                        {source?.platform === "twitch" ? <TwitchMark size={12} /> : <YoutubeMark size={13} />}
                        {source?.channel}
                        <span className="clip__sep">·</span>
                        {(clip.endSec - clip.startSec).toString()}s
                        <span className="clip__sep">·</span>
                        {clip.score} score
                      </span>
                    </span>
                    {clip.status === "draft" ? <span className="pick__flag">draft</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="publish__right">
        <Surface className="composer-card">
          <header className="card-head">
            <div>
              <h2>Where it goes</h2>
              <p>Accounts are signed in on this machine.</p>
            </div>
            <Chip tone="ready">
              <span className="dot" />
              local tokens
            </Chip>
          </header>

          <div className="destinations">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              const on = targets[platform.id];
              return (
                <button
                  key={platform.id}
                  type="button"
                  className={cx("destination", on && "is-on")}
                  onClick={() => setTargets((current) => ({ ...current, [platform.id]: !current[platform.id] }))}
                  aria-pressed={on}
                >
                  <span className="destination__icon">
                    <Icon size={19} />
                  </span>
                  <span className="destination__body">
                    <strong>{PLATFORM_LABEL[platform.id]}</strong>
                    <span>{PLATFORM_HANDLE[platform.id]}</span>
                  </span>
                  <span className="destination__switch" aria-hidden="true">
                    <span />
                  </span>
                </button>
              );
            })}
          </div>
        </Surface>

        {selected.length === 0 ? (
          <Surface className="panel-empty panel-empty--soft">
            <h3>Pick a cut</h3>
            <p>Select one or more clips on the left and the post copy appears here.</p>
          </Surface>
        ) : (
          selected.map((clipId) => {
            const clip = clipById(clipId);
            if (!clip) return null;
            const draft = draftFor(clip);
            return (
              <Surface key={clipId} className="copy-card">
                <header className="copy-card__head">
                  <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} />
                  <div>
                    <span className="copy-card__kicker">
                      {clip.chatSpike ? "Chat spike · " : ""}
                      {clip.score} score · viral {viralReport(clip).score}
                    </span>
                    <h3>{clip.title}</h3>
                  </div>
                  <button type="button" className="link-btn" onClick={() => toggleClip(clip.id)}>
                    Remove
                  </button>
                </header>

                <label className="field">
                  <span className="field__head">
                    <span className="field__label">Title</span>
                    <span className="field__hint field__hint--mono">{draft.title.length}/100</span>
                  </span>
                  <input
                    className="input"
                    maxLength={100}
                    value={draft.title}
                    onChange={(event) => updateDraft(clip, { title: event.target.value })}
                  />
                </label>

                <label className="field">
                  <span className="field__label">Description</span>
                  <textarea
                    className="input input--area"
                    rows={3}
                    value={draft.description}
                    onChange={(event) => updateDraft(clip, { description: event.target.value })}
                  />
                </label>

                <label className="field">
                  <span className="field__head">
                    <span className="field__label">Hashtags</span>
                    <span className="field__hint">added to every destination</span>
                  </span>
                  <input
                    className="input"
                    value={draft.hashtags}
                    onChange={(event) => updateDraft(clip, { hashtags: event.target.value })}
                  />
                </label>

                <div className="copy-card__targets">
                  {activePlatforms.length === 0 ? (
                    <span className="copy-card__warn">Pick at least one destination above.</span>
                  ) : (
                    activePlatforms.map((platform) => {
                      const Icon = platform.icon;
                      return (
                        <span key={platform.id} className="copy-card__target">
                          <Icon size={14} />
                          {PLATFORM_LABEL[platform.id]}
                        </span>
                      );
                    })
                  )}
                </div>
              </Surface>
            );
          })
        )}

        <Surface className="publish-bar">
          {job && !job.done ? (
            <div className="publish-bar__job">
              <div className="publish-bar__line">
                <span>
                  Uploading {job.index + 1} of {job.count} ·{" "}
                  {PLATFORM_LABEL[job.targets[job.index].platform]}
                </span>
                <span className="mono">{Math.round(((job.index + job.progress / 100) / job.count) * 100)}%</span>
              </div>
              <ProgressBar value={((job.index + job.progress / 100) / job.count) * 100} tone="lime" label="Upload" />
            </div>
          ) : (
            <>
              <div className="publish-bar__summary">
                <strong>
                  {totalPosts} {totalPosts === 1 ? "post" : "posts"}
                </strong>
                <span>
                  {selected.length} {selected.length === 1 ? "cut" : "cuts"} · {activePlatforms.length}{" "}
                  {activePlatforms.length === 1 ? "destination" : "destinations"}
                </span>
              </div>
              <div className="publish-bar__actions">
                <span className="publish-bar__when">
                  <ClockIcon size={14} />
                  Go out now
                </span>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={totalPosts === 0}
                  onClick={startUpload}
                  icon={<ArrowRightIcon size={18} />}
                >
                  Publish
                </Button>
              </div>
            </>
          )}
        </Surface>

        <p className="predict">
          <CheckIcon size={14} />
          Predicted first-day views{" "}
          <b>{formatNumber(selected.reduce((total, id) => total + (clipById(id)?.score ?? 0) * 620, 0))}</b> —
          based on your last 30 days and {activePlatforms.length} destinations.
        </p>
      </div>
    </div>
  );
}
