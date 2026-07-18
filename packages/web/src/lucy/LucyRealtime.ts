import { fal } from "@fal-ai/client";

export interface LucyConnectionOptions {
  endpoint: string;
  falKey: string;
  onTransformedStream: (stream: MediaStream) => void;
  onStatus?: (status: "connecting" | "live" | "error", detail?: string) => void;
}

/**
 * Lucy 2.5 Realtime client.
 *
 * Connects a local MediaStream to fal's Lucy-2.5 realtime endpoint over WebRTC.
 * The transformed video is returned via onTransformedStream. The caller is then
 * responsible for publishing that transformed stream into the LiveKit call.
 *
 * Reference: https://fal.ai/lucy-2.5  /  https://docs.platform.decart.ai/models/realtime/lucy-2.5
 */
export class LucyRealtime {
  constructor(private opts: LucyConnectionOptions) {
    fal.config({ credentials: this.opts.falKey });
  }

  private connection: any = null;

  async connect(
    inputStream: MediaStream,
    initialState: { prompt: string; referenceImageUrl?: string; enhance?: boolean }
  ): Promise<void> {
    this.opts.onStatus?.("connecting");
    try {
      this.connection = fal.realtime.connect(this.opts.endpoint, {
        connectionKey: `lucy-${Date.now()}`,
        throttleInterval: 0,
        onResult: (result: any) => this.handleResult(result, inputStream),
        onError: (err: any) => this.opts.onStatus?.("error", String(err)),
      });

      this.connection.send({
        prompt: initialState.prompt,
        reference_image_url: initialState.referenceImageUrl,
        enhance_prompt: initialState.enhance ?? true,
      });
    } catch (e) {
      this.opts.onStatus?.("error", String(e));
    }
  }

  private pc: RTCPeerConnection | null = null;
  private outputVideo: HTMLVideoElement | null = null;

  private handleResult(result: any, inputStream: MediaStream) {
    switch (result.type) {
      case "iceservers":
      case "iceServers": {
        const servers = (result.iceservers || result.iceServers || result.ice_servers).map(
          (s: any) => ({
            urls: s.urls,
            username: s.username,
            credential: s.credential,
          })
        );

        const pc = new RTCPeerConnection({ iceServers: servers });
        this.pc = pc;

        inputStream.getTracks().forEach((track) => pc.addTrack(track, inputStream));

        pc.ontrack = (e) => {
          this.opts.onTransformedStream(e.streams[0]);
          this.opts.onStatus?.("live");
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            this.connection.send({
              type: "icecandidate",
              candidate: {
                candidate: e.candidate.candidate,
                sdpMid: e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex,
              },
            });
          }
        };

        pc.createOffer().then(async (offer) => {
          await pc.setLocalDescription(offer);
          this.connection.send({ type: "offer", sdp: offer.sdp });
        });
        break;
      }
      case "answer": {
        if (this.pc && result.sdp) {
          this.pc.setRemoteDescription({ type: "answer", sdp: result.sdp });
        }
        break;
      }
      default:
        break;
    }
  }

  /** Update the active transform live (avatar swap, background change, style). */
  set(state: { prompt: string; referenceImageUrl?: string; enhance?: boolean }) {
    this.connection?.send({
      prompt: state.prompt,
      reference_image_url: state.referenceImageUrl,
      enhance_prompt: state.enhance ?? true,
    });
  }

  disconnect() {
    try {
      this.pc?.close();
    } catch {
      /* noop */
    }
    try {
      this.connection?.close?.();
    } catch {
      /* noop */
    }
    this.pc = null;
    this.connection = null;
    this.opts.onStatus?.("connecting");
  }
}
