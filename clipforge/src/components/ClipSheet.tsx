import { useEffect, useRef } from "react";
import type { Clip, CropMode, EditRecipe, PacingMode, Source, SubtitleStyle } from "../types";
import { useStore } from "../store";
import { cx, timecode } from "../lib/util";
import { recommendedEdit, viralReport } from "../lib/engine";
import { bridge } from "../lib/desktop";
import { ArrowRightIcon, BoltIcon, CloseIcon, CropIcon, PlayIcon, SparkIcon } from "./Icons";
import { usePlayer } from "./Player";
import { Button, Chip, IconButton, ScoreBadge, Segmented, Toggle } from "./ui";

const STYLES: Array<{ value: SubtitleStyle; label: string }> = [
  { value: "pop", label: "Pop" },
  { value: "clean", label: "Clean" },
  { value: "karaoke", label: "Karaoke" },
];

const CROPS: Array<{ value: CropMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "facecam", label: "Facecam" },
  { value: "gameplay", label: "Gameplay" },
];

const PACING: Array<{ value: PacingMode; label: string }> = [
  { value: "match", label: "Match source" },
  { value: "fast", label: "Fast" },
  { value: "cinematic", label: "Cinematic" },
];

type EditToggle = "punchIns" | "reactionZoom" | "soundFx" | "motion" | "captionEmphasis" | "loop";

const EDIT_FIELDS: Array<{ key: EditToggle; label: string; detail: string }> = [
  { key: "punchIns", label: "Punch-ins", detail: "Snaps in on the reaction at the peak" },
  { key: "reactionZoom", label: "Reaction zoom", detail: "Follows the face instead of the whole frame" },
  { key: "soundFx", label: "Sound design", detail: "Whoosh and thump on every cut" },
  { key: "motion", label: "Micro motion", detail: "A slow push so still frames keep moving" },
  { key: "captionEmphasis", label: "Caption emphasis", detail: "Sizes the punch word above the rest" },
  { key: "loop", label: "Loop ending", detail: "Ends on the first frame so it replays" },
];

