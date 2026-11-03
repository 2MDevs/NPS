import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../services/theme';

/** Logo oficial: no fundo grafite usa o arquivo "escuro" (letras creme), no fundo claro o arquivo "claro" (letras grafite) */
export const HummmLogo: React.FC<{ className?: string; onDark?: boolean }> = ({ className = 'h-10 w-auto', onDark }) => {
  const { theme } = useTheme();
  const dark = onDark ?? theme === 'dark';
  return (
    <img
      src={dark ? '/brand/hummm-logo-escuro.svg' : '/brand/hummm-logo-claro.svg'}
      alt="hummm! Pizzas"
      className={className}
      draggable={false}
    />
  );
};

export const Card: React.FC<{ className?: string; children: React.ReactNode; title?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }> = ({
  className = '',
  children,
  title,
  icon,
  action,
}) => (
  <section className={`nps-card p-5 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="flex items-center gap-2 text-[17px] font-bold">
          {icon && <span className="text-[var(--nps-accent)]">{icon}</span>}
          {title}
        </h3>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const PageHeader: React.FC<{ eyebrow?: string; title: string; subtitle?: string; right?: React.ReactNode }> = ({ eyebrow = 'NPS Franqueados', title, subtitle, right }) => (
  <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
    <div className="min-w-0">
      <div className="nps-eyebrow">{eyebrow}</div>
      <h1 className="nps-title text-[30px] sm:text-[38px] leading-tight">{title}</h1>
      {subtitle && <p className="nps-muted text-[15px] mt-1">{subtitle}</p>}
    </div>
    {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
  </div>
);

export const Delta: React.FC<{ value: number | null | undefined; suffix?: string; invert?: boolean; label?: string }> = ({ value, suffix = '', invert, label }) => {
  if (value === null || value === undefined || Number.isNaN(value)) return <span className="text-[13px] opacity-70">Sem período anterior para comparar</span>;
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className="text-[14px] font-semibold" style={{ color: value === 0 ? 'inherit' : good ? 'var(--nps-green)' : 'var(--nps-red)' }}>
      {value > 0 ? '↑ +' : value < 0 ? '↓ ' : ''}
      {value}
      {suffix}
      {label && <span className="font-normal opacity-80"> {label}</span>}
    </span>
  );
};

/** Velocímetro do NPS (−100 a 100) em três faixas: vermelho, laranja/amarelo e verde */
export const Gauge: React.FC<{ value: number | null; size?: number }> = ({ value, size = 170 }) => {
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h - 6;
  const r = w / 2 - 14;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [cx + r * Math.cos(Math.PI * (1 - a)), cy - r * Math.sin(Math.PI * (1 - a))];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const t = value === null ? 0.5 : (Math.max(-100, Math.min(100, value)) + 100) / 200;
  const angle = Math.PI * (1 - t);
  const nx = cx + (r - 18) * Math.cos(angle);
  const ny = cy - (r - 18) * Math.sin(angle);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={arc(0, 0.5)} stroke="#ea3324" strokeWidth={16} fill="none" strokeLinecap="round" />
      <path d={arc(0.5, 0.75)} stroke="#f08c2e" strokeWidth={16} fill="none" />
      <path d={arc(0.75, 1)} stroke="#34a853" strokeWidth={16} fill="none" strokeLinecap="round" />
      {value !== null && (
        <>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1d1d1b" strokeWidth={4} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={6} fill="#1d1d1b" />
        </>
      )}
    </svg>
  );
};

/** Gráfico de linha simples (evolução do NPS no período) */
export const LineChart: React.FC<{ points: Array<{ label: string; value: number | null; hint?: string }>; min?: number; max?: number; height?: number }> = ({
  points,
  min = -100,
  max = 100,
  height = 230,
}) => {
  const W = 640;
  const H = height;
  const pad = { l: 40, r: 18, t: 22, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const ticks = [min, min + (max - min) * 0.25, min + (max - min) * 0.5, min + (max - min) * 0.75, max].map((v) => Math.round(v));
  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as Array<{ label: string; value: number; i: number; hint?: string }>;
  const line = valid.map((p, k) => `${k ? 'L' : 'M'} ${x(p.i)} ${y(p.value)}`).join(' ');
  const area = valid.length > 1 ? `${line} L ${x(valid[valid.length - 1].i)} ${y(min)} L ${x(valid[0].i)} ${y(min)} Z` : '';
  const last = valid[valid.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolução do NPS">
      <defs>
        <linearGradient id="npsArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f6d35c" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#f6d35c" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--nps-border)" strokeWidth={1} />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--nps-muted)">
            {t}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--nps-muted)">
          {p.label}
        </text>
      ))}
      {area && <path d={area} fill="url(#npsArea)" />}
      {line && <path d={line} fill="none" stroke="#f6d35c" strokeWidth={3} strokeLinejoin="round" />}
      {valid.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.value)} r={5} fill="#f6d35c">
          <title>{`${p.label}: NPS ${p.value}${p.hint ? ` (${p.hint})` : ''}`}</title>
        </circle>
      ))}
      {last && (
        <g>
          <rect x={x(last.i) - 22} y={y(last.value) - 40} width={44} height={28} rx={8} fill="#ffffff" />
          <text x={x(last.i)} y={y(last.value) - 20} textAnchor="middle" fontSize={15} fontWeight={700} fill="#1d1d1b">
            {last.value}
          </text>
          <circle cx={x(last.i)} cy={y(last.value)} r={6} fill="#ffffff" stroke="#f6d35c" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
};

export const BarRow: React.FC<{ label: React.ReactNode; value: number; max: number; color: string; display?: React.ReactNode; labelWidth?: string }> = ({
  label,
  value,
  max,
  color,
  display,
  labelWidth = 'w-[44%]',
}) => (
  <div className="flex items-center gap-3 py-1.5">
    <div className={`${labelWidth} text-[14px] truncate`}>{label}</div>
    <div className="flex-1 h-3.5 rounded-full bg-[var(--nps-track)] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
    </div>
    <div className="w-12 text-right font-bold text-[15px]">{display ?? value}</div>
  </div>
);

export const Modal: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }> = ({
  title,
  onClose,
  children,
  wide,
  footer,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`nps-card w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[92dvh] flex flex-col rounded-b-none sm:rounded-[18px]`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--nps-border)]">
          <h3 className="text-[18px] font-bold">{title}</h3>
          <button type="button" className="nps-btn nps-btn-ghost nps-btn-sm" onClick={onClose} aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-[var(--nps-border)] flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export const Empty: React.FC<{ title: string; text?: string; action?: React.ReactNode }> = ({ title, text, action }) => (
  <div className="text-center py-10 px-4">
    <div className="text-[16px] font-semibold">{title}</div>
    {text && <p className="nps-muted text-[14px] mt-1 max-w-md mx-auto">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Loading: React.FC = () => (
  <div className="py-16 flex items-center justify-center nps-muted text-[14px]">
    <span className="w-5 h-5 mr-3 rounded-full border-2 border-[var(--nps-yellow)] border-t-transparent animate-spin" /> Carregando…
  </div>
);

export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="nps-card p-4 border-[var(--nps-red)] flex items-center justify-between gap-3 text-[14px]">
    <span>{message}</span>
    {onRetry && (
      <button type="button" className="nps-btn nps-btn-ghost nps-btn-sm" onClick={onRetry}>
        Tentar de novo
      </button>
    )}
  </div>
);

export const CategoryBadge: React.FC<{ category: 'detrator' | 'neutro' | 'promotor' | null | undefined; score?: number | null }> = ({ category, score }) => {
  if (!category) return <span className="nps-muted">—</span>;
  const map = {
    promotor: { bg: 'color-mix(in srgb, #34a853 18%, transparent)', fg: '#34a853', label: 'Promotor' },
    neutro: { bg: 'color-mix(in srgb, #f6d35c 25%, transparent)', fg: 'var(--nps-text)', label: 'Neutro' },
    detrator: { bg: 'color-mix(in srgb, #ea3324 18%, transparent)', fg: '#ea3324', label: 'Detrator' },
  }[category];
  return (
    <span className="nps-badge" style={{ background: map.bg, color: map.fg }}>
      {score !== undefined && score !== null && <strong>{score}</strong>} {map.label}
    </span>
  );
};

export const Toast: React.FC<{ message: string | null; onDone: () => void }> = ({ message, onDone }) => {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[90] bg-[#1d1d1b] text-white px-4 py-3 rounded-xl shadow-2xl text-[14px] max-w-[92vw]">
      {message}
    </div>
  );
};

/** "COMUNICAÇÃO E ACOMPANHAMENTO" → "Comunicação e acompanhamento" */
export const sentence = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t);
