"use client";
import { useEffect, useRef } from "react";
export function AmbientBackground({ animated }: { animated: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    let width = 0, height = 0, frame = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const particles = Array.from({ length: 65 }, (_, i) => ({ x: ((i * 137.508) % 997) / 997, y: ((i * 79.321) % 953) / 953, size: i % 7 === 0 ? 1.2 : .65, phase: i * .7 }));
    const resize = () => { width = element.clientWidth; height = element.clientHeight; const dpr = Math.min(window.devicePixelRatio, 2); element.width = width * dpr; element.height = height * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const move = (event: PointerEvent) => { const rect = element.getBoundingClientRect(); mouse.tx = (event.clientX - rect.left - width / 2) / Math.max(width, 1); mouse.ty = (event.clientY - rect.top - height / 2) / Math.max(height, 1); root.current?.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`); root.current?.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`); };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !animated;
    const draw = (time: number) => { context.clearRect(0, 0, width, height); mouse.x += (mouse.tx - mouse.x) * .035; mouse.y += (mouse.ty - mouse.y) * .035; for (const p of particles) { const alpha = reduced ? .2 : .14 + (Math.sin(time * .0006 + p.phase) + 1) * .10; context.beginPath(); context.arc(p.x * width + (reduced ? 0 : mouse.x * (p.size * 24)), p.y * height + (reduced ? 0 : mouse.y * (p.size * 24)), p.size, 0, Math.PI * 2); context.fillStyle = `rgba(178,160,218,${alpha})`; context.fill(); } if (!reduced) frame = requestAnimationFrame(draw); };
    resize(); draw(0); window.addEventListener("resize", resize); if (!reduced) window.addEventListener("pointermove", move);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); };
  }, [animated]);
  return <div ref={root} className={`ambient-background ${animated ? "is-animated" : ""}`} aria-hidden="true"><div className="ambient-halo" /><div className="cursor-halo" /><canvas ref={canvas} /></div>;
}
