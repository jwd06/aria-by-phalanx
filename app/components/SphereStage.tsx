import ParticleSphere from "./ParticleSphere";
import { SPHERE_BASE_CONFIG } from "./sphereConfig";

export default function SphereStage({ className }: { className?: string }) {
  return (
    <ParticleSphere
      {...SPHERE_BASE_CONFIG}
      className={className}
      scrollTarget="#hero"
    />
  );
}
