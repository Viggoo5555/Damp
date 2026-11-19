const { app, BrowserWindow, Menu, protocol, net, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

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
};

// A real origin (instead of file://) so ES modules and localStorage behave.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
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
    },
  });

  win.once("ready-to-show", () => win.show());

  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadURL("app://offcut/index.html");
  }

  // Anything that wants to leave the app opens in the real browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const isLocal = url.startsWith("app://") || (devUrl && url.startsWith(devUrl));
    if (!isLocal) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  return win;
}

app.whenReady().then(() => {
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

  app.setAppUserModelId("studio.offcut.app");
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
