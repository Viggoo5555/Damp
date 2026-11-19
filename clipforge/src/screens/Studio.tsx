import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Clip, ClipRequest, Platform } from "../types";
import { useStore } from "../store";
import {
  PIPELINE_STEPS,
  generateSource,
  viralReport,
  type GeneratedSource,
  type GeneratedSourceMeta,
} from "../lib/engine";
import { detectPlatform, cx, duration } from "../lib/util";
import { ClipCard } from "../components/ClipCard";
import { ClipSheet } from "../components/ClipSheet";
import { ChatSpikes } from "../components/Charts";
import { Button, Chip, ProgressBar, Segmented, Surface } from "../components/ui";
import {
  BoltIcon,
  CheckIcon,
  CloseIcon,
  ScissorsIcon,
  SparkIcon,
  TwitchMark,
  YoutubeMark,
} from "../components/Icons";

interface RunState {
  platform: Platform;
  steps: Array<{ id: string; label: string; detail: string; durationMs: number }>;
  generated: GeneratedSource;
  index: number;
  progress: number;
  done: boolean;
}

type SortMode = "score" | "spike" | "viral";

export function Studio({
  onFocusClip,
  request,
  onRequestHandled,
}: {
  onFocusClip: (clipId: string) => void;
  request: ClipRequest | null;
  onRequestHandled: () => void;
}) {
  const { state, commitSource } = useStore();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [sort, setSort] = useState<SortMode>("score");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dismissedRun, setDismissedRun] = useState(false);
  const committed = useRef<string | null>(null);

  const platform = detectPlatform(url);
  const isRunning = Boolean(run && !run.done);

  useEffect(() => {
    if (!run || run.done) return;
    const timer = window.setInterval(() => {
      setRun((current) => {
        if (!current || current.done) return current;
        const step = current.steps[current.index];
        const progress = current.progress + (100 * 120) / step.durationMs;
        if (progress < 100) return { ...current, progress };
        if (current.index < current.steps.length - 1) {
          return { ...current, index: current.index + 1, progress: 0 };
        }
        return { ...current, progress: 100, done: true };
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [run?.index, run?.done]);

  useEffect(() => {
    if (!run?.done) return;
    if (committed.current === run.generated.source.id) return;
    committed.current = run.generated.source.id;
    commitSource(run.generated.source, run.generated.clips, run.generated.chat);
  }, [run?.done, run, commitSource]);

  const clips = useMemo(() => {
    const sorted = [...state.clips];
    if (sort === "score") sorted.sort((a, b) => b.score - a.score);
    else if (sort === "viral") sorted.sort((a, b) => viralReport(b).score - viralReport(a).score);
    else
      sorted.sort((a, b) => {
        if (a.chatSpike !== b.chatSpike) return a.chatSpike ? -1 : 1;
        return b.spikePeak - a.spikePeak;
      });
    return sorted;
  }, [state.clips, sort]);

  const openClip: Clip | undefined = state.clips.find((clip) => clip.id === openId);
  const openSource = state.sources.find((source) => source.id === openClip?.sourceId);

  const beginRun = useCallback(
    (rawUrl: string, meta?: GeneratedSourceMeta) => {
      const detected = detectPlatform(rawUrl);
      if (!detected) {
        setError("That link isn't YouTube or Twitch. Try a watch or VOD URL.");
        return;
      }
      setError(null);
      setDismissedRun(false);
      setUrl(rawUrl.trim());
      const generated = generateSource(rawUrl.trim(), detected, state.sources.length, meta);
      const steps = PIPELINE_STEPS.filter((step) => detected === "twitch" || step.id !== "chat").map(
        (step) => ({
          ...step,
          durationMs: step.id === "render" ? 1100 : 700 + Math.random() * 700,
        }),
      );
      committed.current = null;
      setRun({ platform: detected, steps, generated, index: 0, progress: 0, done: false });
    },
    [state.sources.length],
  );

  const start = (event: FormEvent) => {
    event.preventDefault();
    beginRun(url);
  };

  // A pick from Browse arrives here and starts right away.
  const handledRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!request || handledRequest.current === request.nonce) return;
    handledRequest.current = request.nonce;
    beginRun(request.url, {
      title: request.title,
      channel: request.channel,
      durationSec: request.durationSec,
      poster: request.poster,
      posterPosition: request.posterPosition,
    });
    onRequestHandled();
  }, [request, beginRun, onRequestHandled]);

  const chat = run?.generated.chat ?? [];
  const chatPeaks = useMemo(() => {
    if (!chat.length) return [];
    return chat
      .map((value, index) => ({ at: index, value, label: "chat spike" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [chat]);

  const showDoneBanner = run?.done && !dismissedRun;

  return (
    <div className="studio">
      <Surface className="composer">
        <div className="composer__label">
          <span>Source link</span>
          <div className="composer__targets">
            <Chip tone={platform === "youtube" ? "ready" : "neutral"}>
              <YoutubeMark size={14} />
              YouTube
            </Chip>
            <Chip tone={platform === "twitch" ? "ready" : "neutral"}>
              <TwitchMark size={14} />
              Twitch
            </Chip>
          </div>
        </div>

        <form className="composer__row" onSubmit={start}>
          <label className="composer__field" htmlFor="source-url">
            <span className="composer__glyph">
              {platform === "twitch" ? (
                <TwitchMark size={20} />
              ) : platform === "youtube" ? (
                <YoutubeMark size={22} />
              ) : (
                <SparkIcon size={20} />
              )}
            </span>
            <input
              id="source-url"
              className="composer__input"
              placeholder="https://youtube.com/watch?v=… or twitch.tv/videos/…"
              value={url}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError(null);
              }}
              aria-describedby="source-hint"
            />
            {url ? (
              <button
                type="button"
                className="composer__clear"
                aria-label="Clear link"
                onClick={() => {
                  setUrl("");
                  setError(null);
                }}
              >
                <CloseIcon size={15} />
              </button>
            ) : null}
          </label>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!url.trim() || isRunning}
            icon={<ScissorsIcon size={18} />}
          >
            Find the funny bits
          </Button>
        </form>

        <div className="composer__foot">
          <p id="source-hint" className={cx("composer__hint", error && "is-error")} role={error ? "alert" : undefined}>
            {error ??
              (platform === "twitch"
                ? "Twitch sources also read chat velocity, so bursts of messages mark the moments worth cutting."
                : "YouTube sources use the audio track and transcript. No API key, no upload.")}
          </p>
          <div className="composer__recent">
            {state.sources.slice(0, 3).map((source) => (
              <button
                key={source.id}
                type="button"
                className="source-chip"
                onClick={() => setUrl(source.url)}
                disabled={isRunning}
              >
                {source.platform === "twitch" ? <TwitchMark size={13} /> : <YoutubeMark size={14} />}
                {source.title.length > 34 ? `${source.title.slice(0, 34)}…` : source.title}
              </button>
            ))}
          </div>
        </div>
      </Surface>

      {run && !run.done ? (
        <Surface className="run">
          <div className="run__main">
            <header className="run__head">
              <div>
                <span className="run__kicker">
                  {run.platform === "twitch" ? <TwitchMark size={14} /> : <YoutubeMark size={15} />}
                  {run.generated.source.channel} · {duration(run.generated.source.durationSec)}
                </span>
                <h2>{run.generated.source.title}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setRun(null)}>
                Cancel
              </Button>
            </header>

            <ol className="steps">
              {run.steps.map((step, index) => {
                const done = index < run.index;
                const active = index === run.index;
                return (
                  <li
                    key={step.id}
                    className={cx("step", done && "is-done", active && "is-active")}
                    aria-current={active ? "step" : undefined}
                  >
                    <span className="step__mark">
                      {done ? <CheckIcon size={15} /> : active ? <span className="spinner" /> : null}
                    </span>
                    <div className="step__body">
                      <div className="step__line">
                        <span className="step__label">{step.label}</span>
                        <span className="step__meta mono">
                          {done ? "done" : active ? `${Math.round(run.progress)}%` : "queued"}
                        </span>
                      </div>
                      <span className="step__detail">{step.detail}</span>
                      {active ? <ProgressBar value={run.progress} tone="lime" label={step.label} /> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className={cx("run__aside", run.platform !== "twitch" && "run__aside--quiet")}>
            {run.platform === "twitch" ? (
              <>
                <div className="run__aside-head">
                  <span className="field__label">Chat velocity</span>
                  <Chip tone="live">
                    <BoltIcon size={12} />
                    live signal
                  </Chip>
                </div>
                <ChatSpikes data={chat} peaks={chatPeaks.map((peak) => ({ at: peak.at, label: peak.label }))} />
                <div className="run__aside-foot">
                  <span>
                    Peak <b>×{(chatPeaks[0]?.value ?? 0) / 22 | 0}</b> baseline
                  </span>
                  <span className="mono">msgs / 10s</span>
                </div>
                <p className="run__aside-note">
                  Three bursts cleared the baseline. Those windows get a scoring bonus and a spike badge.
                </p>
              </>
            ) : (
              <>
                <div className="run__aside-head">
                  <span className="field__label">Audio energy</span>
                  <Chip>laugh detection</Chip>
                </div>
                <ChatSpikes data={chat.length ? chat : [18, 20, 26, 22, 30, 28, 36, 24, 20, 18, 16, 22]} peaks={[]} />
                <div className="run__aside-foot">
                  <span>Room tone removed</span>
                  <span className="mono">−42 dB</span>
                </div>
                <p className="run__aside-note">
                  YouTube sources are scored on laughter, speech density and the shape of the hook.
                </p>
              </>
            )}
            <div className="run__ticks">
              <span className="mono">GPU {state.hardware.vramGb} GB</span>
              <span className="mono">batch 4</span>
              <span className="mono">local</span>
            </div>
          </aside>
        </Surface>
      ) : null}

      {showDoneBanner && run ? (
        <Surface className="run-done">
          <span className="run-done__icon">
            <CheckIcon size={18} />
          </span>
          <div>
            <strong>
              {run.generated.clips.length} cuts from {run.generated.source.channel}
            </strong>
            <p>
              Median length{" "}
              {Math.round(
                run.generated.clips.reduce((total, clip) => total + (clip.endSec - clip.startSec), 0) /
                  run.generated.clips.length,
              )}
              s · {run.generated.clips.filter((clip) => clip.chatSpike).length} chat spikes · scored, cropped and
              captioned
            </p>
          </div>
          <div className="run-done__actions">
            <Button variant="ink" size="sm" onClick={() => setDismissedRun(true)}>
              View cuts
            </Button>
          </div>
        </Surface>
      ) : null}

      <div className="section-head">
        <div>
          <h2>Cuts</h2>
          <p>
            {state.clips.length} clips on this machine, sorted by{" "}
            {sort === "score" ? "score" : sort === "viral" ? "viral potential" : "chat signal"}.
          </p>
        </div>
        <Segmented
          label="Sort cuts"
          value={sort}
          onChange={(value) => setSort(value)}
          options={[
            { value: "score", label: "Best score" },
            { value: "viral", label: "Most viral" },
            { value: "spike", label: "Chat spikes" },
          ]}
        />
      </div>

      <div className="clip-grid">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            source={state.sources.find((source) => source.id === clip.sourceId)}
            onOpen={() => setOpenId(clip.id)}
          />
        ))}
      </div>

      <ClipSheet
        clip={openClip ?? null}
        source={openSource}
        onClose={() => setOpenId(null)}
        onSendToPublish={(clipId) => {
          setOpenId(null);
          onFocusClip(clipId);
        }}
      />
    </div>
  );
}
