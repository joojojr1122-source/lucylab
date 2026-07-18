const { app, BrowserWindow, ipcMain } = require("electron");
const isDev = require("electron-is-dev");
const path = require("node:path");
const fs = require("node:fs");
const { VirtualCamera } = require("./virtualCamera");

let virtualCam = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // The web app uses camera + WebRTC directly; no node integration in page.
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  virtualCam = new VirtualCamera(win);

  if (isDev) {
    // Vite dev server. Set PUBLIC_SERVER_URL base to reach your API server.
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Packaged: web app copied into resources/web via extraResources.
    const resourceWeb = path.join(process.resourcesPath, "web", "index.html");
    const localWeb = path.join(__dirname, "../../web/dist/index.html");
    const target = fs.existsSync(resourceWeb) ? resourceWeb : localWeb;
    win.loadFile(target);
  }

  // Required for camera/mic permissions in a packaged app.
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media" || permission === "camera" || permission === "microphone") {
      callback(true);
    } else {
      callback(false);
    }
  });
}

// Virtual camera IPC bridge (drives OBS Virtual Camera).
ipcMain.handle("vc:start", async () => (virtualCam ? virtualCam.start() : { ok: false }));
ipcMain.handle("vc:stop", async () => (virtualCam ? virtualCam.stop() : { ok: true }));
ipcMain.handle("vc:status", async () => (virtualCam ? virtualCam.status() : { connected: false }));
ipcMain.handle("vc:connect", async (_e, url, password) =>
  virtualCam ? virtualCam.connect(url, password) : { ok: false }
);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => virtualCam?.dispose());
