import { useMemo, type ReactNode } from "react";
import type { Screen } from "../types";
import { useStore } from "../store";
import { timecode } from "../lib/util";
import { bridge } from "../lib/desktop";
import { Button, Chip, EmptyState, Surface } from "../components/ui";
import {
  ClockIcon,
  CpuIcon,
  FolderIcon,
  ScissorsIcon,
  SparkIcon,
  TwitchMark,
  YoutubeMark,
} from "../components/Icons";

function Stat({
  label,
  value,
  footnote,
  icon,
}: {
  label: string;
  value: string;
  footnote: string;
  icon: ReactNode;
}) {
  return (
    <Surface className="stat-card">
      <div className="stat-card__head">
        <span className="stat-card__icon">{icon}</span>
        <span className="stat__label">{label}</span>
      </div>
      <strong className="stat-card__value">{value}</strong>
      <div className="stat-card__foot">
        <span>{footnote}</span>
      </div>
    </Surface>
  );
}

function runtimeLabel(seconds: number): string {
  if (seconds <= 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.round(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

export function Library({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { state } = useStore();

  const totals = useMemo(() => {
    const runtime = state.clips.reduce((total, clip) => total + Math.max(0, clip.endSec - clip.startSec), 0);
    const longest = state.clips.reduce((best, clip) => Math.max(best, clip.endSec - clip.startSec), 0);
    return {
      cuts: state.clips.length,
      runtime,
      longest,
      exported: state.clips.filter((clip) => clip.status === "exported").length,
      sources: state.sources.length,
    };
  }, [state.clips, state.sources]);

  const rows = useMemo(
    () =>
      [...state.clips].sort((a, b) => {
        const sourceA = state.sources.find((source) => source.id === a.sourceId)?.addedAt ?? 0;
        const sourceB = state.sources.find((source) => source.id === b.sourceId)?.addedAt ?? 0;
        if (sourceA !== sourceB) return sourceB - sourceA;
        return b.score - a.score;
      }),
    [state.clips, state.sources],
  );

  if (!state.clips.length) {
    return (
      <div className="analytics">
        <Surface className="panel-empty">
          <EmptyState
            icon={<ScissorsIcon size={22} />}
            title="Nothing on this machine yet"
            body="Offcut has no sample library. Paste a YouTube or Twitch link in the studio and the engine will download it, find the spiked moments and render real vertical cuts."
            action={<Button variant="primary" onClick={() => onNavigate("studio")}>Open the studio</Button>}
          />
        </Surface>
      </div>
    );
  }

  return (
    <div className="analytics">
      <div className="section-head">
        <div>
          <h2>This machine</h2>
          <p>
            {totals.cuts} rendered {totals.cuts === 1 ? "cut" : "cuts"} from {totals.sources}{" "}
            {totals.sources === 1 ? "source" : "sources"} · {runtimeLabel(totals.runtime)} of vertical video
          </p>
        </div>
        <div className="section-head__tools">
          <Chip tone="ready">
            <span className="dot" />
            read from local files
          </Chip>
        </div>
      </div>

      <div className="stats">
        <Stat
          label="Rendered cuts"
          value={String(totals.cuts)}
          footnote={`${totals.exported} marked exported`}
          icon={<ScissorsIcon size={17} />}
        />
        <Stat
          label="Total runtime"
          value={runtimeLabel(totals.runtime)}
          footnote="sum of every cut"
          icon={<ClockIcon size={17} />}
        />
        <Stat
          label="Longest cut"
          value={runtimeLabel(totals.longest)}
          footnote="kept short on purpose"
          icon={<SparkIcon size={17} />}
        />
        <Stat label="Resolution" value="1080 × 1920" footnote="h.264 · aac" icon={<CpuIcon size={17} />} />
      </div>

      <Surface className="table-card">
        <div className="card-head">
          <div>
            <h2>Every clip</h2>
            <p>Each row is an mp4 the engine wrote to your clips folder.</p>
          </div>
        </div>

        <div className="table" aria-label="Rendered clips">
          <div className="table__head">
            <span>Clip</span>
            <span>Starts</span>
            <span>Length</span>
            <span>Score</span>
            <span>Added</span>
            <span>File</span>
          </div>
          {rows.map((clip) => {
            const source = state.sources.find((item) => item.id === clip.sourceId);
            return (
              <div className="table__row" key={clip.id}>
                <span className="table__video">
                  <span className="table__thumb">
                    <img src={clip.poster} alt="" style={{ objectPosition: clip.posterPosition }} />
                  </span>
                  <span className="table__titles">
                    <span className="table__title">{clip.title}</span>
                    <span className="table__sub">
                      {source?.platform === "twitch" ? <TwitchMark size={12} /> : <YoutubeMark size={12} />}
                      {source?.channel ?? "unknown source"}
                      <span className="clip__sep">·</span>
                      {clip.status}
                    </span>
                  </span>
                </span>
                <span className="mono">{timecode(clip.startSec)}</span>
                <span className="mono">{Math.round(clip.endSec - clip.startSec)}s</span>
                <span className="mono">{clip.score}</span>
                <span className="mono">
                  {new Date(source?.addedAt ?? Date.now()).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="mono">
                  {clip.videoPath ? (
                    <button type="button" className="link-btn" onClick={() => void bridge?.reveal(clip.videoPath)}>
                      Show
                    </button>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
            );
          })}
        </div>

        <footer className="table-card__foot">
          <span>
            <FolderIcon size={13} /> Files live in the app's clips folder until you delete them.
          </span>
          <span className="mono">no uploads</span>
        </footer>
      </Surface>
    </div>
  );
}
