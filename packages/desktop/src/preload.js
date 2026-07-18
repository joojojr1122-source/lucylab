const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lucy", {
  virtualCamera: {
    start: () => ipcRenderer.invoke("vc:start"),
    stop: () => ipcRenderer.invoke("vc:stop"),
    status: () => ipcRenderer.invoke("vc:status"),
    connect: (url, password) => ipcRenderer.invoke("vc:connect", url, password),
  },
});
