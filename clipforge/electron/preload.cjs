const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("offcut", {
  isDesktop: true,
  platform: process.platform,

  tools: () => ipcRenderer.invoke("offcut:tools"),
  installTools: () => ipcRenderer.invoke("offcut:install-tools"),

  run: (payload) => ipcRenderer.invoke("offcut:run", payload),
  cancel: () => ipcRenderer.invoke("offcut:cancel"),
  pause: () => ipcRenderer.invoke("offcut:pause"),
  resume: () => ipcRenderer.invoke("offcut:resume"),
  jobState: () => ipcRenderer.invoke("offcut:job-state"),

  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("offcut:progress", handler);
    return () => ipcRenderer.removeListener("offcut:progress", handler);
  },

  onJobState: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("offcut:job", handler);
    return () => ipcRenderer.removeListener("offcut:job", handler);
  },

  reveal: (target) => ipcRenderer.invoke("offcut:reveal", target),
  copyText: (text) => ipcRenderer.invoke("offcut:copy", text),
  clipsDir: () => ipcRenderer.invoke("offcut:clips-dir"),
});
