export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true"><path d="M20 2.5c3.7 0 6.3 8.8 6.3 11.2 2.4 0 11.2 2.6 11.2 6.3s-8.8 6.3-11.2 6.3c0 2.4-2.6 11.2-6.3 11.2s-6.3-8.8-6.3-11.2C11.3 26.3 2.5 23.7 2.5 20s8.8-6.3 11.2-6.3C13.7 11.3 16.3 2.5 20 2.5Z" fill="currentColor"/><path d="m20 12.5 2.2 5.3 5.3 2.2-5.3 2.2-2.2 5.3-2.2-5.3-5.3-2.2 5.3-2.2 2.2-5.3Z" fill="var(--brand-cutout, #101015)"/></svg>;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><BrandMark size={32} /><span>Farhan<span className="brand-gpt">GPT</span></span>{!compact && <span className="brand-period">.</span>}</span>;
}
