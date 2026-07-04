

import { useMemo } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
}

export function JarvisParticles({ count = 40 }: { count?: number }) {
  // Math.random() is intentionally used for non-deterministic particle placement.
   
  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 2.5, // 2-4.5px
        opacity: 0.1 + Math.random() * 0.3, // 10-40%
        duration: 12 + Math.random() * 18, // 12-30s float up
        delay: Math.random() * -20, // stagger
        drift: -15 + Math.random() * 30, // horizontal drift in px
      });
    }
    return arr;
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: "oklch(0.85 0.19 193)",
            opacity: p.opacity,
            animation: `jarvis-particle-float ${p.duration}s linear ${p.delay}s infinite`,
            // --drift is used in the keyframe
            ["--particle-drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}