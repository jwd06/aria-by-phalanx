"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export interface ParticleSphereProps {
  /** Number of particles across the sphere surface. 1,000–12,000, default 6,000. */
  particleCount?: number;
  /** Particle glow color (CSS hex). */
  color?: string;
  /** Base particle sprite size. */
  particleSize?: number;
  /** Particle opacity. */
  opacity?: number;
  /** Uniform scale applied to the whole sphere, independent of particle distribution. */
  sphereScale?: number;
  /** Auto-rotation speed in radians/second. */
  rotationSpeed?: number;
  /** 1 = clockwise, -1 = anticlockwise. */
  rotationDirection?: 1 | -1;
  /** Pause auto-rotation while the pointer is over the sphere. */
  pauseOnHover?: boolean;
  /** Angular radius (radians) of the continuous cursor-repulsion field. */
  repulsionRadius?: number;
  /** Strength of the continuous cursor-repulsion field. */
  repulsionStrength?: number;
  /** Force of the one-shot scatter burst on pointer/click/touch contact. */
  scatterForce?: number;
  /**
   * How far the whole sphere breaks apart while the cursor is inside it, in
   * sphere radii. It holds there until the pointer leaves. 0 disables it.
   */
  hoverScatterStrength?: number;
  /**
   * Seconds for a full break-apart plus reassemble. Split asymmetrically by
   * {@link BURST_ATTACK}: it scatters fast and settles back slowly.
   */
  hoverScatterDuration?: number;
  /**
   * CSS selector for the element whose scroll progress dissolves the sphere
   * into an ambient particle field. Omit to disable all scroll behaviour.
   */
  scrollTarget?: string;
  /** How far the dissolved field spreads, in sphere radii. */
  dissolveSpread?: number;
  /** Material opacity at full dissolve. */
  dissolveOpacity?: number;
  /** Where the sphere sits inside a full-bleed canvas. */
  anchor?: "right" | "center";
  /** Keep the sphere at a constant on-screen diameter regardless of canvas size. */
  targetDiameterPx?: number;
  /**
   * How far the settled field parallaxes as the page scrolls below the hero,
   * as a fraction of the scrolled distance. 0 disables the drift.
   */
  driftStrength?: number;
  className?: string;
}

const DEFAULTS = {
  particleCount: 6000,
  color: "#CC3363",
  particleSize: 0.05,
  opacity: 0.85,
  sphereScale: 1,
  rotationSpeed: 0.12,
  rotationDirection: 1 as const,
  pauseOnHover: false,
  repulsionRadius: 0.16,
  repulsionStrength: 0.2,
  scatterForce: 0.45,
  hoverScatterStrength: 0.3,
  hoverScatterDuration: 1.1,
  dissolveSpread: 2.6,
  dissolveOpacity: 0.34,
  anchor: "center" as const,
  driftStrength: 0.12,
};

function fibonacciSphere(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  return positions;
}

/** Small deterministic PRNG so the ambient field is identical on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Per-particle resting places for the dissolved state: a wide, shallow slab
 * biased behind the sphere plane so size attenuation pushes them into depth.
 * Also returns a per-particle delay so the sphere breaks apart in waves.
 */
function scatterField(count: number, spread: number) {
  const targets = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  const rand = mulberry32(0x5eed1e);
  for (let i = 0; i < count; i++) {
    targets[i * 3] = (rand() * 2 - 1) * spread * 1.9;
    targets[i * 3 + 1] = (rand() * 2 - 1) * spread * 0.8;
    targets[i * 3 + 2] = -1.5 + rand() * 2;
    delays[i] = rand() * 0.3;
  }
  return { targets, delays };
}

