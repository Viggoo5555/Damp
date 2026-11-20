import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipRequest, HardwareProfile, Screen } from "./types";
import { detectHardware } from "./lib/hardware";
import type { BrowseItem } from "./lib/library";
import { StoreProvider, useStore } from "./store";
import { Shell } from "./components/Shell";
import { PlayerHost } from "./components/Player";
import { Setup } from "./screens/Setup";
import { Browse } from "./screens/Browse";
import { Studio } from "./screens/Studio";
import { Export } from "./screens/Export";
import { Library } from "./screens/Library";

function Boot() {
  return (
    <div className="boot">
      <div className="boot__mark">
        <svg width="42" height="42" viewBox="0 0 26 26" aria-hidden="true">
          <path d="M4 4h9l9 9v9h-9L4 13V4Z" fill="currentColor" opacity="0.9" />
          <path d="M13 13h9L13 4v9Z" fill="#cdf25b" />
        </svg>
      </div>
      <h1>Offcut</h1>
      <p>
        <span className="spinner" />
        Reading your hardware
      </p>
    </div>
  );
}

function Workspace() {
  const { state } = useStore();
  const [screen, setScreen] = useState<Screen>("studio");
  const [focusClipId, setFocusClipId] = useState<string | null>(null);
  const [clipRequest, setClipRequest] = useState<ClipRequest | null>(null);
  const nonce = useRef(0);

  const navigate = (next: Screen) => {
    if (next !== "export") setFocusClipId(null);
    setScreen(next);
  };

  const clearRequest = useCallback(() => setClipRequest(null), []);

  const startFromBrowse = (item: BrowseItem) => {
    nonce.current += 1;
    setClipRequest({
      url: item.url,
      platform: item.platform,
      nonce: nonce.current,
      title: item.title,
      channel: item.channel,
      poster: item.poster,
      posterPosition: item.posterPosition,
    });
    setFocusClipId(null);
    setScreen("studio");
  };

  if (!state.setupComplete) return <Setup />;

  return (
    <PlayerHost>
    <Shell screen={screen} onNavigate={navigate}>
      {screen === "browse" ? <Browse onClip={startFromBrowse} /> : null}
      {screen === "studio" ? (
        <Studio
          request={clipRequest}
          onRequestHandled={clearRequest}
          onFocusClip={(clipId) => {
            setFocusClipId(clipId);
            setScreen("export");
          }}
        />
      ) : null}
      {screen === "export" ? <Export onNavigate={navigate} focusClipId={focusClipId} /> : null}
      {screen === "library" ? <Library onNavigate={navigate} /> : null}
    </Shell>
    </PlayerHost>
  );
}

export default function App() {
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);

  useEffect(() => {
    let mounted = true;
    detectHardware()
      .then((profile) => {
        if (mounted) setHardware(profile);
      })
      .catch(() => {
        if (mounted) {
          setHardware({
            os: "Your machine",
            cpu: "CPU",
            threads: 8,
            memoryGb: 16,
            gpuName: "Integrated graphics",
            gpuVendor: "unknown",
            vramGb: 8,
            webgpu: false,
            tier: "balanced",
            source: "detected",
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!hardware) return <Boot />;

  return (
    <StoreProvider hardware={hardware}>
      <Workspace />
    </StoreProvider>
  );
}
