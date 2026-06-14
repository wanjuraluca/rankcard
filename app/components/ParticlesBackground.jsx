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
      className="absolute inset-0 -z-0"
      options={{
        fullScreen: { enable: false },
        background: { color: "transparent" },
        fpsLimit: 60,
        particles: {
          color: { value: "#b16cff" },
          links: {
            color: "#b16cff",
            distance: 160,
            enable: true,
            opacity: 0.3,
            width: 1.5,
          },
          move: {
            enable: true,
            speed: 0.45,
          },
          number: {
            value: 160,
          },
          opacity: {
            value: 0.5,
          },
          size: {
            value: 2,
          },
        },
        interactivity: {
            events:  {
                onHover: {
                    enable: true,
                    mode: "grab",
                },
            },
            modes: {
                grab: {
                    distance: 130,
                    links: {
                        opacity: 1,
                    },
                },
            },
        },
      }}

    />
  );

}