import { useCallback, useEffect, useRef, useState } from "react";
import { LucyRealtime } from "../lucy/LucyRealtime";
import type { CallConfig } from "./useLucyCall";
import type { LucyState } from "@lucy-call/shared";

export function useLucyBroadcast(
  config: CallConfig,
  onStreamingChange?: (streaming: boolean) => void
) {
  const [transformedStream, setTransformedStream] = useState<MediaStream | null>(null);
  const [rawStream, setRawStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [statusDetail, setStatusDetail] = useState<string>();
  const lucyRef = useRef<LucyRealtime | null>(null);
  const rawRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setStatus("connecting");
    try {
      const tracks = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: 1920, height: 1080, frameRate: 30 },
      });
      rawRef.current = tracks;
      setRawStream(tracks);

      const res = await fetch(`${config.publicServerUrl}/api/fal-credentials`, {
        method: "POST",
        credentials: "include",
      });
      const { key } = await res.json();

      const lucy = new LucyRealtime({
        endpoint: config.falEndpoint,
        falKey: key,
        onTransformedStream: (s) => setTransformedStream(s),
        onStatus: (s, d) => {
          setStatus(s as any);
          setStatusDetail(d);
        },
      });
      lucyRef.current = lucy;
      await lucy.connect(tracks, {
        prompt:
          "Keep the person and their motion. Replace the background with a clean professional studio gradient.",
        enhance: true,
      });
      onStreamingChange?.(true);
    } catch (e) {
      setStatus("error");
      setStatusDetail(String(e));
    }
  }, [config]);

  const applyTransform = useCallback((state: LucyState) => {
    lucyRef.current?.set({
      prompt: state.prompt,
      referenceImageUrl: state.referenceImageUrl,
      enhance: state.enhance ?? true,
    });
  }, []);

  const stop = useCallback(() => {
    lucyRef.current?.disconnect();
    lucyRef.current = null;
    rawRef.current?.getTracks().forEach((t) => t.stop());
    rawRef.current = null;
    setRawStream(null);
    setTransformedStream(null);
    setStatus("idle");
    onStreamingChange?.(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { transformedStream, rawStream, status, statusDetail, start, stop, applyTransform };
}
