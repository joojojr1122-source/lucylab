import { useState } from "react";
import { DEFAULT_TRANSFORMS, type LucyState, type TransformKind } from "@lucy-call/shared";

interface Props {
  onApply: (state: LucyState) => void;
  status: string;
}

const TABS: { key: TransformKind; label: string }[] = [
  { key: "avatar", label: "Avatar" },
  { key: "background", label: "Background" },
];

const BACKGROUND_PRESETS = [
  "Replace the background with a clean professional studio gradient, keeping the person and lighting intact.",
  "Place the person on a sunny beach with palm trees and a blue ocean.",
  "Set the scene in a futuristic neon city at night.",
  "Change the background to a cozy home office with bookshelves.",
];

export function TransformControls({ onApply, status }: Props) {
  const [tab, setTab] = useState<TransformKind>("background");
  const [prompt, setPrompt] = useState(DEFAULT_TRANSFORMS.background.prompt);
  const [refImage, setRefImage] = useState<string>("");

  const apply = (p: string, img?: string) =>
    onApply({ prompt: p, referenceImageUrl: img || undefined, enhance: true });

  return (
    <div className="panel">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => {
              setTab(t.key);
              setPrompt(DEFAULT_TRANSFORMS[t.key].prompt);
              setRefImage("");
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "background" && (
        <div className="presets">
          {BACKGROUND_PRESETS.map((p) => (
            <button key={p} className="preset" onClick={() => { setPrompt(p); apply(p); }}>
              {p.slice(0, 42)}…
            </button>
          ))}
        </div>
      )}

      {tab === "avatar" && (
        <div className="ref-upload">
          <label>Reference image (the face/character to become):</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => setRefImage(reader.result as string);
                reader.readAsDataURL(file);
              }
            }}
          />
          <p className="hint">Lucy swaps your on-camera character with the reference image live.</p>
        </div>
      )}

      <textarea
        value={prompt}
        rows={3}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the transform…"
      />

      <div className="actions">
        <button className="primary" onClick={() => apply(prompt, refImage)}>
          Apply transform
        </button>
        <span className={`status ${status}`}>{status}</span>
      </div>
    </div>
  );
}
