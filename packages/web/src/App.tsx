import { useCallback, useEffect, useState } from "react";
import { RoomContext, GridLayout, ParticipantTile, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useConfig } from "./hooks/useConfig";
import { useLucyCall } from "./hooks/useLucyCall";
import { useUsage } from "./hooks/useUsage";
import { useStatus } from "./hooks/useStatus";
import { useAuth } from "./hooks/useAuth";
import { TransformControls } from "./components/TransformControls";
import { BroadcastView } from "./components/BroadcastView";
import { TopUpModal } from "./components/TopUpModal";
import { LegalPage } from "./components/LegalPage";
import { StatusBanner } from "./components/StatusBanner";
import { LandingPage } from "./components/LandingPage";
import { AuthForms } from "./components/AuthForms";
import { AccountMenu, VerifyPrompt } from "./components/AccountMenu";
import type { CallConfig } from "./hooks/useLucyCall";

type Mode = "call" | "broadcast";

function RoomView({ config, usage, onStreamingChange }: { config: CallConfig; usage: ReturnType<typeof useUsage>; onStreamingChange: (s: boolean) => void }) {
  const { room, status, statusDetail, join, leave, applyTransform } = useLucyCall(config, onStreamingChange);
  const [roomName, setRoomName] = useState("");
  const [name, setName] = useState("");

  if (!room) {
    return (
      <div className="join">
        <h1>Lucy Call</h1>
        <p>Real-time video calls with live Lucy 2.5 avatar & background transformation.</p>
        <input placeholder="Room name" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
        <button className="primary" disabled={!roomName || status === "connecting"} onClick={() => join(roomName, name)}>
          {status === "connecting" ? "Connecting…" : "Join call"}
        </button>
        {statusDetail && <span className="err">{statusDetail}</span>}
      </div>
    );
  }
  return (
    <div className="call">
      <aside className="sidebar">
        <TransformControls onApply={applyTransform} status={status} />
        <button className="leave" onClick={leave}>Leave call</button>
      </aside>
      <main className="stage">
        <RoomContext.Provider value={room}>
          <MyStage />
        </RoomContext.Provider>
      </main>
    </div>
  );
}

function MyStage() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  return (
    <GridLayout tracks={tracks}>
      <ParticipantTile />
    </GridLayout>
  );
}

function AppShell({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { config } = useConfig();
  const [mode, setMode] = useState<Mode>("broadcast");
  const usage = useUsage();
  const status = useStatus(config?.publicServerUrl ?? "");
  const [topupOpen, setTopupOpen] = useState(false);

  const onStreamingChange = useCallback(
    async (streaming: boolean) => {
      if (streaming) {
        const sid = await usage.start();
        if (!sid) usage.refresh();
      } else {
        await usage.stop(usage.sessionId);
        usage.refresh();
      }
    },
    [usage]
  );

  if (!config) return <div className="loading">Loading…</div>;

  const minutes = (usage.usage.secondsRemaining / 60).toFixed(1);

  return (
    <div className="app">
      <nav className="topbar">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); window.location.href = "/"; }}>Lucy</a>
        <div className="mode-switch">
          <button className={mode === "broadcast" ? "active" : ""} onClick={() => setMode("broadcast")}>Broadcast</button>
          <button className={mode === "call" ? "active" : ""} onClick={() => setMode("call")}>Call</button>
        </div>
        <div className="credits">
          <span className={usage.usage.secondsRemaining <= 0 ? "credit-empty" : ""}>{minutes} min left</span>
          {config.stripeEnabled ? (
            <button className="topup" onClick={() => setTopupOpen(true)}>Top up</button>
          ) : (
            <button className="topup" disabled title="Stripe not configured">Payments soon</button>
          )}
        </div>
        {auth.user && <AccountMenu user={auth.user} onLogout={auth.logout} />}
      </nav>

      <StatusBanner status={status} />

      <TopUpModal open={topupOpen} onClose={() => setTopupOpen(false)} usage={usage.usage} onTopup={usage.topup} onPaid={usage.refresh} />
      {mode === "broadcast" ? (
        <BroadcastView config={config} onStreamingChange={onStreamingChange} usage={usage} />
      ) : (
        <RoomView config={config} usage={usage} onStreamingChange={onStreamingChange} />
      )}
    </div>
  );
}

export function App() {
  const { config, error } = useConfig();
  const auth = useAuth();
  const [open, setOpen] = useState(() => window.location.pathname === "/app");
  const [emailUnverified, setEmailUnverified] = useState(false);

  // Handle post-redirect query params (?verify=1 from Stripe, ?confirmed=, ?google=).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verify") === "1") {
      // Poll identity status until verified, then refresh user + clear param.
      const poll = setInterval(async () => {
        try {
          const r = await fetch("/api/identity/status", { credentials: "include" });
          if (r.ok) {
            const d = await r.json();
            if (d.verified) {
              clearInterval(poll);
              auth.refresh();
              window.history.replaceState({}, "", "/app");
            }
          }
        } catch {
          /* ignore */
        }
      }, 2000);
      return () => clearInterval(poll);
    }
    if (params.get("confirmed") !== null || params.get("google") !== null) {
      auth.refresh();
      window.history.replaceState({}, "", "/app");
    }
  }, [auth]);

  if (config === null && !error) return <div className="loading">Loading…</div>;
  if (error) return <div className="err">Failed to load config: {error}</div>;

  const path = window.location.pathname;
  if (path === "/terms" || path === "/privacy") {
    return <LegalPage kind={path === "/terms" ? "terms" : "privacy"} onBack={() => window.history.pushState({}, "", "/")} />;
  }

  if (!open) return <LandingPage onOpen={() => { window.history.pushState({}, "", "/app"); setOpen(true); }} />;

  if (auth.loading) return <div className="loading">Loading…</div>;
  if (!auth.user) {
    return (
      <AuthForms
        onLogin={async (e, p) => {
          setEmailUnverified(false);
          try {
            await auth.login(e, p);
          } catch (err) {
            if ((err as Error).message.toLowerCase().includes("verify your email")) setEmailUnverified(true);
            throw err;
          }
        }}
        onRegister={auth.register}
        onGoogle={auth.loginWithGoogle}
        googleEnabled={Boolean(config?.googleEnabled)}
        emailUnverified={emailUnverified}
      />
    );
  }
  if (!auth.user.emailVerified) {
    return (
      <div className="app">
        <nav className="topbar">
          <span className="brand">Lucy</span>
          {auth.user && <AccountMenu user={auth.user} onLogout={auth.logout} />}
        </nav>
        <div className="verify-prompt">
          <div className="verify-card">
            <h2>Verify your email</h2>
            <p>We sent a confirmation link to {auth.user.email}. Open it to activate your account.</p>
          </div>
        </div>
      </div>
    );
  }
  if (!auth.user.verified) {
    return (
      <div className="app">
        <nav className="topbar">
          <span className="brand">Lucy</span>
          {auth.user && <AccountMenu user={auth.user} onLogout={auth.logout} />}
        </nav>
        <VerifyPrompt
          onVerify={async () => {
            try {
              const url = await auth.startVerification();
              if (url) window.location.href = url;
            } catch (e) {
              alert((e as Error).message);
            }
          }}
        />
      </div>
    );
  }

  return <AppShell auth={auth} />;
}
