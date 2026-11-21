/**
 * Small dependency-free SVG charts for the ticket summary page.
 * Colours come from the dc-ui.css tokens so both portals match.
 */
import React, { useMemo, useState } from 'react';

export const TONE_VAR = {
    teal: 'var(--dc-primary)',
    blue: 'var(--dc-blue)',
    amber: 'var(--dc-amber)',
    red: 'var(--dc-red)',
    green: 'var(--dc-green)',
    violet: 'var(--dc-violet)',
    gray: '#9ca3af',
};

/** A "nice" axis maximum (1, 2, 5 × 10^n) and its tick values. */
function niceScale(max, ticks = 4) {
    if (max <= 0) return { max: ticks, values: [...Array(ticks + 1).keys()] };
    const raw = max / ticks;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw);
    const top = Math.ceil(max / step) * step;
    const values = [];
    for (let v = 0; v <= top + 1e-9; v += step) values.push(Math.round(v * 100) / 100);
    return { max: top, values };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-16" -> "Nov 16", "2026-11" -> "Nov 2026". */
export function bucketLabel(key, bucket, long = false) {
    const [y, m, d] = key.split('-').map(Number);
    if (bucket === 'month') return `${MONTHS[m - 1]}${long ? ` ${y}` : ` '${String(y).slice(2)}`}`;
    const label = `${MONTHS[m - 1]} ${d}`;
    return bucket === 'week' && long ? `Week of ${label}` : label;
}

/**
 * Bars for files created, a line for files released, hover for details.
 * data: [{ key, created, released, containers }]
 */
