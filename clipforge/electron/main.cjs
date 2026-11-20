const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  Notification,
  clipboard,
  protocol,
  net,
  shell,
  ipcMain,
  nativeImage,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { Readable } = require("node:stream");
const { pathToFileURL } = require("node:url");
const engine = require("./engine.cjs");

// Set ELECTRON_START_URL=http://localhost:3000 to point the window at the Vite dev server.
const devUrl = process.env.ELECTRON_START_URL;
const distDir = path.join(__dirname, "..", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".webm": "video/webm",
  ".ass": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
};

let clipsDir = "";
let workDir = "";
let binDir = "";
let fontSource = "";
let jobRunning = false;
let jobCancelled = false;
let jobPaused = false;
let quitRequested = false;
let win = null;
let tray = null;
const childProcesses = new Set();
const pauseWaiters = [];

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  {
    scheme: "offcut-media",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

function showWindow() {
  if (!win || win.isDestroyed()) {
    win = createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  const created = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    title: "Offcut",
    backgroundColor: "#e8ecf3",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  created.once("ready-to-show", () => created.show());

  // Closing the window only hides it: a run keeps going in the tray.
  created.on("close", (event) => {
    if (quitRequested) return;
    event.preventDefault();
    created.hide();
  });

  if (devUrl) {
    created.loadURL(devUrl);
  } else {
    created.loadURL("app://offcut/index.html");
  }

  // Anything that wants to leave the app opens in the real browser instead.
  created.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  created.webContents.on("will-navigate", (event, url) => {
    const isLocal = url.startsWith("app://") || url.startsWith("offcut-media://") || (devUrl && url.startsWith(devUrl));
    if (!isLocal) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  return created;
}

/* ------------------------------------------------------------------ */
/* Tray + pause                                                        */
/* ------------------------------------------------------------------ */

function jobState() {
  return { running: jobRunning, paused: jobRunning && jobPaused };
}

function broadcastJobState() {
  const state = jobState();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send("offcut:job", state);
  }
  refreshTray();
}

function setPaused(next) {
  if (!jobRunning || jobPaused === next) return jobState();
  jobPaused = next;
  if (!jobPaused) {
    for (const resolve of pauseWaiters.splice(0)) resolve();
  }
  broadcastJobState();
  return jobState();
}

/**
 * Resolved unless the run is paused. The engine awaits this between pipeline
 * checkpoints, so pausing never throws away the work already done.
 */
function waitWhilePaused() {
  if (!jobPaused) return Promise.resolve();
  return new Promise((resolve) => pauseWaiters.push(resolve));
}

function refreshTray() {
  if (!tray) return;
  const running = jobRunning;
  tray.setToolTip(running ? (jobPaused ? "Offcut — run paused" : "Offcut — working") : "Offcut");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Offcut", click: showWindow },
      { type: "separator" },
      {
        label: !running ? "Nothing is rendering" : jobPaused ? "Resume the run" : "Pause the run",
        enabled: running,
        click: () => setPaused(!jobPaused),
      },
      {
        label: "Stop the run",
        visible: running,
        click: () => {
          jobCancelled = true;
          jobPaused = false;
          for (const resolve of pauseWaiters.splice(0)) resolve();
          killJob();
          broadcastJobState();
        },
      },
      { type: "separator" },
      {
        label: "Quit Offcut",
        click: () => {
          quitRequested = true;
          app.quit();
        },
      },
    ]),
  );
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "tray.png");
  let image = null;
  try {
    image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) image = null;
  } catch {
    image = null;
  }
  if (!image) return;

  tray = new Tray(image);
  tray.setToolTip("Offcut");
  tray.on("click", showWindow);
  tray.on("double-click", showWindow);
  refreshTray();
}

function notify(message) {
  if (!Notification.isSupported()) return;
  if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) return;
  const note = new Notification({ title: "Offcut", body: message });
  note.on("click", showWindow);
  note.show();
}

/* ------------------------------------------------------------------ */
/* Media protocol                                                      */
/* ------------------------------------------------------------------ */

/** Serves rendered clips and their thumbnails, with byte ranges so <video> can seek. */
async function serveMedia(request) {
  let target = "";
  try {
    // The renderer encodes the absolute path as a single path segment.
    target = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ""));
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!target) return new Response("Not found", { status: 404 });

  const resolved = path.resolve(target);
  if (!clipsDir || !(resolved === clipsDir || resolved.startsWith(clipsDir + path.sep))) {
    return new Response("Not found", { status: 404 });
  }

  let stat;
  try {
    stat = await fsp.stat(resolved);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("Not found", { status: 404 });

  const type = MIME[path.extname(resolved).toLowerCase()] || "application/octet-stream";
  const range = request.headers.get("range");
  const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;

  if (match) {
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : stat.size - 1;
    if (!Number.isFinite(start) || start < 0) start = 0;
    if (!Number.isFinite(end) || end >= stat.size) end = stat.size - 1;
    if (start > end) {
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "content-range": `bytes */${stat.size}` },
      });
    }
    const stream = fs.createReadStream(resolved, { start, end });
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: {
        "content-type": type,
        "content-length": String(end - start + 1),
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "accept-ranges": "bytes",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(Readable.toWeb(fs.createReadStream(resolved)), {
    status: 200,
    headers: {
      "content-type": type,
      "content-length": String(stat.size),
      "accept-ranges": "bytes",
      "cache-control": "no-store",
    },
  });
}

