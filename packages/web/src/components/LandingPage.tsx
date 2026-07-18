import { useConfig } from "../hooks/useConfig";

const FEATURES = [
  {
    title: "Real-time avatar swap",
    body: "Upload a portrait and become that character live. Swap mid-stream with no reconnect.",
  },
  {
    title: "Live background change",
    body: "Replace your backdrop with a studio, a beach, or a neon city — described in plain words.",
  },
  {
    title: "Broadcast or call",
    body: "Send the transformed feed to OBS / virtual camera, or join a multi-party Lucy call.",
  },
  {
    title: "Cloud-powered, no GPU",
    body: "Lucy 2.5 runs in the cloud. Your machine only sends frames up and gets video back.",
  },
  {
    title: "Pay-as-you-stream",
    body: "Credits are metered per second of transformed video. Start free, top up when you go live.",
  },
  {
    title: "Private by design",
    body: "Frames are processed by the provider per their terms. No account or KYC to start.",
  },
];

const TIERS = [
  { min: 10, price: 25 },
  { min: 30, price: 60 },
  { min: 60, price: 100 },
  { min: 120, price: 180 },
];

const PILLS = ["No watermark", "No GPU", "Real-time 30fps", "Cloud-powered"];

export function LandingPage({ onOpen }: { onOpen: () => void }) {
  const { config } = useConfig();
  const rate = 0.05;
  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="brand">Lucy</span>
        <nav>
          <a href="/terms" target="_blank" rel="noreferrer">
            Terms
          </a>
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy
          </a>
          <button className="primary" onClick={onOpen}>
            Open app
          </button>
        </nav>
      </header>

      <section className="hero">
        <span className="badge">Lucy 2.5 · realtime</span>
        <h1>
          Become anyone.
          <br />
          Stream as them.
        </h1>
        <p className="sub">
          Real-time Lucy 2.5 avatar transformation and background changing for streamers and
          calls. No watermark. No GPU.
        </p>
        <button className="primary lg" onClick={onOpen}>
          Launch Lucy
        </button>
        <div className="pills">
          {PILLS.map((p) => (
            <span className="pill" key={p}>
              {p}
            </span>
          ))}
        </div>
        <p className="hint">
          {config ? `Ready · $${rate}/sec · $${(rate * 60).toFixed(2)}/min` : "Loading…"}
        </p>
      </section>

      <section className="features">
        {FEATURES.map((f) => (
          <div className="feature" key={f.title}>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </section>

      <section className="pricing">
        <h2>Credits</h2>
        <p className="sub">Free trial included. Top up when you go live.</p>
        <div className="tiers-grid">
          {TIERS.map((t) => (
            <div className="tier-card" key={t.min}>
              <div className="tier-min">{t.min} min</div>
              <div className="tier-price">${t.price}</div>
              <div className="tier-rate">${(t.price / t.min).toFixed(2)}/min</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span>Lucy Call · Lucy 2.5 realtime</span>
        <span>
          <a href="/terms" target="_blank" rel="noreferrer">
            Terms
          </a>{" "}
          ·{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy
          </a>
        </span>
      </footer>
    </div>
  );
}
