"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({ title, subtitle, children, onClose, wide = false, className = "" }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const focusable = () => Array.from(node?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select, [tabindex="0"]') ?? []);
    const timer = setTimeout(() => { const target = node?.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0]; target?.focus(); }, 40);
    const keydown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "Tab") { const all = focusable(); const first = all[0], last = all[all.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } };
    document.addEventListener("keydown", keydown);
    return () => { clearTimeout(timer); document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`modal-panel ${wide ? "modal-wide" : ""} ${className}`} ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={19} /></button><div className="modal-heading"><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div></div>;
}