export function ClipSheet({
  clip,
  source,
  onClose,
  onSendToPublish,
}: {
  clip: Clip | null;
  source?: Source;
  onClose: () => void;
  onSendToPublish: (clipId: string) => void;
}) {
  const { updateClip, updateCaptions, setClipStatus } = useStore();
  const { play } = usePlayer();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clip) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [clip, onClose]);

  if (!clip) return null;

  const viral = viralReport(clip);
  const isLive = source?.platform === "twitch";
  const updateEdit = (patch: Partial<EditRecipe>) => updateClip(clip.id, { edit: { ...clip.edit, ...patch } });
  const boost = () => updateClip(clip.id, { edit: recommendedEdit(clip) });

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-label={`Cut: ${clip.title}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet__head">
          <div>
            <p className="sheet__eyebrow">
              {source?.channel} · <span className="mono">{timecode(clip.startSec)}</span>
            </p>
            <h2>Cut details</h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <CloseIcon size={18} />
          </IconButton>
        </header>

        <div className="sheet__scroll">
          <div className="sheet__preview">
            {clip.videoPath ? (
              <button
                type="button"
                className="preview preview--video preview--watchable"
                onClick={() => play(clip, source)}
                aria-label={`Play ${clip.title}`}
              >
                <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} />
                <span className="preview__play">
                  <PlayIcon size={22} />
                </span>
                <span className="preview__badge">rendered · 1080 × 1920</span>
                <span className={cx("preview__badge preview__badge--viral", viral.score >= 85 && "is-hot")}>
                  viral {viral.score}
                </span>
              </button>
            ) : (
              <div className={cx("preview", `preview--${clip.subtitleStyle}`)}>
                <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} />
                <div className="clip__grade" style={{ background: clip.tint }} />
                <span className="preview__safe" />
                <span className="preview__caption">{clip.captions[0]?.text ?? clip.hook}</span>
                <span className="preview__caption preview__caption--second">
                  {clip.captions[1]?.text ?? ""}
                </span>
                <span className={cx("preview__badge preview__badge--viral", viral.score >= 85 && "is-hot")}>
                  viral {viral.score}
                </span>
              </div>
            )}

            <div className="sheet__side">
              <ScoreBadge score={clip.score} />
              <div className="sheet__facts">
                <span>
                  Length <b>{(clip.endSec - clip.startSec).toString()}s</b>
                </span>
                <span>
                  Window{" "}
                  <b className="mono">
                    {timecode(clip.startSec)}–{timecode(clip.endSec)}
                  </b>
                </span>
                <span>
                  Crop <b>{clip.crop === "auto" ? "Auto-follow" : clip.crop === "facecam" ? "Facecam" : "Gameplay"}</b>
                </span>
                <span>
                  Pacing <b>{clip.edit.pacing === "match" ? "Source rhythm" : clip.edit.pacing === "fast" ? "Fast" : "Cinematic"}</b>
                </span>
              </div>
              {clip.chatSpike ? (
                <Chip tone="live">
                  <BoltIcon size={13} />
                  Chat peak {Math.round(clip.spikePeak * 100)}%
                </Chip>
              ) : (
                <Chip>Audio peak {Math.round(clip.spikePeak * 100)}%</Chip>
              )}
              <p className="sheet__hint">
                Offcut picked the loudest laugh and the cleanest payoff. Adjust the edit, then mark it ready.
              </p>
            </div>
          </div>

          <section className="viral">
            <div className="viral__head">
              <div>
                <span className="field__label">Viral pass</span>
                <p className="viral__lede">Scored for the swipe, not for the highlight reel.</p>
              </div>
              <div className="viral__score">
                <span className={cx("viral__num", viral.score >= 85 && "is-hot")}>{viral.score}</span>
                <span className="viral__den">/100</span>
              </div>
            </div>

            <div className="viral__parts">
              {[
                { label: "Hook", value: viral.parts.hook },
                { label: "Pacing", value: viral.parts.pacing },
                { label: "Loop", value: viral.parts.loop },
                { label: "Clarity", value: viral.parts.clarity },
              ].map((part) => (
                <div className="viral__part" key={part.label}>
                  <span className="viral__part-top">
                    <span>{part.label}</span>
                    <span className="mono">{part.value}</span>
                  </span>
                  <span className="viral__bar">
                    <span style={{ width: `${part.value}%` }} />
                  </span>
                </div>
              ))}
            </div>

            <ul className="viral__notes">
              {viral.notes.map((note) => (
                <li className="viral__note" key={note}>
                  <SparkIcon size={12} />
                  {note}
                </li>
              ))}
            </ul>

            <div className="viral__group">
              <span className="field__label">Hook on screen</span>
              {viral.hooks.map((hook) => (
                <button
                  key={hook}
                  type="button"
                  className={cx("viral__option", clip.hook === hook && "is-on")}
                  aria-pressed={clip.hook === hook}
                  onClick={() => updateClip(clip.id, { hook })}
                >
                  {hook}
                </button>
              ))}
            </div>

            <div className="viral__group">
              <span className="field__label">Title</span>
              {viral.titles.map((title) => (
                <button
                  key={title}
                  type="button"
                  className={cx("viral__option viral__option--title", clip.title === title && "is-on")}
                  aria-pressed={clip.title === title}
                  onClick={() => updateClip(clip.id, { title })}
                >
                  {title}
                </button>
              ))}
            </div>

            <div className="viral__tags">
              <span className="field__hint">Suggested tags</span>
              <div>
                {viral.hashtags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="edit">
            <div className="edit__head">
              <div>
                <span className="field__label">Edit recipe</span>
                <p className="edit__lede">
                  {isLive
                    ? "Matched to a live stream: punchy cuts, chat-timed payoffs, no intro."
                    : "Matched to a long-form video: keeps its rhythm, trims the setup."}
                </p>
              </div>
              <Button variant="primary" size="sm" icon={<SparkIcon size={14} />} onClick={boost}>
                Make it more viral
              </Button>
            </div>

            <Segmented
              label="Pacing"
              options={PACING}
              value={clip.edit.pacing}
              onChange={(value) => updateEdit({ pacing: value })}
            />

            <div className="edit-list">
              {EDIT_FIELDS.map((field) => (
                <div className="edit-row" key={field.key}>
                  <div>
                    <strong>{field.label}</strong>
                    <span>{field.detail}</span>
                  </div>
                  <Toggle
                    label={field.label}
                    checked={clip.edit[field.key]}
                    onChange={(next) => updateEdit({ [field.key]: next })}
                  />
                </div>
              ))}
              <div className="edit-row">
                <div>
                  <strong>Music bed</strong>
                  <span>Ducked under the voice, never over the laugh</span>
                </div>
                <Toggle
                  label="Music bed"
                  checked={clip.edit.music !== "none"}
                  onChange={(next) => updateEdit({ music: next ? "duck" : "none" })}
                />
              </div>
            </div>
          </section>

          <div className="sheet__form">
            <label className="field">
              <span className="field__label">Title</span>
              <input
                className="input"
                value={clip.title}
                onChange={(event) => updateClip(clip.id, { title: event.target.value })}
              />
            </label>

            <label className="field">
              <span className="field__label">Hook on screen</span>
              <input
                className="input"
                value={clip.hook}
                onChange={(event) => updateClip(clip.id, { hook: event.target.value })}
              />
            </label>

            <div className="field">
              <span className="field__label">Subtitles</span>
              <Segmented
                label="Subtitle style"
                options={STYLES}
                value={clip.subtitleStyle}
                onChange={(value) => updateClip(clip.id, { subtitleStyle: value })}
              />
            </div>

            <div className="field">
              <span className="field__label">
                <CropIcon size={14} /> Vertical crop
              </span>
              <Segmented
                label="Crop mode"
                options={CROPS}
                value={clip.crop}
                onChange={(value) => updateClip(clip.id, { crop: value })}
              />
            </div>

            <div className="transcript">
              <div className="transcript__head">
                <span className="field__label">Transcript</span>
                <span className="field__hint">lines from the source's captions</span>
              </div>
              {clip.captions.map((caption, index) => (
                <div className="transcript__row" key={`${clip.id}-${index}`}>
                  <span className="mono transcript__time">{timecode(caption.t, true)}</span>
                  <input
                    className="input input--flat"
                    value={caption.text}
                    aria-label={`Caption line ${index + 1}`}
                    onChange={(event) => {
                      const next = clip.captions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, text: event.target.value } : item,
                      );
                      updateCaptions(clip.id, next);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="sheet__foot">
          <Button variant="ghost" onClick={onClose}>
            Back to the grid
          </Button>
          {clip.videoPath ? (
            <>
              <Button variant="ink" icon={<PlayIcon size={15} />} onClick={() => play(clip, source)}>
                Watch
              </Button>
              <Button variant="ghost" onClick={() => void bridge?.reveal(clip.videoPath)}>
                Show file
              </Button>
            </>
          ) : null}
          {clip.status === "ready" ? (
            <Button variant="primary" iconRight={<ArrowRightIcon size={17} />} onClick={() => onSendToPublish(clip.id)}>
              Send to export
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                setClipStatus(clip.id, "ready");
                onSendToPublish(clip.id);
              }}
            >
              Mark ready and export
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