/* ------------------------------------------------------------------ */
/* Job plumbing                                                        */
/* ------------------------------------------------------------------ */

function killJob() {
  for (const child of childProcesses) {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
  childProcesses.clear();
}

function registerChild(child) {
  childProcesses.add(child);
  child.on("close", () => childProcesses.delete(child));
  child.on("error", () => childProcesses.delete(child));
}

function registerIpc() {
  ipcMain.handle("offcut:clips-dir", () => clipsDir);

  ipcMain.handle("offcut:copy", (_event, text) => {
    clipboard.writeText(String(text ?? ""));
    return { ok: true };
  });

  ipcMain.handle("offcut:tools", async () => {
    const status = engine.checkTools({ binDir });
    return { ...status, platform: process.platform };
  });

  ipcMain.handle("offcut:install-tools", async (event) => {
    try {
      const tools = await engine.ensureTools({
        binDir,
        onProgress: (data) => event.sender.send("offcut:progress", data),
      });
      return { ok: true, tools: { ffmpeg: tools.ffmpeg, ytdlp: tools.ytdlp } };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle("offcut:run", async (event, payload) => {
    if (jobRunning) return { ok: false, error: "A run is already in progress." };
    jobRunning = true;
    jobPaused = false;
    jobCancelled = false;
    broadcastJobState();

    const emit = (data) => {
      if (!event.sender.isDestroyed()) event.sender.send("offcut:progress", data);
    };

    try {
      await fsp.rm(workDir, { recursive: true, force: true });
      await fsp.mkdir(workDir, { recursive: true });
      await fsp.mkdir(clipsDir, { recursive: true });

      emit({ stage: "tools", pct: 1, message: "Checking ffmpeg and yt-dlp" });
      const tools = await engine.ensureTools({ binDir, onProgress: emit });
      await waitWhilePaused();

      const result = await engine.runJob({
        input: String(payload?.url || "").trim(),
        tools,
        outDir: clipsDir,
        workDir,
        maxClips: Number(payload?.maxClips) || 5,
        subtitleStyle: payload?.subtitleStyle || "pop",
        fontSource,
        emit,
        register: registerChild,
        waitIfPaused: waitWhilePaused,
      });

      notify(`${result.clips.length} vertical ${result.clips.length === 1 ? "cut" : "cuts"} ready from ${result.meta.channel}.`);
      return { ok: true, result };
    } catch (error) {
      if (!jobCancelled) notify(`That run stopped: ${error.message}`);
      return {
        ok: false,
        error: jobCancelled ? "Cancelled. The half-downloaded work was cleaned up." : error.message,
      };
    } finally {
      jobRunning = false;
      jobPaused = false;
      for (const resolve of pauseWaiters.splice(0)) resolve();
      killJob();
      broadcastJobState();
    }
  });

  ipcMain.handle("offcut:cancel", () => {
    jobCancelled = true;
    jobPaused = false;
    for (const resolve of pauseWaiters.splice(0)) resolve();
    killJob();
    broadcastJobState();
    return { ok: true };
  });

  ipcMain.handle("offcut:pause", () => setPaused(true));
  ipcMain.handle("offcut:resume", () => setPaused(false));
  ipcMain.handle("offcut:job-state", () => jobState());

  ipcMain.handle("offcut:reveal", async (_event, target) => {
    const value = String(target || "");
    if (fs.existsSync(value)) {
      shell.showItemInFolder(value);
      return { ok: true };
    }
    if (fs.existsSync(clipsDir)) shell.openPath(clipsDir);
    return { ok: false };
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(() => {
    clipsDir = path.join(app.getPath("userData"), "clips");
    workDir = path.join(app.getPath("userData"), "work");
    binDir = path.join(app.getPath("userData"), "bin");
    fontSource = path.join(__dirname, "assets", "fonts", "ArchivoBlack-Regular.ttf");

    protocol.handle("app", async (request) => {
      const url = new URL(request.url);
      const requested = decodeURIComponent(url.pathname);
      const relative = requested === "/" || requested === "" ? "index.html" : requested.replace(/^\/+/, "");
      const target = path.join(distDir, relative);

      if (target !== distDir && !target.startsWith(distDir + path.sep)) {
        return new Response("Not found", { status: 404 });
      }

      try {
        const response = await net.fetch(pathToFileURL(target).toString());
        if (!response.ok) return new Response("Not found", { status: 404 });
        const type = MIME[path.extname(target).toLowerCase()];
        const headers = new Headers();
        if (type) headers.set("content-type", type);
        return new Response(response.body, { status: 200, headers });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });

    protocol.handle("offcut-media", serveMedia);

    app.setAppUserModelId("studio.offcut.app");
    Menu.setApplicationMenu(null);
    registerIpc();
    createTray();
    win = createWindow();

    app.on("activate", showWindow);
  });
}

// The tray is the app while a run is going: closing every window must not quit.
app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  quitRequested = true;
  killJob();
});
