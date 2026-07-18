const OBSWebSocket = require("obs-websocket-js");

/**
 * VirtualCamera
 *
 * Feeds the Lucy transformed output into a real virtual camera device that other
 * apps (Zoom, Meet, OBS, etc.) can select, by driving OBS's Virtual Camera.
 *
 * OBS must be installed with the "Virtual Camera" output enabled. We connect over
 * obs-websocket, create a Window Capture source pointed at the Lucy window, and
 * start the virtual camera. If OBS isn't available we report unavailable and the
 * UI falls back to manual OBS Window Capture.
 */
class VirtualCamera {
  constructor(win) {
    this.win = win;
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.sceneName = "LucyVirtualCam";
    this.sourceName = "LucyWindow";
  }

  async connect(url = "ws://127.0.0.1:4455", password = "") {
    try {
      await this.obs.connect(url, password);
      this.connected = true;
      await this.ensureScene();
      return { ok: true };
    } catch (e) {
      this.connected = false;
      return { ok: false, error: String(e?.message || e) };
    }
  }

  async ensureScene() {
    const { scenes } = await this.obs.call("GetSceneList");
    if (!scenes.find((s) => s.sceneName === this.sceneName)) {
      await this.obs.call("CreateScene", { sceneName: this.sceneName });
    }
    const { sceneItems } = await this.obs.call("GetSceneItemList", {
      sceneName: this.sceneName,
    });
    if (!sceneItems.find((i) => i.sourceName === this.sourceName)) {
      const bounds = this.win?.getBounds?.() || { x: 0, y: 0, width: 1280, height: 720 };
      await this.obs.call("CreateInput", {
        sceneName: this.sceneName,
        inputName: this.sourceName,
        inputKind: "window_capture",
        inputSettings: {
          window: `Lucy Call:${bounds.x}:${bounds.y}`,
          capture_cursor: false,
        },
      });
    }
  }

  async start() {
    if (!this.connected) {
      const r = await this.connect();
      if (!r.ok) return r;
    }
    try {
      await this.obs.call("SetCurrentProgramScene", { sceneName: this.sceneName });
      const { outputActive } = await this.obs.call("GetVirtualCamStatus");
      if (!outputActive) {
        await this.obs.call("StartVirtualCam");
      }
      return { ok: true, active: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  async stop() {
    if (!this.connected) return { ok: true };
    try {
      const { outputActive } = await this.obs.call("GetVirtualCamStatus");
      if (outputActive) await this.obs.call("StopVirtualCam");
      return { ok: true, active: false };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  async status() {
    if (!this.connected) return { connected: false, active: false };
    try {
      const { outputActive } = await this.obs.call("GetVirtualCamStatus");
      return { connected: true, active: outputActive };
    } catch {
      return { connected: this.connected, active: false };
    }
  }

  dispose() {
    try {
      this.obs.disconnect();
    } catch {
      /* noop */
    }
  }
}

module.exports = { VirtualCamera };
