import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, createLocalTracks } from "livekit-client";
import { LucyRealtime } from "../lucy/LucyRealtime";
import type { LucyState } from "@lucy-call/shared";

export interface CallConfig {
  falEndpoint: string;
  publicServerUrl: string;
  stripeEnabled: boolean;
  googleEnabled?: boolean;
}

export function useLucyCall(
  config: CallConfig,
  onStreamingChange?: (streaming: boolean) => void
) {
  const [room, setRoom] = useState<Room | null>(null);
  const [transformedStream, setTransformedStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [statusDetail, setStatusDetail] = useState<string>();
  const lucyRef = useRef<LucyRealtime | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const transformedStreamRef = useRef<MediaStream | null>(null);
  const publishOnTransform = useRef<((s: MediaStream) => void) | null>(null);

  const fetchFalKey = useCallback(async () => {
    const res = await fetch(`${config.publicServerUrl}/api/fal-credentials`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    return data.key as string;
  }, [config.publicServerUrl]);

  const join = useCallback(
    async (roomName: string, displayName: string) => {
      setStatus("connecting");
      // 1. Local camera
      const tracks = await createLocalTracks({
        audio: true,
        video: { resolution: { width: 1280, height: 720 }, frameRate: 30 },
      });
      const rawStream = new MediaStream(tracks.map((t) => t.mediaStreamTrack));
      rawStreamRef.current = rawStream;

      // 2. Lucy realtime transform over WebRTC
      const falKey = await fetchFalKey();
      const lucy = new LucyRealtime({
        endpoint: config.falEndpoint,
        falKey,
        onTransformedStream: (s) => setTransformedStream(s),
        onStatus: (s, d) => {
          setStatus(s as any);
          setStatusDetail(d);
        },
      });
      lucyRef.current = lucy;
      await lucy.connect(rawStream, {
        prompt:
          "Keep the person and their motion. Apply a clean, neutral look with a soft professional background.",
        enhance: true,
      });

      // 3. Join LiveKit; publish the TRANSFORMED stream, not the raw one.
      const tokenRes = await fetch(`${config.publicServerUrl}/api/token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName, displayName }),
      });
      const { url, token } = await tokenRes.json();

      const r = new Room();
      r.on(RoomEvent.Disconnected, () => setStatus("idle"));
      await r.connect(url, token);
      setRoom(r);

      // Wait for the transformed stream before publishing video.
      const attachAndPublish = (stream: MediaStream) => {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = rawStream.getAudioTracks()[0]; // keep real (untransformed) audio
        if (videoTrack) {
          r.localParticipant.publishTrack(videoTrack, {
            source: Track.Source.Camera,
            name: "lucy-video",
          });
        }
        if (audioTrack) {
          r.localParticipant.publishTrack(audioTrack, {
            source: Track.Source.Microphone,
            name: "mic-audio",
          });
        }
        setStatus("live");
        onStreamingChange?.(true);
      };

      if (transformedStreamRef.current) attachAndPublish(transformedStreamRef.current);
      else publishOnTransform.current = attachAndPublish;
    },
    [config, fetchFalKey]
  );

  // bridge: when transformed stream arrives, publish it
  useEffect(() => {
    transformedStreamRef.current = transformedStream;
    if (transformedStream && publishOnTransform.current) {
      publishOnTransform.current(transformedStream);
      publishOnTransform.current = null;
    }
  }, [transformedStream]);

  const applyTransform = useCallback((state: LucyState) => {
    lucyRef.current?.set({
      prompt: state.prompt,
      referenceImageUrl: state.referenceImageUrl,
      enhance: state.enhance ?? true,
    });
  }, []);

  const leave = useCallback(() => {
    lucyRef.current?.disconnect();
    room?.disconnect();
    setRoom(null);
    setTransformedStream(null);
    setStatus("idle");
    onStreamingChange?.(false);
  }, [room]);

  return { room, status, statusDetail, transformedStream, join, leave, applyTransform };
}
