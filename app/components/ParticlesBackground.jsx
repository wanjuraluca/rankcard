"use client";

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export default function ParticlesBackground() {

const [ready, setReady] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
        await loadSlim(engine);
        }).then(() => {
        setReady(true);
        });
        }, []);
  
        if (!ready) {
    return null;
  }

  return (
    <Particles
      id="tsparticles"
      options={{
        fullScreen: { enable: true, zIndex: 0 },
        background: { color: "transparent" },
        fpsLimit: 60,
        particles: {
          color: { value: "#b16cff" },
          links: {
            color: "#b16cff",
            distance: 150,
            enable: true,
            opacity: 0.3,
            width: 1,
          },
          move: {
            enable: true,
            speed: 1,
          },
          number: {
            value: 60,
          },
          opacity: {
            value: 0.5,
          },
          size: {
            value: 2,
          },
        },
      }}

    />
  );

}