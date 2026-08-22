"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

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

    const count = clamp(
      Math.round(optsRef.current.particleCount),
      1000,
      12000
    );

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    const group = new THREE.Group();
    scene.add(group);

    const basePositions = fibonacciSphere(count);
    const drawPositions = new Float32Array(basePositions);
    const displacement = new Float32Array(count);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(drawPositions, 3)
    );

    const material = new THREE.PointsMaterial({
      size: optsRef.current.particleSize,
      map: createGlowTexture(),
      transparent: true,
      opacity: optsRef.current.opacity,
      color: new THREE.Color(optsRef.current.color),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    group.add(points);
    group.scale.setScalar(optsRef.current.sphereScale);

    // --- Interaction state ---
    const pointer = { ndc: new THREE.Vector2(0, 0), active: false };
    let hovering = false;
    let dragging = false;
    let dragLast = { x: 0, y: 0, t: 0 };
    const momentum = { x: 0, y: 0 };

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
        optsRef.current.sphereScale
      );
      if (!worldPoint) return null;
      invQuat.copy(group.quaternion).invert();
      return worldPoint
        .sub(group.position)
        .applyQuaternion(invQuat)
        .divideScalar(optsRef.current.sphereScale)
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
      renderer.domElement.setPointerCapture(e.pointerId);
      dragging = true;
      momentum.x = 0;
      momentum.y = 0;
      dragLast = { x: e.clientX, y: e.clientY, t: performance.now() };
      renderer.domElement.style.cursor = "grabbing";
      scatterBurstAt(toNDC(e.clientX, e.clientY));
    }
    function onPointerUp(e: PointerEvent) {
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
    function handleResize() {
      const width = container!.clientWidth;
      const height = container!.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    // --- Animation loop ---
    const clock = new THREE.Clock();
    let frameId = 0;

    function animate() {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const o = optsRef.current;

      if (dragging) {
        // rotation already applied directly in onPointerMove
      } else if (Math.abs(momentum.x) + Math.abs(momentum.y) > 0.0002) {
        group.rotation.y += momentum.x;
        group.rotation.x = clamp(group.rotation.x + momentum.y, -1.2, 1.2);
        momentum.x *= 0.94;
        momentum.y *= 0.94;
      } else if (!(o.pauseOnHover && hovering)) {
        group.rotation.y += o.rotationSpeed * o.rotationDirection * delta;
      }

      let contactActive = false;
      if (pointer.active) {
        const dir = computeContactDir(pointer.ndc);
        if (dir) {
          contactDir.copy(dir);
          contactActive = true;
        }
      }

      invQuat.copy(group.quaternion).invert();
      camLocalDir
        .copy(camera.position)
        .sub(group.position)
        .applyQuaternion(invQuat)
        .normalize();

      const cosRepulsion = Math.cos(o.repulsionRadius);
      const decay = Math.pow(0.001, delta);

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

        const r = 1 + displacement[i];
        drawPositions[i * 3] = bx * r;
        drawPositions[i * 3 + 1] = by * r;
        drawPositions[i * 3 + 2] = bz * r;
      }
      geometry.attributes.position.needsUpdate = true;

      if (group.scale.x !== o.sphereScale) {
        group.scale.setScalar(o.sphereScale);
      }
      if (material.opacity !== o.opacity) material.opacity = o.opacity;
      if (material.size !== o.particleSize) material.size = o.particleSize;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
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
      container!.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={props.className}
      style={{ touchAction: "none" }}
      aria-hidden="true"
    />
  );
}