export function TrendChart({ data, bucket, height = 240, noun = 'Files' }) {
    const [hover, setHover] = useState(null);
    const W = 720;
    const H = height;
    const pad = { l: 34, r: 12, t: 14, b: 30 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const scale = useMemo(() => niceScale(Math.max(1, ...data.map((d) => Math.max(d.created, d.released)))), [data]);
    const n = Math.max(1, data.length);
    const slot = innerW / n;
    const barW = Math.max(2, Math.min(28, slot * 0.62));
    const y = (v) => pad.t + innerH - (v / scale.max) * innerH;
    const x = (i) => pad.l + slot * i + slot / 2;
    const every = Math.ceil(n / 8);
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.released).toFixed(1)}`).join(' ');
    const h = hover != null ? data[hover] : null;

    const onMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * W;
        const i = Math.floor((px - pad.l) / slot);
        setHover(i >= 0 && i < n ? i : null);
    };

    return (
        <div className="dc-chart">
            <div className="dc-legend">
                <span><i style={{ background: TONE_VAR.teal }} /> {noun} created</span>
                <span><i className="line" style={{ background: TONE_VAR.violet }} /> Released by CBSA</span>
            </div>
            <div className="dc-chart-box">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Files created and released over time"
                    onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ height: H }}>
                    {scale.values.map((v) => (
                        <g key={v}>
                            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--dc-line)" strokeDasharray={v ? '3 4' : ''} />
                            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="dc-axis">{v}</text>
                        </g>
                    ))}
                    {hover != null && <rect x={pad.l + slot * hover} y={pad.t} width={slot} height={innerH} fill="rgba(43,179,167,.07)" />}
                    {data.map((d, i) => (
                        <rect key={d.key} x={x(i) - barW / 2} y={y(d.created)} width={barW} height={Math.max(0, pad.t + innerH - y(d.created))}
                            rx={Math.min(4, barW / 3)} fill={TONE_VAR.teal} opacity={hover == null || hover === i ? 1 : 0.55} />
                    ))}
                    <path d={line} fill="none" stroke={TONE_VAR.violet} strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                    {data.map((d, i) => (n <= 40 || hover === i) && (
                        <circle key={d.key} cx={x(i)} cy={y(d.released)} r={hover === i ? 4.5 : 2.5} fill="#fff" stroke={TONE_VAR.violet} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    ))}
                    {data.map((d, i) => i % every === 0 && (
                        <text key={d.key} x={x(i)} y={H - 10} textAnchor="middle" className="dc-axis">{bucketLabel(d.key, bucket)}</text>
                    ))}
                </svg>
                {h && (
                    <div className="dc-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
                        <b>{bucketLabel(h.key, bucket, true)}</b>
                        <div><i style={{ background: TONE_VAR.teal }} /> {h.created} created · {h.containers} containers</div>
                        <div><i style={{ background: TONE_VAR.violet }} /> {h.released} released</div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** One horizontal bar split by stage. items: [{ key, label, count, tone }] */
export function StackedBar({ items, onSelect }) {
    const total = items.reduce((s, i) => s + i.count, 0);
    if (!total) return null;
    return (
        <div>
            <div className="dc-stack">
                {items.map((i) => (
                    <div key={i.key} title={`${i.label}: ${i.count}`} style={{ flexGrow: i.count, background: TONE_VAR[i.tone] || TONE_VAR.gray }} />
                ))}
            </div>
            <ul className="dc-stack-legend">
                {items.map((i) => (
                    <li key={i.key} className={onSelect ? 'clickable' : ''} onClick={onSelect ? () => onSelect(i) : undefined}>
                        <i style={{ background: TONE_VAR[i.tone] || TONE_VAR.gray }} />
                        <span>{i.label}</span>
                        <b>{i.count}</b>
                        <span className="dc-muted">{Math.round((i.count / total) * 100)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Label, bar and number per row. items: [{ key, label, count, tone?, hint? }] */
export function BarList({ items, empty = 'No data yet.', tone = 'teal', onSelect }) {
    const max = Math.max(1, ...items.map((i) => i.count));
    if (!items.length || !items.some((i) => i.count)) return <div className="dc-muted dc-small" style={{ padding: '6px 0' }}>{empty}</div>;
    return (
        <ul className="dc-barlist">
            {items.map((i) => (
                <li key={i.key} className={onSelect ? 'clickable' : ''} onClick={onSelect ? () => onSelect(i) : undefined}>
                    <div className="dc-barlist-top">
                        <span className="dc-truncate">{i.label}</span>
                        <b>{i.count}</b>
                    </div>
                    <div className="dc-barlist-track">
                        <div style={{ width: `${(i.count / max) * 100}%`, background: TONE_VAR[i.tone || tone] }} />
                    </div>
                    {i.hint && <div className="dc-small dc-muted">{i.hint}</div>}
                </li>
            ))}
        </ul>
    );
}

/** Donut with a number in the middle. parts: [{ key, label, count, tone }] */
export function Donut({ parts, size = 132, label }) {
    const total = parts.reduce((s, p) => s + p.count, 0);
    const r = 52;
    const c = 2 * Math.PI * r;
    let offset = 0;
    return (
        <div className="dc-donut">
            <svg viewBox="0 0 132 132" width={size} height={size} role="img" aria-label={label}>
                <circle cx="66" cy="66" r={r} fill="none" stroke="var(--dc-gray-soft)" strokeWidth="16" />
                {total > 0 && parts.filter((p) => p.count).map((p) => {
                    const len = (p.count / total) * c;
                    const el = (
                        <circle key={p.key} cx="66" cy="66" r={r} fill="none" stroke={TONE_VAR[p.tone]} strokeWidth="16"
                            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 66 66)" />
                    );
                    offset += len;
                    return el;
                })}
                <text x="66" y="64" textAnchor="middle" className="dc-donut-value">{total}</text>
                <text x="66" y="82" textAnchor="middle" className="dc-axis">{label}</text>
            </svg>
            <ul className="dc-stack-legend">
                {parts.map((p) => (
                    <li key={p.key}>
                        <i style={{ background: TONE_VAR[p.tone] }} />
                        <span>{p.label}</span>
                        <b>{p.count}</b>
                        <span className="dc-muted">{total ? Math.round((p.count / total) * 100) : 0}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
