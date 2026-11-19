import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Clip, ClipRequest, Source } from "../types";
import { useStore } from "../store";
import { PIPELINE_STEPS, TINT_PRESETS, defaultEdit, viralReport } from "../lib/engine";
import { detectPlatform, cx } from "../lib/util";
import {
  bridge,
  isDesktop,
  mediaUrl,
  type EngineResult,
  type JobProgress,
  type ToolStatus,
} from "../lib/desktop";
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

type SortMode = "score" | "spike" | "viral";

function toSource(result: EngineResult, url: string): Source {
  return {
    id: `src-${Date.now().toString(36)}`,
    platform: result.meta.platform === "twitch" ? "twitch" : "youtube",
    url,
    title: result.meta.title,
    channel: result.meta.channel,
    durationSec: Math.round(result.meta.durationSec),
    addedAt: Date.now(),
    clipCount: result.clips.length,
  };
}

function toClips(result: EngineResult, sourceId: string): Clip[] {
  return result.clips.map((clip, index) => ({
    id: clip.id,
    sourceId,
    title: clip.title || `Clip ${index + 1}`,
    hook: clip.hook || "",
    poster: mediaUrl(clip.thumbPath),
    posterPosition: "50% 50%",
    tint: TINT_PRESETS[index % TINT_PRESETS.length],
    startSec: clip.startSec,
    endSec: clip.endSec,
    score: clip.score,
    chatSpike: clip.chatSpike,
    spikePeak: clip.spikePeak,
    captions: clip.captions,
    subtitleStyle: "pop",
    crop: "auto",
    edit: defaultEdit(result.meta.platform === "twitch" ? "twitch" : "youtube", "auto"),
    status: "draft",
    videoPath: clip.videoPath,
    thumbPath: clip.thumbPath,
    peakSec: clip.peakSec,
    hasCaptions: clip.hasCaptions,
  }));
}

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
  const [tools, setTools] = useState<ToolStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [sort, setSort] = useState<SortMode>("score");
  const [openId, setOpenId] = useState<string | null>(null);
  const handledRequest = useRef<number | null>(null);

  const platform = detectPlatform(url);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge.tools().then((status) => {
      if (alive) setTools(status);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!bridge) return;
    return bridge.onProgress((next) => setProgress(next));
  }, []);

  const start = useCallback(async (rawUrl: string) => {
    const detected = detectPlatform(rawUrl);
    if (!detected) {
      setError("That link isn't YouTube or Twitch. Try a watch or VOD URL.");
      return;
    }
    if (!bridge) {
      setError("Clip finding runs inside the desktop app — open Offcut itself to use it.");
      return;
    }
    setError(null);
    setResult(null);
    setRunning(true);
    setProgress({ stage: "tools", pct: 0, message: "Starting" });
    try {
      const response = await bridge.run({ url: rawUrl.trim(), maxClips: 5, subtitleStyle: "pop" });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      const source = toSource(response.result, rawUrl.trim());
      commitSource(source, toClips(response.result, source.id), response.result.chatSeries);
      setResult(response.result);
      setTools((current) => (current ? { ...current, ready: true } : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  }, [commitSource]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void start(url);
  };

  // A pick from Browse arrives here and starts right away.
  useEffect(() => {
    if (!request || handledRequest.current === request.nonce) return;
    handledRequest.current = request.nonce;
    setUrl(request.url);
    void start(request.url);
    onRequestHandled();
  }, [request, start, onRequestHandled]);

  const installTools = async () => {
    if (!bridge) return;
    setInstalling(true);
    const response = await bridge.installTools();
    setInstalling(false);
    if (!response.ok) {
      setError(response.error ?? "The tools could not be installed.");
      return;
    }
    setTools(await bridge.tools());
  };

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

  const steps = useMemo(
    () => PIPELINE_STEPS.filter((step) => (platform === "youtube" ? step.id !== "chat" : true)),
    [platform],
  );
  const activeStep = progress ? steps.findIndex((step) => step.id === progress.stage) : -1;
  const chat = result?.chatSeries ?? [];
  const chatPeaks = useMemo(() => {
    if (!chat.length) return [];
    return chat
      .map((value, at) => ({ at, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .sort((a, b) => a.at - b.at);
  }, [chat]);

  const needsTools = Boolean(bridge) && tools !== null && !tools.ready;

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

        <form className="composer__row" onSubmit={submit}>
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
            disabled={!url.trim() || running || !isDesktop}
            icon={<ScissorsIcon size={18} />}
          >
            Find the funny bits
          </Button>
        </form>

        <div className="composer__foot">
          <p id="source-hint" className={cx("composer__hint", error && "is-error")} role={error ? "alert" : undefined}>
            {error ??
              (isDesktop
                ? "Downloads the real video, measures the audio, cuts vertical clips and burns the real captions. Nothing leaves this machine except the download itself."
                : "You're viewing the browser preview. Clip finding needs the desktop app — the engine lives in the Electron process.")}
          </p>
          <div className="composer__recent">
            {state.sources.slice(0, 3).map((source) => (
              <button
                key={source.id}
                type="button"
                className="source-chip"
                onClick={() => setUrl(source.url)}
                disabled={running}
              >
                {source.platform === "twitch" ? <TwitchMark size={13} /> : <YoutubeMark size={14} />}
                {source.title.length > 34 ? `${source.title.slice(0, 34)}…` : source.title}
              </button>
            ))}
          </div>
        </div>
      </Surface>

      {needsTools ? (
        <Surface className="run-done">
          <span className="run-done__icon">
            <SparkIcon size={18} />
          </span>
          <div>
            <strong>ffmpeg and yt-dlp are needed once</strong>
            <p>
              They do the downloading and cutting. About 150 MB, downloaded from their official builds, kept in this
              app's data folder.
            </p>
          </div>
          <div className="run-done__actions">
            <Button variant="primary" size="sm" onClick={() => void installTools()} disabled={installing}>
              {installing ? "Installing…" : "Install tools"}
            </Button>
          </div>
        </Surface>
      ) : null}

      {installing && progress ? (
        <Surface className="run-done">
          <span className="run-done__icon">
            <span className="spinner" />
          </span>
          <div>
            <strong>{progress.message}</strong>
            <p>{Math.round(progress.pct)}%</p>
          </div>
        </Surface>
      ) : null}

      {running ? (
        <Surface className="run">
          <div className="run__main">
            <header className="run__head">
              <div>
                <span className="run__kicker">
                  {platform === "twitch" ? <TwitchMark size={14} /> : <YoutubeMark size={15} />}
                  {progress?.message ?? "Working"}
                </span>
                <h2>{url.trim()}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void bridge?.cancel()}>
                Cancel
              </Button>
            </header>

            <ol className="steps">
              {steps.map((step, index) => {
                const done = index < activeStep || progress?.stage === "done";
                const active = index === activeStep && !done;
                return (
                  <li key={step.id} className={cx("step", done && "is-done", active && "is-active")}>
                    <span className="step__mark">
                      {done ? <CheckIcon size={15} /> : active ? <span className="spinner" /> : null}
                    </span>
                    <div className="step__body">
                      <div className="step__line">
                        <span className="step__label">{step.label}</span>
                        <span className="step__meta mono">
                          {done ? "done" : active ? `${Math.round(progress?.pct ?? 0)}%` : "queued"}
                        </span>
                      </div>
                      <span className="step__detail">{step.detail}</span>
                      {active ? <ProgressBar value={progress?.pct ?? 0} tone="lime" label={step.label} /> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className={cx("run__aside", platform !== "twitch" && "run__aside--quiet")}>
            {platform === "twitch" ? (
              <>
                <div className="run__aside-head">
                  <span className="field__label">VOD chat</span>
                  <Chip tone="live">
                    <BoltIcon size={12} />
                    real messages
                  </Chip>
                </div>
                <ChatSpikes data={chat} peaks={chatPeaks.map((peak) => ({ at: peak.at, label: "chat spike" }))} />
                <div className="run__aside-foot">
                  <span>{result?.chatMessages ?? 0} messages read</span>
                  <span className="mono">10 s buckets</span>
                </div>
              </>
            ) : (
              <>
                <div className="run__aside-head">
                  <span className="field__label">Audio analysis</span>
                  <Chip>ffmpeg</Chip>
                </div>
                <p className="run__aside-note">
                  Every second of the track is measured, then the loudest sustained moments with laugh-shaped speech
                  are scored. This source has captions, so the words weigh in too.
                </p>
                <div className="run__aside-foot">
                  <span>{progress?.message ?? "Measuring"}</span>
                  <span className="mono">{Math.round(progress?.pct ?? 0)}%</span>
                </div>
              </>
            )}
            <div className="run__ticks">
              <span className="mono">local</span>
              <span className="mono">1080 × 1920</span>
              <span className="mono">h.264</span>
            </div>
          </aside>
        </Surface>
      ) : null}

      {error ? (
        <Surface className="run-done">
          <span className="run-done__icon">
            <CloseIcon size={18} />
          </span>
          <div>
            <strong>That run stopped</strong>
            <p>{error}</p>
          </div>
          <div className="run-done__actions">
            <Button variant="ghost" size="sm" onClick={() => void start(url)} disabled={!url.trim()}>
              Try again
            </Button>
          </div>
        </Surface>
      ) : null}

      {result ? (
        <Surface className="run-done">
          <span className="run-done__icon">
            <CheckIcon size={18} />
          </span>
          <div>
            <strong>
              {result.clips.length} cuts from {result.meta.channel}
            </strong>
            <p>
              {result.captionsFound} caption lines · {result.elapsedSec}s of work ·{" "}
              {result.clips.filter((clip) => clip.hook).length} with a spoken hook · files in your clips folder
            </p>
          </div>
          <div className="run-done__actions">
            <Button variant="ink" size="sm" onClick={() => void bridge?.reveal(result.clips[0]?.videoPath)}>
              Show files
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
