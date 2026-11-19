import { useEffect, useRef, type ReactNode } from "react";
import type { Screen } from "../types";
import { useStore } from "../store";
import { ChartIcon, CompassIcon, CpuIcon, ScissorsIcon, UploadIcon } from "./Icons";
import { Chip } from "./ui";
import { cx } from "../lib/util";

const NAV: Array<{
  id: Screen;
  step: string;
  label: string;
  title: string;
  subtitle: string;
  icon: (props: { size?: number }) => ReactNode;
}> = [
  {
    id: "browse",
    step: "",
    label: "Browse",
    title: "Browse",
    subtitle: "Public streams and uploads, ready to cut.",
    icon: CompassIcon,
  },
  {
    id: "studio",
    step: "01",
    label: "Studio",
    title: "Studio",
    subtitle: "Drop a link, get vertical cuts.",
    icon: ScissorsIcon,
  },
  {
    id: "publish",
    step: "02",
    label: "Publish",
    title: "Publish",
    subtitle: "Write the copy once, send it everywhere.",
    icon: UploadIcon,
  },
  {
    id: "analytics",
    step: "03",
    label: "Performance",
    title: "Performance",
    subtitle: "Views, subscribers and what each cut earned.",
    icon: ChartIcon,
  },
];

export function Shell({
  screen,
  onNavigate,
  children,
}: {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  children: ReactNode;
}) {
  const { state } = useStore();
  const contentRef = useRef<HTMLElement>(null);
  const active = NAV.find((item) => item.id === screen) ?? NAV[0];
  const readyModels = state.models.filter((model) => model.status === "ready").length;
  const readyClips = state.clips.filter((clip) => clip.status === "ready").length;
  const headline = screen === "publish" && readyClips > 0 ? `${readyClips} cuts ready to send` : active.subtitle;

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [screen]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="rail glass" aria-label="Main">
        <button type="button" className="brand" onClick={() => onNavigate("studio")} aria-label="Offcut home">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M4 4h9l9 9v9h-9L4 13V4Z" fill="currentColor" opacity="0.9" />
            <path d="M13 13h9L13 4v9Z" fill="#cdf25b" />
          </svg>
          <span className="brand__name">Offcut</span>
        </button>

        <nav className="rail__nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={cx("rail__item", screen === item.id && "is-active")}
                aria-current={screen === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
                title={item.label}
              >
                <span className={cx("rail__step", !item.step && "rail__step--blank")}>{item.step}</span>
                <span className="rail__icon">
                  <Icon size={21} />
                </span>
                <span className="rail__label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="rail__foot">
          <span className="rail__local">
            <span className="dot" />
            Local
          </span>
          <div className="avatar" aria-label="Channel: kettle">
            K
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar glass">
          <div className="topbar__titles">
            <h1>{active.title}</h1>
            <p>{headline}</p>
          </div>
          <div className="topbar__meta">
            <Chip tone={readyModels === state.models.length ? "ready" : "neutral"}>
              <span className={cx("dot", readyModels !== state.models.length && "dot--idle")} />
              {readyModels}/{state.models.length} models
            </Chip>
            <Chip className="chip--hardware">
              <CpuIcon size={14} />
              {state.hardware.gpuName.length > 26
                ? `${state.hardware.gpuName.slice(0, 26)}…`
                : state.hardware.gpuName}
              <span className="chip__sep">·</span>
              {state.hardware.vramGb} GB
            </Chip>
          </div>
        </header>

        <main className="content" id="main" ref={contentRef}>
          {children}
        </main>
      </div>
    </div>
  );
}
