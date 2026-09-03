"use client";

import { useEffect, useRef, useState } from "react";
import type { SphereConfig } from "./sphereConfig";
import { SPHERE_BASE_CONFIG, serializeSphereConfig } from "./sphereConfig";

/** Collapsed/expanded is remembered so the panel stays out of the way. */
const PANEL_OPEN_KEY = "aria:sphere-panel-open";

interface SphereControllerProps {
  config: SphereConfig;
  onChange: (patch: Partial<SphereConfig>) => void;
  onReset: () => void;
}

/** Slider bounds; particleCount matches the 1,000–12,000 range in DESIGN.md. */
const SLIDERS: {
  key: keyof SphereConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Rebuilding the geometry costs a remount, so flag it in the UI. */
  rebuilds?: boolean;
}[] = [
  { key: "particleCount", label: "Particles", min: 1000, max: 12000, step: 100, rebuilds: true },
  { key: "particleSize", label: "Particle size", min: 0.005, max: 0.2, step: 0.005 },
  { key: "opacity", label: "Opacity", min: 0, max: 1, step: 0.01 },
  { key: "targetDiameterPx", label: "Diameter (px)", min: 200, max: 1200, step: 10 },
  { key: "rotationSpeed", label: "Rotation speed", min: 0, max: 1, step: 0.01 },
  { key: "repulsionRadius", label: "Repel radius", min: 0.02, max: 0.6, step: 0.01 },
  { key: "repulsionStrength", label: "Repel strength", min: 0, max: 1, step: 0.01 },
  { key: "scatterForce", label: "Click scatter", min: 0, max: 2, step: 0.05 },
  { key: "hoverScatterStrength", label: "Hover scatter", min: 0, max: 1.5, step: 0.02 },
  { key: "hoverScatterDuration", label: "Scatter speed (s)", min: 0.3, max: 3, step: 0.1 },
  { key: "dissolveSpread", label: "Dissolve spread", min: 0.5, max: 6, step: 0.1, rebuilds: true },
  { key: "dissolveOpacity", label: "Dissolve opacity", min: 0, max: 1, step: 0.01 },
  { key: "driftStrength", label: "Scroll drift", min: 0, max: 0.6, step: 0.01 },
];

function formatValue(key: keyof SphereConfig, value: number): string {
  if (key === "particleCount" || key === "targetDiameterPx") return String(value);
  return value.toFixed(key === "particleSize" ? 3 : 2);
}

export default function SphereController({
  config,
  onChange,
  onReset,
}: SphereControllerProps) {
  // ssr: false, so reading storage during init cannot desync hydration.
  const [open, setOpen] = useState(
    () => window.localStorage.getItem(PANEL_OPEN_KEY) !== "0"
  );
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(PANEL_OPEN_KEY, next ? "1" : "0");
      } catch {
        // Storage blocked — the panel just reopens on the next load.
      }
      return next;
    });
  }

  async function copyProps() {
    try {
      await navigator.clipboard.writeText(serializeSphereConfig(config));
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is unavailable (insecure origin / denied) — leave the label be.
    }
  }

  const dirty = (Object.keys(SPHERE_BASE_CONFIG) as (keyof SphereConfig)[]).some(
    (k) => config[k] !== SPHERE_BASE_CONFIG[k]
  );

  // Left-anchored so the panel never sits on top of the orb it is tuning.
  return (
    <div className="pointer-events-auto fixed bottom-16 left-16 z-50 w-[280px] font-arial text-[12px] text-platinum">
      <div className="overflow-hidden rounded-small border border-graphite bg-pitch-black/95 shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={toggleOpen}
          className="flex w-full items-center justify-between gap-12 px-16 py-12 text-left uppercase tracking-[0.12em] text-pale-oak transition-colors hover:text-platinum"
        >
          <span>Sphere controls{dirty ? " •" : ""}</span>
          <span aria-hidden="true">{open ? "–" : "+"}</span>
        </button>

        {open && (
          <div
            className="max-h-[70vh] overflow-y-auto border-t border-graphite px-16 py-16"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#34312d transparent" }}
          >
            <label className="mb-16 flex items-center justify-between gap-12">
              <span className="text-pale-oak">Color</span>
              <span className="flex items-center gap-12">
                <span className="tabular-nums text-pale-oak/60">
                  {config.color.toUpperCase()}
                </span>
                <input
                  type="color"
                  value={config.color}
                  onChange={(e) => onChange({ color: e.target.value })}
                  className="h-24 w-32 cursor-pointer rounded-small border border-graphite bg-transparent"
                />
              </span>
            </label>

            {SLIDERS.map(({ key, label, min, max, step, rebuilds }) => (
              <label key={key} className="mb-16 block">
                <span className="mb-4 flex items-center justify-between gap-12">
                  <span className="text-pale-oak">
                    {label}
                    {rebuilds && (
                      <span
                        className="text-pale-oak/40"
                        title="Rebuilds the particle field"
                      >
                        {" "}
                        ↻
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-platinum">
                    {formatValue(key, config[key] as number)}
                  </span>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={config[key] as number}
                  onChange={(e) =>
                    onChange({ [key]: Number(e.target.value) } as Partial<SphereConfig>)
                  }
                  className="w-full accent-berry-lipstick"
                />
              </label>
            ))}

            <div className="mb-16 flex items-center justify-between gap-12">
              <span className="text-pale-oak">Direction</span>
              <div className="flex gap-4">
                {([1, -1] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => onChange({ rotationDirection: dir })}
                    className={`rounded-small border px-12 py-4 transition-colors ${
                      config.rotationDirection === dir
                        ? "border-berry-lipstick bg-berry-lipstick text-platinum"
                        : "border-graphite text-pale-oak hover:border-pale-oak/50"
                    }`}
                  >
                    {dir === 1 ? "CW" : "CCW"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-16 flex items-center justify-between gap-12">
              <span className="text-pale-oak">Anchor</span>
              <div className="flex gap-4">
                {(["right", "center"] as const).map((anchor) => (
                  <button
                    key={anchor}
                    type="button"
                    onClick={() => onChange({ anchor })}
                    className={`rounded-small border px-12 py-4 capitalize transition-colors ${
                      config.anchor === anchor
                        ? "border-berry-lipstick bg-berry-lipstick text-platinum"
                        : "border-graphite text-pale-oak hover:border-pale-oak/50"
                    }`}
                  >
                    {anchor}
                  </button>
                ))}
              </div>
            </div>

            <label className="mb-20 flex items-center justify-between gap-12">
              <span className="text-pale-oak">Pause on hover</span>
              <input
                type="checkbox"
                checked={config.pauseOnHover}
                onChange={(e) => onChange({ pauseOnHover: e.target.checked })}
                className="h-16 w-16 accent-berry-lipstick"
              />
            </label>

            <div className="flex gap-12">
              <button
                type="button"
                onClick={copyProps}
                className="flex-1 rounded-button bg-berry-lipstick px-12 py-12 text-platinum transition-colors hover:bg-[#b32a56]"
              >
                {copied ? "Copied" : "Copy props"}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-button border border-graphite px-12 py-12 text-pale-oak transition-colors hover:border-pale-oak/60"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
