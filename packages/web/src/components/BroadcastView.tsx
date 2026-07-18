import { useEffect, useRef, useState } from "react";
import { useLucyBroadcast } from "../hooks/useLucyBroadcast";
import { TransformControls } from "./TransformControls";
import type { CallConfig } from "../hooks/useLucyCall";
import type { useUsage } from "../hooks/useUsage";

export function BroadcastView({
  config,
  onStreamingChange,
  usage,
}: {
  config: CallConfig;
  onStreamingChange?: (streaming: boolean) => void;
  usage: ReturnType<typeof useUsage>;
}) {
  const { transformedStream, rawStream, status, statusDetail, start, stop, applyTransform } =
    useLucyBroadcast(config, onStreamingChange);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [vcActive, setVcActive] = useState(false);
  const [vcNote, setVcNote] = useState<string>();

  useEffect(() => {
    const el = videoRef.current;
    if (el && transformedStream && el.srcObject !== transformedStream) {
      el.srcObject = transformedStream;
    }
  }, [transformedStream]);

  const toggleVirtualCam = async () => {
    if (!window.lucy?.virtualCamera) {
      setVcNote("Virtual camera only available in the desktop app.");
      return;
    }
    setVcNote(undefined);
    if (vcActive) {
      await window.lucy.virtualCamera.stop();
      setVcActive(false);
    } else {
      const r = await window.lucy.virtualCamera.start();
      if (r.ok) setVcActive(true);
      else setVcNote(`Virtual camera needs OBS running with Virtual Camera enabled. (${r.error})`);
    }
  };

  if (!transformedStream) {
    return (
      <div className="broadcast-idle">
        <div className="broadcast-card">
          <h1>Lucy Broadcast</h1>
          <p>Transform your webcam with a Lucy 2.5 avatar or background, then capture this window in OBS.</p>
          <button className="primary" disabled={status === "connecting"} onClick={() => start()}>
            {status === "connecting" ? "Starting…" : "Start broadcast"}
          </button>
          {statusDetail && <span className="err">{statusDetail}</span>}
          <p className="hint">
            In OBS: add a Window Capture source and select this Lucy window, or enable Virtual
            Camera in the desktop app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="broadcast">
      <video ref={videoRef} autoPlay playsInline muted className="broadcast-video" />
      <aside className="broadcast-controls">
        <TransformControls onApply={applyTransform} status={status} />
        <button className={vcActive ? "leave" : "primary"} onClick={toggleVirtualCam}>
          {vcActive ? "Stop virtual camera" : "Start virtual camera"}
        </button>
        {vcNote && <span className="hint">{vcNote}</span>}
        <button className="leave" onClick={stop}>Stop broadcast</button>
      </aside>
    </div>
  );
}
