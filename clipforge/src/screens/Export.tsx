import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Clip, ClipPlatform, Screen } from "../types";
import { PLATFORM_LABEL } from "../types";
import { useStore } from "../store";
import { cx, timecode } from "../lib/util";
import { bridge } from "../lib/desktop";
import { Button, Chip, Surface } from "../components/ui";
import { usePlayer } from "../components/Player";
import {
  CheckIcon,
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

/** Where you actually upload a rendered file. */
const UPLOAD_URL: Record<ClipPlatform, string> = {
  shorts: "https://studio.youtube.com",
  tiktok: "https://www.tiktok.com/tiktokstudio/upload",
  reels: "https://www.instagram.com/",
};

const TITLE_LIMIT: Record<ClipPlatform, number> = { shorts: 100, tiktok: 150, reels: 125 };

interface CopyDraft {
  title: string;
  description: string;
  hashtags: string;
}

function baseCopy(clip: Clip, sourceTitle: string | undefined): CopyDraft {
  return {
    title: clip.title.replace(/^[a-z]/, (char) => char.toUpperCase()),
    description: `${clip.hook ? `${clip.hook} — ` : ""}clipped from ${sourceTitle ?? "the stream"}. Full video on the channel.`,
    hashtags: "#shorts #clips",
  };
}

function captionFor(draft: CopyDraft, platform: ClipPlatform): string {
  const tags = draft.hashtags.trim();
  const extra = platform === "tiktok" && !/#fyp\b/i.test(tags) ? "#fyp" : "";
  const allTags = [tags, extra].filter(Boolean).join(" ");
  return [draft.title.trim(), "", draft.description.trim(), "", allTags].join("\n").trim();
}

export function Export({
  onNavigate,
  focusClipId,
}: {
  onNavigate: (screen: Screen) => void;
  focusClipId: string | null;
}) {
  const { state, setClipStatus } = useStore();
  const { play } = usePlayer();
  const candidates = useMemo(
    () => state.clips.filter((clip) => clip.status !== "exported"),
    [state.clips],
  );
  const [selected, setSelected] = useState<string[]>(() => {
    if (focusClipId && state.clips.some((clip) => clip.id === focusClipId && clip.status !== "exported")) {
      return [focusClipId];
    }
    const first = state.clips.find((clip) => clip.status === "ready") ?? state.clips[0];
    return first ? [first.id] : [];
  });
  const [targets, setTargets] = useState<Record<ClipPlatform, boolean>>({
    shorts: true,
    tiktok: true,
    reels: false,
  });
  const [drafts, setDrafts] = useState<Record<string, CopyDraft>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string[] | null>(null);

  const activePlatforms = PLATFORMS.filter((platform) => targets[platform.id]);

  const clipById = (id: string) => state.clips.find((clip) => clip.id === id);
  const sourceTitle = (clip: Clip) => state.sources.find((source) => source.id === clip.sourceId)?.title;

  const draftFor = (clip: Clip): CopyDraft => drafts[clip.id] ?? baseCopy(clip, sourceTitle(clip));

  const updateDraft = (clip: Clip, patch: Partial<CopyDraft>) => {
    setDrafts((current) => ({
      ...current,
      [clip.id]: { ...draftFor(clip), ...patch },
    }));
  };

  const toggleClip = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  useEffect(() => {
    if (!focusClipId) return;
    setSelected((current) => (current.includes(focusClipId) ? current : [focusClipId, ...current]));
  }, [focusClipId]);

  const copyCaption = async (text: string, key: string) => {
    setError(null);
    try {
      if (bridge) await bridge.copyText(text);
      else await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reach the clipboard.");
    }
  };

  const markExported = () => {
    if (!selected.length) return;
    selected.forEach((id) => setClipStatus(id, "exported"));
    setExported(selected);
  };

  if (exported) {
    return (
      <Surface className="published glass--tall">
        <span className="published__mark">
          <CheckIcon size={26} />
        </span>
        <h2>
          {exported.length} {exported.length === 1 ? "cut" : "cuts"} marked exported
        </h2>
        <p>
          Each one is a real 1080 × 1920 mp4 in your clips folder. Copy a caption, open the platform's uploader, and
          post it — Offcut never uploads for you.
        </p>
        <div className="published__list">
          {exported.map((clipId) => {
            const clip = clipById(clipId);
            if (!clip) return null;
            const draft = draftFor(clip);
            return (
              <div key={clipId} className="published__row">
                <img src={clip.poster} alt="" />
                <div>
                  <strong>{draft.title}</strong>
                  <span>
                    <span className="mono">
                      {timecode(clip.startSec)}–{timecode(clip.endSec)}
                    </span>
                    <span className="clip__sep">·</span>
                    {activePlatforms.map((platform) => PLATFORM_LABEL[platform.id]).join(" · ")}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PlayIcon size={14} />}
                  onClick={() => play(clip, state.sources.find((source) => source.id === clip.sourceId))}
                >
                  Watch
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => void copyCaption(captionFor(draft, activePlatforms[0]?.id ?? "shorts"), `${clipId}-done`)}
                >
                  {copied === `${clipId}-done` ? "Copied" : "Copy caption"}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="published__actions">
          <Button variant="primary" onClick={() => void bridge?.reveal()}>
            Open clips folder
          </Button>
          <Button variant="ghost" icon={<ScissorsIcon size={16} />} onClick={() => onNavigate("studio")}>
            Cut another video
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
            <h2>Rendered cuts</h2>
            <p>
              {candidates.length > 0
                ? `${candidates.length} real mp4${candidates.length === 1 ? "" : "s"} on disk. Pick what you are posting.`
                : "Nothing left to export. Run another link through the studio."}
            </p>
          </div>
        </div>

        {candidates.length === 0 ? (
          <Surface className="panel-empty">
            <ScissorsIcon size={22} />
            <h3>No unexported cuts</h3>
            <p>Every rendered clip has been marked exported. Pull another video to keep going.</p>
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
                        {Math.round(clip.endSec - clip.startSec)}s
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
              <p>Pick the destinations so the caption matches their limits.</p>
            </div>
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
                    <span>{TITLE_LIMIT[platform.id]} character title</span>
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
            <p>Select one or more rendered clips on the left and the caption editor appears here.</p>
          </Surface>
        ) : (
          selected.map((clipId) => {
            const clip = clipById(clipId);
            if (!clip) return null;
            const draft = draftFor(clip);
            const overLimit = activePlatforms.filter((platform) => draft.title.length > TITLE_LIMIT[platform.id]);
            return (
              <Surface key={clipId} className="copy-card">
                <header className="copy-card__head">
                  <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} />
                  <div>
                    <span className="copy-card__kicker">
                      {clip.chatSpike ? "Chat spike · " : ""}
                      {clip.score} score · {Math.round(clip.endSec - clip.startSec)}s
                    </span>
                    <h3>{clip.title}</h3>
                  </div>
                  <div className="copy-card__head-actions">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => play(clip, state.sources.find((source) => source.id === clip.sourceId))}
                    >
                      Watch
                    </button>
                    <button type="button" className="link-btn" onClick={() => toggleClip(clip.id)}>
                      Remove
                    </button>
                  </div>
                </header>

                <label className="field">
                  <span className="field__head">
                    <span className="field__label">Title</span>
                    <span className="field__hint field__hint--mono">{draft.title.length} characters</span>
                  </span>
                  <input
                    className="input"
                    maxLength={2200}
                    value={draft.title}
                    onChange={(event) => updateDraft(clip, { title: event.target.value })}
                  />
                </label>
                {overLimit.length ? (
                  <span className="copy-card__warn">
                    Too long for {overLimit.map((platform) => PLATFORM_LABEL[platform.id]).join(" and ")} — trim it to{" "}
                    {Math.min(...overLimit.map((platform) => TITLE_LIMIT[platform.id]))} characters.
                  </span>
                ) : null}

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
                    <span className="field__hint">copied with the caption</span>
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
                      const key = `${clip.id}-${platform.id}`;
                      return (
                        <div className="copy-card__target" key={platform.id}>
                          <Icon size={14} />
                          <span>{PLATFORM_LABEL[platform.id]}</span>
                          <Button
                            variant="glass"
                            size="sm"
                            onClick={() => void copyCaption(captionFor(draft, platform.id), key)}
                          >
                            {copied === key ? "Copied" : "Copy caption"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(UPLOAD_URL[platform.id], "_blank", "noopener")}
                          >
                            Open uploader
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </Surface>
            );
          })
        )}

        {error ? <p className="composer__hint is-error">{error}</p> : null}

        <Surface className="publish-bar">
          <div className="publish-bar__summary">
            <strong>
              {selected.length} {selected.length === 1 ? "cut" : "cuts"}
            </strong>
            <span>
              {activePlatforms.length} {activePlatforms.length === 1 ? "destination" : "destinations"} · files already
              rendered
            </span>
          </div>
          <div className="publish-bar__actions">
            <Button variant="ghost" onClick={() => void bridge?.reveal(clipById(selected[0])?.videoPath)}>
              Show file
            </Button>
            <Button variant="primary" size="lg" disabled={!selected.length} onClick={markExported} icon={<CheckIcon size={17} />}>
              Mark exported
            </Button>
          </div>
        </Surface>
        <Chip>Captions are copied to your clipboard. Nothing is posted automatically.</Chip>
      </div>
    </div>
  );
}