function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function raySphereIntersect(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  center: THREE.Vector3,
  radius: number
): THREE.Vector3 | null {
  const oc = origin.clone().sub(center);
  const b = 2 * oc.dot(dir);
  const c = oc.dot(oc) - radius * radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / 2;
  const t2 = (-b + sqrtDisc) / 2;
  const t = t1 >= 0 ? t1 : t2;
  if (t < 0) return null;
  return origin.clone().addScaledVector(dir, t);
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** How much a particle dims once fully dispersed. Higher = fainter dust. */
const DISSOLVE_FADE = 0.45;

/** How quickly the dissolve chases the raw scroll position. Higher = snappier. */
const DISSOLVE_RESPONSE = 11;

/** Fraction of the idle spin the field keeps once fully dispersed. */
const DISSOLVED_SPIN = 0.45;

/**
 * Share of `hoverScatterDuration` spent breaking apart; the rest is the settle
 * back once the cursor leaves. Well under half, so it scatters much faster
 * than it reassembles.
 */
const BURST_ATTACK = 0.18;

export default function ParticleSphere(props: ParticleSphereProps) {
  const opts = { ...DEFAULTS, ...props };
  const containerRef = useRef<HTMLDivElement>(null);
  const optsRef = useRef(opts);

  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Phones pay for every additive-blended point twice over: fill rate and
    // battery. Read once - the effect rebuilds the whole scene, so this must
    // not be reactive.
    const lowPower =
      window.matchMedia("(pointer: coarse)").matches ||
      window.innerWidth < 640;

    const count = clamp(
      Math.round(
        lowPower
          ? Math.min(optsRef.current.particleCount, 2500)
          : optsRef.current.particleCount
      ),
      1000,
      12000
    );

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    /** Resting camera distance; the dissolve pulls back from here. */
    const cameraBaseZ = 3.4;
    camera.position.set(0, 0, cameraBaseZ);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    // `pan-y pinch-zoom`, not `none`: the canvas is fixed and full-viewport, so
    // `none` swallows every vertical swipe over the hero and the page cannot be
    // scrolled by touch at all. `pinch-zoom` has to be listed explicitly - `pan-y`
    // alone would leave the whole landing page un-zoomable (WCAG 1.4.4), since the
    // canvas is the hit target across most of the viewport. `touch-action` governs
    // touch and pen only - mouse dragging is unaffected.
    renderer.domElement.style.touchAction = "pan-y pinch-zoom";
    renderer.domElement.style.cursor = "grab";

    const group = new THREE.Group();
    scene.add(group);

    const basePositions = fibonacciSphere(count);
    const drawPositions = new Float32Array(basePositions);
    const displacement = new Float32Array(count);

    const { targets: scatterTargets, delays: scatterDelay } = scatterField(
      count,
      optsRef.current.dissolveSpread
    );

    /**
     * Per-particle share of the hover burst. Pushing every particle out by the
     * same amount reads as a balloon inflating, so each gets its own distance
     * and the surface breaks into a loose cloud that still holds its silhouette.
     */
    const burstAmplitude = new Float32Array(count);
    {
      const rand = mulberry32(0x0b1257);
      for (let i = 0; i < count; i++) burstAmplitude[i] = 0.35 + rand() * 0.95;
    }

    const drawColors = new Float32Array(count * 3);
    const baseColor = new THREE.Color(optsRef.current.color);
    /** Last colour written into the vertex buffer, so live edits can repaint. */
    let appliedColor = optsRef.current.color;
    /** Last layout-affecting options, so live edits can refit the sphere. */
    let appliedLayout = `${optsRef.current.targetDiameterPx ?? 0}|${optsRef.current.anchor}`;
    for (let i = 0; i < count; i++) {
      drawColors[i * 3] = baseColor.r;
      drawColors[i * 3 + 1] = baseColor.g;
      drawColors[i * 3 + 2] = baseColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(drawPositions, 3)
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(drawColors, 3));

    const material = new THREE.PointsMaterial({
      size: optsRef.current.particleSize,
      map: createGlowTexture(),
      transparent: true,
      opacity: optsRef.current.opacity,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    // Particles travel far outside the geometry's initial bounding sphere once
    // dissolved, so leave culling to the renderer's per-pixel work instead.
    points.frustumCulled = false;
    group.add(points);
    group.scale.setScalar(optsRef.current.sphereScale);

    // --- Scroll dissolve state ---
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    /** Raw ScrollTrigger progress across the hero. */
    let scrollProgress = 0;
    /** Smoothed value the render loop actually draws. */
    let dissolve = 0;
    /** Document scroll in pixels, used for the settled field's parallax. */
    let scrollPx = 0;
    /** Scroll offset at which the dissolve completes; drift starts after it. */
    let driftOrigin = 0;
    /** Current parallax offset in world units. */
    let drift = 0;
    /** Base y the resize handler anchored the sphere to. */
    let anchorY = 0;
    /** World units per CSS pixel at the sphere plane. */
    let worldPerPixel = 0;
    /** Ceiling the parallax eases into, so the field never scrolls away. */
    let maxDrift = 0;

    // --- Interaction state ---
    const pointer = { ndc: new THREE.Vector2(0, 0), active: false };
    let hovering = false;
    let dragging = false;
    let dragLast = { x: 0, y: 0, t: 0 };
    const momentum = { x: 0, y: 0 };

    /** True while any particle is still recovering from cursor displacement. */
    let displacementActive = false;

    /** Raw 0-1 ramp: climbs while the cursor is on the sphere, falls off it. */
    let burstProgress = 0;
    /** Eased ramp the particles actually ride; kept so changes can be detected. */
    let burstEnv = 0;
    /** Whether the cursor is inside the sphere's hit volume this frame. */
    let overSphere = false;

    const raycaster = new THREE.Raycaster();
    const invQuat = new THREE.Quaternion();
    const camLocalDir = new THREE.Vector3();
    const contactDir = new THREE.Vector3();

    function computeContactDir(ndc: THREE.Vector2): THREE.Vector3 | null {
      raycaster.setFromCamera(ndc, camera);
      const worldPoint = raySphereIntersect(
        raycaster.ray.origin,
        raycaster.ray.direction,
        group.position,
        fittedScale
      );
      if (!worldPoint) return null;
      invQuat.copy(group.quaternion).invert();
      return worldPoint
        .sub(group.position)
        .applyQuaternion(invQuat)
        .divideScalar(fittedScale)
        .normalize();
    }

    function scatterBurstAt(ndc: THREE.Vector2) {
      const dir = computeContactDir(ndc);
      if (!dir) return;
      const scatterRadius = optsRef.current.repulsionRadius * 2;
      const cosRadius = Math.cos(scatterRadius);
      for (let i = 0; i < count; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const bz = basePositions[i * 3 + 2];
        const d = bx * dir.x + by * dir.y + bz * dir.z;
        if (d > cosRadius) {
          const influence = (d - cosRadius) / (1 - cosRadius);
          displacement[i] += influence * optsRef.current.scatterForce;
          displacementActive = true;
        }
      }
    }

    function toNDC(clientX: number, clientY: number): THREE.Vector2 {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1)
      );
    }

    const dragSensitivity = 0.006;
    /** Touch contact waiting to prove it is a horizontal spin, not a scroll. */
    let pendingDrag: { id: number; x: number; y: number } | null = null;
    /** Movement, in px, before a touch commits to spinning. */
    const dragIntentThreshold = 6;

    function beginDrag(e: PointerEvent) {
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // capture is best-effort; the drag still tracks without it
      }
      dragging = true;
      momentum.x = 0;
      momentum.y = 0;
      dragLast = { x: e.clientX, y: e.clientY, t: performance.now() };
      renderer.domElement.style.cursor = "grabbing";
    }

    function onPointerEnter() {
      hovering = true;
      renderer.domElement.style.cursor = "grab";
    }
    function onPointerLeave() {
      hovering = false;
      pointer.active = false;
    }
    function onPointerMove(e: PointerEvent) {
      const ndc = toNDC(e.clientX, e.clientY);
      pointer.ndc.copy(ndc);
      pointer.active = true;
      if (!dragging && pendingDrag && pendingDrag.id === e.pointerId) {
        const dx = e.clientX - pendingDrag.x;
        const dy = e.clientY - pendingDrag.y;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > dragIntentThreshold) {
          pendingDrag = null;
          beginDrag(e);
        } else if (Math.abs(dy) > dragIntentThreshold) {
          // The browser is taking this one as a scroll.
          pendingDrag = null;
        }
      }
      if (dragging) {
        const now = performance.now();
        const dt = Math.max(1, now - dragLast.t);
        const dx = e.clientX - dragLast.x;
        const dy = e.clientY - dragLast.y;
        group.rotation.y += dx * dragSensitivity;
        group.rotation.x = clamp(
          group.rotation.x + dy * dragSensitivity,
          -1.2,
          1.2
        );
        momentum.x = (dx * dragSensitivity) / (dt / 16.7);
        momentum.y = (dy * dragSensitivity) / (dt / 16.7);
        dragLast = { x: e.clientX, y: e.clientY, t: now };
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse") {
        beginDrag(e);
      } else {
        // Capturing here would keep the gesture even when it turns out to be a
        // scroll, so a touch has to earn the drag in onPointerMove first. The
        // scatter burst below still fires, so a tap behaves as it always did.
        pendingDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
      scatterBurstAt(toNDC(e.clientX, e.clientY));
    }
    function onPointerUp(e: PointerEvent) {
      if (pendingDrag && pendingDrag.id === e.pointerId) pendingDrag = null;
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be released
      }
      renderer.domElement.style.cursor = hovering ? "grab" : "default";
    }

    const dom = renderer.domElement;
    dom.addEventListener("pointerenter", onPointerEnter);
    dom.addEventListener("pointerleave", onPointerLeave);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);

    // --- Resize ---
    /** Half the visible world height at the sphere plane, per unit of distance. */
    const halfFovTan = Math.tan((camera.fov / 2) * THREE.MathUtils.DEG2RAD);
    /** Scale that makes the sphere read at a fixed pixel diameter. */
    let fittedScale = optsRef.current.sphereScale;

    function handleResize() {
      const width = container!.clientWidth;
      const height = container!.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);

      const o = optsRef.current;
      const visibleHeight = 2 * halfFovTan * cameraBaseZ;
      const visibleWidth = visibleHeight * camera.aspect;

      if (o.targetDiameterPx) {
        // World radius that projects to targetDiameterPx at the sphere plane,
        // capped so the orb never grows wider than the viewport on a phone.
        const diameterPx = Math.min(o.targetDiameterPx, width * 0.82);
        fittedScale = (diameterPx / height) * (visibleHeight / 2);
      } else {
        fittedScale = o.sphereScale;
      }

      worldPerPixel = visibleHeight / height;
      maxDrift = visibleHeight * 0.35;

      // Below the lg breakpoint the page collapses to one column, so the orb
      // centres itself under the headline instead of sitting in the right half.
      const wide = width >= 1024;
      group.position.x =
        o.anchor === "right" && wide ? visibleWidth * 0.25 : 0;
      anchorY = wide ? 0 : -visibleHeight * 0.12;
      group.position.y = anchorY + drift;
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    // --- Scroll dissolve + page-wide drift ---
    const triggers: ScrollTrigger[] = [];
    if (optsRef.current.scrollTarget) {
      // The sphere breaks apart across the hero; the field it becomes then
      // persists behind every section below.
      const dissolveTrigger = ScrollTrigger.create({
        trigger: optsRef.current.scrollTarget,
        start: "top top",
        end: "bottom top",
        onUpdate: (self) => {
          scrollProgress = self.progress;
        },
        // `end` moves when the layout reflows, so re-read it rather than
        // caching a stale drift origin.
        onRefresh: (self) => {
          driftOrigin = self.end;
        },
      });
      scrollProgress = dissolveTrigger.progress;
      dissolve = scrollProgress;
      driftOrigin = dissolveTrigger.end;
      triggers.push(dissolveTrigger);

      // Once settled, the field parallaxes against the rest of the document
      // so lower sections feel like they travel through it.
      const driftTrigger = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          scrollPx = self.scroll();
        },
      });
      scrollPx = driftTrigger.scroll();
      triggers.push(driftTrigger);
    }

    // --- Animation loop ---
    const clock = new THREE.Clock();
    let frameId = 0;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const o = optsRef.current;

      // Ease toward the raw scroll position so wheel steps don't judder.
      const prevDissolve = dissolve;
      dissolve = reduceMotion
        ? scrollProgress
        : dissolve +
          (scrollProgress - dissolve) * Math.min(1, delta * DISSOLVE_RESPONSE);
      if (Math.abs(scrollProgress - dissolve) < 0.0005) dissolve = scrollProgress;

      // Below the hero the settled field drifts at a fraction of scroll speed.
      const driftPx = Math.max(0, scrollPx - driftOrigin);
      const rawDrift = driftPx * o.driftStrength * worldPerPixel;
      // Saturating curve: linear at first, easing into maxDrift on long pages.
      const driftTarget =
        maxDrift > 0 ? Math.tanh(rawDrift / maxDrift) * maxDrift * dissolve : 0;
      drift = reduceMotion
        ? driftTarget
        : drift + (driftTarget - drift) * Math.min(1, delta * 6);
      group.position.y = anchorY - drift;

      // The sphere is only grabbable while it is still a sphere; once it is
      // page-wide ambience the canvas must not intercept clicks on content.
      // The container may be pointer-events-none; the canvas opts itself in.
      const interactive = dissolve < 0.5;
      const pointerEvents = interactive ? "auto" : "none";
      if (dom.style.pointerEvents !== pointerEvents) {
        dom.style.pointerEvents = pointerEvents;
        if (!interactive) {
          hovering = false;
          pointer.active = false;
          dragging = false;
          pendingDrag = null;
        }
      }

      if (dragging) {
        // rotation already applied directly in onPointerMove
      } else if (Math.abs(momentum.x) + Math.abs(momentum.y) > 0.0002) {
        group.rotation.y += momentum.x;
        group.rotation.x = clamp(group.rotation.x + momentum.y, -1.2, 1.2);
        momentum.x *= 0.94;
        momentum.y *= 0.94;
      } else if (!(o.pauseOnHover && hovering) && !reduceMotion) {
        // Let the field settle as it disperses instead of spinning like a slab.
        group.rotation.y +=
          o.rotationSpeed *
          o.rotationDirection *
          delta *
          (1 - (1 - DISSOLVED_SPIN) * dissolve);
      }

      // Live-tunable options that were otherwise baked in at init.
      let colorDirty = false;
      if (o.color !== appliedColor) {
        appliedColor = o.color;
        baseColor.set(o.color);
        colorDirty = true;
      }
      const layoutKey = `${o.targetDiameterPx ?? 0}|${o.anchor}`;
      if (layoutKey !== appliedLayout) {
        appliedLayout = layoutKey;
        handleResize();
      }

      let contactActive = false;
      if (pointer.active && interactive) {
        const dir = computeContactDir(pointer.ndc);
        if (dir) {
          contactDir.copy(dir);
          contactActive = true;
        }
      }

      // The sphere holds its scattered state for as long as the cursor is
      // inside its hit sphere, and only reassembles once the pointer leaves.
      overSphere = contactActive && !reduceMotion && o.hoverScatterStrength > 0;

      const prevBurstEnv = burstEnv;
      // Break apart quickly, settle back slowly — the same asymmetry the
      // one-shot envelope had, but driven by hover state instead of elapsed
      // time so it can be held open indefinitely.
      const attack = Math.max(0.05, o.hoverScatterDuration * BURST_ATTACK);
      const release = Math.max(0.1, o.hoverScatterDuration * (1 - BURST_ATTACK));
      burstProgress = clamp01(
        burstProgress + (overSphere ? delta / attack : -delta / release)
      );
      burstEnv = smoothstep(burstProgress);
      const burstScale = burstEnv * o.hoverScatterStrength;

      invQuat.copy(group.quaternion).invert();
      camLocalDir
        .copy(camera.position)
        .sub(group.position)
        .applyQuaternion(invQuat)
        .normalize();

      const cosRepulsion = Math.cos(o.repulsionRadius);
      const decay = Math.pow(0.001, delta);

      // Particle positions are a pure function of dissolve + displacement, so
      // once both are settled the buffer can be left alone and only the group
      // transform animates. This keeps the page-wide field close to free.
      const needsParticleUpdate =
        dissolve !== prevDissolve ||
        burstEnv !== prevBurstEnv ||
        contactActive ||
        displacementActive ||
        colorDirty;
      let stillDisplaced = false;

      if (needsParticleUpdate) {
        for (let i = 0; i < count; i++) {
          const bx = basePositions[i * 3];
          const by = basePositions[i * 3 + 1];
          const bz = basePositions[i * 3 + 2];

          const dotCam = bx * camLocalDir.x + by * camLocalDir.y + bz * camLocalDir.z;
          if (dotCam > 0 && contactActive) {
            const dotContact =
              bx * contactDir.x + by * contactDir.y + bz * contactDir.z;
            if (dotContact > cosRepulsion) {
              const influence = (dotContact - cosRepulsion) / (1 - cosRepulsion);
              displacement[i] +=
                influence * o.repulsionStrength * delta * 2.5;
            }
          }

          displacement[i] *= decay;
          if (displacement[i] < 0.0005) displacement[i] = 0;
          else stillDisplaced = true;

          // Both effects ride the particle's own radius, so it always returns
          // to its exact place on the Fibonacci surface.
          const r = 1 + displacement[i] + burstScale * burstAmplitude[i];

          if (dissolve > 0) {
            // Staggered break-up: each particle starts leaving at its own delay.
            const ti = smoothstep(
              clamp01((dissolve - scatterDelay[i]) / (1 - scatterDelay[i]))
            );
            drawPositions[i * 3] =
              bx * r + (scatterTargets[i * 3] - bx * r) * ti;
            drawPositions[i * 3 + 1] =
              by * r + (scatterTargets[i * 3 + 1] - by * r) * ti;
            drawPositions[i * 3 + 2] =
              bz * r + (scatterTargets[i * 3 + 2] - bz * r) * ti;

            // Additive blending: a darker vertex colour reads as a dimmer point,
            // which fades each particle on its own schedule.
            const fade = 1 - DISSOLVE_FADE * ti;
            drawColors[i * 3] = baseColor.r * fade;
            drawColors[i * 3 + 1] = baseColor.g * fade;
            drawColors[i * 3 + 2] = baseColor.b * fade;
          } else {
            drawPositions[i * 3] = bx * r;
            drawPositions[i * 3 + 1] = by * r;
            drawPositions[i * 3 + 2] = bz * r;
            drawColors[i * 3] = baseColor.r;
            drawColors[i * 3 + 1] = baseColor.g;
            drawColors[i * 3 + 2] = baseColor.b;
          }
        }

        displacementActive = stillDisplaced;
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
      }

      const scale = o.targetDiameterPx ? fittedScale : o.sphereScale;
      if (group.scale.x !== scale) group.scale.setScalar(scale);

      const opacity = o.opacity + (o.dissolveOpacity - o.opacity) * dissolve;
      if (material.opacity !== opacity) material.opacity = opacity;
      if (material.size !== o.particleSize) material.size = o.particleSize;
      camera.position.z = cameraBaseZ + dissolve * 0.8;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      triggers.forEach((t) => t.kill());
      resizeObserver.disconnect();
      dom.removeEventListener("pointerenter", onPointerEnter);
      dom.removeEventListener("pointerleave", onPointerLeave);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      geometry.dispose();
      material.dispose();
      material.map?.dispose();
      renderer.dispose();
      // Remounts (e.g. a particle-count change) would otherwise leak contexts
      // until the browser evicts the oldest one and blanks an earlier canvas.
      renderer.forceContextLoss();
      container!.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={props.className}
      style={{ touchAction: "pan-y pinch-zoom" }}
      aria-hidden="true"
    />
  );
}
