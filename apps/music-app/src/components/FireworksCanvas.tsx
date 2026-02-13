import { useEffect, useRef } from "react";
import { Platform } from "react-native";

type Rocket = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  hue: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  radius: number;
  hue: number;
};

const MAX_ROCKETS = 4;
const GRAVITY = 0.055;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export default function FireworksCanvas() {
  const animationRef = useRef<number | null>(null);
  const rocketsRef = useRef<Rocket[]>([]);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const windowAny = globalThis as any;
    const documentAny = windowAny.document as any;
    if (!documentAny?.body) {
      return;
    }

    const layer = documentAny.createElement("div");
    layer.setAttribute("data-fireworks-layer", "true");
    layer.style.position = "fixed";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "2";

    const canvas = documentAny.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.opacity = "0.7";
    layer.appendChild(canvas);
    documentAny.body.appendChild(layer);

    const context = canvas.getContext("2d");
    if (!context) {
      layer.remove();
      return;
    }

    const dpr = Math.max(1, windowAny.devicePixelRatio || 1);

    const resize = () => {
      const width = windowAny.innerWidth || 1280;
      const height = windowAny.innerHeight || 720;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnRocket = () => {
      if (rocketsRef.current.length >= MAX_ROCKETS) {
        return;
      }
      const width = windowAny.innerWidth || 1280;
      const height = windowAny.innerHeight || 720;
      rocketsRef.current.push({
        x: randomBetween(width * 0.1, width * 0.9),
        y: height + randomBetween(10, 50),
        vx: randomBetween(-0.65, 0.65),
        vy: randomBetween(-8.4, -6.6),
        targetY: randomBetween(height * 0.18, height * 0.55),
        hue: randomBetween(20, 58)
      });
    };

    const explode = (rocket: Rocket) => {
      const count = Math.floor(randomBetween(24, 42));
      for (let i = 0; i < count; i += 1) {
        const angle = randomBetween(0, Math.PI * 2);
        const speed = randomBetween(1.3, 4.3);
        sparksRef.current.push({
          x: rocket.x,
          y: rocket.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: randomBetween(0.68, 1.15),
          radius: randomBetween(1.1, 2.8),
          hue: rocket.hue + randomBetween(-10, 10)
        });
      }
    };

    const render = () => {
      const width = windowAny.innerWidth || 1280;
      const height = windowAny.innerHeight || 720;

      context.fillStyle = "rgba(20, 4, 6, 0.17)";
      context.fillRect(0, 0, width, height);

      if (Math.random() < 0.12) {
        spawnRocket();
      }

      rocketsRef.current = rocketsRef.current.filter((rocket) => {
        rocket.x += rocket.vx;
        rocket.y += rocket.vy;
        rocket.vy += 0.04;

        context.beginPath();
        context.arc(rocket.x, rocket.y, 2.1, 0, Math.PI * 2);
        context.fillStyle = `hsla(${rocket.hue}, 92%, 66%, 0.95)`;
        context.fill();

        if (rocket.y <= rocket.targetY || rocket.vy >= -0.35) {
          explode(rocket);
          return false;
        }
        return true;
      });

      sparksRef.current = sparksRef.current.filter((spark) => {
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += GRAVITY;
        spark.vx *= 0.992;
        spark.life -= 0.012;

        if (spark.life <= 0) {
          return false;
        }

        context.beginPath();
        context.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
        context.fillStyle = `hsla(${spark.hue}, 96%, 70%, ${Math.max(0, spark.life)})`;
        context.fill();
        return true;
      });

      animationRef.current = windowAny.requestAnimationFrame(render);
    };

    resize();
    windowAny.addEventListener("resize", resize);
    animationRef.current = windowAny.requestAnimationFrame(render);

    return () => {
      windowAny.removeEventListener("resize", resize);
      if (animationRef.current !== null) {
        windowAny.cancelAnimationFrame(animationRef.current);
      }
      layer.remove();
    };
  }, []);

  return null;
}

