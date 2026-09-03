import type { ParticleSphereProps } from "./ParticleSphere";

/**
 * The tunable subset of {@link ParticleSphereProps}. `scrollTarget` and
 * `className` are layout wiring, not look-and-feel, so they stay out of it.
 */
export type SphereConfig = Required<
  Pick<
    ParticleSphereProps,
    | "particleCount"
    | "color"
    | "particleSize"
    | "opacity"
    | "rotationSpeed"
    | "rotationDirection"
    | "pauseOnHover"
    | "repulsionRadius"
    | "repulsionStrength"
    | "scatterForce"
    | "hoverScatterStrength"
    | "hoverScatterDuration"
    | "dissolveSpread"
    | "dissolveOpacity"
    | "anchor"
    | "targetDiameterPx"
    | "driftStrength"
  >
>;

/**
 * The design-approved defaults the hero ships with. The controller only ever
 * layers overrides on top of these; `Reset` returns here.
 */
export const SPHERE_BASE_CONFIG: SphereConfig = {
  particleCount: 6000,
  color: "#cc3363",
  particleSize: 0.05,
  opacity: 0.85,
  rotationSpeed: 0.12,
  rotationDirection: 1,
  pauseOnHover: false,
  repulsionRadius: 0.16,
  repulsionStrength: 0.2,
  scatterForce: 0.45,
  hoverScatterStrength: 0.3,
  hoverScatterDuration: 1.1,
  dissolveSpread: 2.6,
  dissolveOpacity: 0.34,
  anchor: "right",
  targetDiameterPx: 520,
  driftStrength: 0.12,
};

export const SPHERE_CONFIG_STORAGE_KEY = "aria:sphere-config";

/** Drops unknown/mistyped keys so a stale stored blob can't poison the scene. */
export function coerceSphereConfig(raw: unknown): Partial<SphereConfig> {
  if (typeof raw !== "object" || raw === null) return {};
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, base] of Object.entries(SPHERE_BASE_CONFIG)) {
    const value = input[key];
    if (typeof value !== typeof base) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    out[key] = value;
  }
  if (out.rotationDirection !== 1 && out.rotationDirection !== -1) {
    delete out.rotationDirection;
  }
  if (out.anchor !== "right" && out.anchor !== "center") delete out.anchor;
  return out as Partial<SphereConfig>;
}

/**
 * Renders the config as JSX props, omitting anything still at its default, so
 * a tuned look can be pasted straight back into the hero as new defaults.
 */
export function serializeSphereConfig(config: SphereConfig): string {
  const lines = (Object.keys(SPHERE_BASE_CONFIG) as (keyof SphereConfig)[])
    .filter((key) => config[key] !== SPHERE_BASE_CONFIG[key])
    .map((key) => {
      const value = config[key];
      if (typeof value === "string") return `  ${key}="${value}"`;
      if (typeof value === "boolean") return value ? `  ${key}` : `  ${key}={false}`;
      return `  ${key}={${Number(value.toFixed(4))}}`;
    });
  return lines.length
    ? `<ParticleSphere\n${lines.join("\n")}\n/>`
    : "<ParticleSphere /> // all values at their defaults";
}
