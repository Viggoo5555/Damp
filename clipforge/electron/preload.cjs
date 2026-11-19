const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("offcut", {
  isDesktop: true,
  platform: process.platform,

  tools: () => ipcRenderer.invoke("offcut:tools"),
  installTools: () => ipcRenderer.invoke("offcut:install-tools"),

  run: (payload) => ipcRenderer.invoke("offcut:run", payload),
  cancel: () => ipcRenderer.invoke("offcut:cancel"),

  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("offcut:progress", handler);
    return () => ipcRenderer.removeListener("offcut:progress", handler);
  },

  reveal: (target) => ipcRenderer.invoke("offcut:reveal", target),
  clipsDir: () => ipcRenderer.invoke("offcut:clips-dir"),
});
