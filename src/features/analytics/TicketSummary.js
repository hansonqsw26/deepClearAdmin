/**
 * Ticket summary: volumes, speed, exams, missing documents and plain-language
 * highlights for a chosen period. Admins can look at every client or one;
 * clients see their own shipments. Data: POST /<role>/ticketSummary.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, Page, Spinner, Tabs, formatDate, useToast } from '../../ui/components';
import { call, customsApi, IS_ADMIN } from '../customsTickets/customs.api';
import { STAGE_TONE, TRANSPORT_LABELS, countryName } from '../customsTickets/customsMeta';
import { StageBadge } from '../customsTickets/CustomsBits';
import { BarList, Donut, StackedBar, TrendChart } from './charts';
import './analytics.css';

const DAY = 864e5;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Quick periods, worked out from today in the viewer's time zone. */
const PRESETS = [
    { key: '7d', label: '7 days', range: (t) => [new Date(t - 6 * DAY), t] },
    { key: '30d', label: '30 days', range: (t) => [new Date(t - 29 * DAY), t] },
    { key: '90d', label: '90 days', range: (t) => [new Date(t - 89 * DAY), t] },
    { key: 'month', label: 'This month', range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), t] },
    { key: 'last-month', label: 'Last month', range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)] },
    { key: 'ytd', label: 'This year', range: (t) => [new Date(t.getFullYear(), 0, 1), t] },
    { key: '12m', label: '12 months', range: (t) => [new Date(t.getFullYear() - 1, t.getMonth(), t.getDate() + 1), t] },
];

function rangeFor(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const p = PRESETS.find((x) => x.key === preset) || PRESETS[1];
    return p.range(today).map(iso);
}

function hours(h) {
    if (h == null) return '—';
    if (h < 48) return `${Math.round(h)} h`;
    return `${Math.round((h / 24) * 10) / 10} d`;
}

const pctText = (v) => (v == null ? '—' : `${v}%`);
const word = IS_ADMIN ? 'files' : 'shipments';

/** CSV download built in the browser. */
function downloadCsv(name, columns, rows) {
    const esc = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Kpi({ icon, tone, label, value, sub, delta, invert, onClick }) {
    let deltaEl = null;
    if (delta != null) {
        const good = invert ? delta < 0 : delta > 0;
        deltaEl = (
            <span className={`dc-delta ${delta === 0 ? '' : good ? 'up' : 'down'}`}>
                <i className={`fa-solid ${delta > 0 ? 'fa-arrow-up' : delta < 0 ? 'fa-arrow-down' : 'fa-minus'}`} /> {Math.abs(delta)}%
            </span>
        );
    }
    return (
        <div className={`dc-card dc-kpi ${onClick ? 'link' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
            <div className="dc-kpi-top">
                <span className={`dc-kpi-icon dc-tone-${tone}`}><i className={icon} /></span>
                <span className="dc-kpi-label">{label}</span>
            </div>
            <div className="dc-kpi-value">{value}{deltaEl}</div>
            {sub && <div className="dc-kpi-sub">{sub}</div>}
        </div>
    );
}

function Insights({ items, onOpen }) {
    return (
        <div className="dc-insights">
            {items.map((i) => (
                <button type="button" key={i.title} className={`dc-insight dc-insight-${i.tone} ${i.filter ? 'link' : ''}`}
                    onClick={i.filter ? () => onOpen(i.filter) : undefined} tabIndex={i.filter ? 0 : -1}>
                    <span className={`dc-insight-icon dc-tone-${i.tone}`}><i className={i.icon} /></span>
                    <span className="dc-insight-text">
                        <b>{i.title}</b>
                        <span>{i.detail}</span>
                    </span>
                    {i.filter && <i className="fa-solid fa-chevron-right dc-muted" />}
                </button>
            ))}
        </div>
    );
}

function WatchList({ rows, render, empty, onOpen }) {
    if (!rows.length) return <EmptyState icon="fa-regular fa-circle-check" title="Nothing here">{empty}</EmptyState>;
    return (
        <ul className="dc-list-plain">
            {rows.map((t) => (
                <li key={t.main_id} className="clickable" onClick={() => onOpen(t.main_id)} style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                        <div className="dc-strong">{t.reference_number}{IS_ADMIN && <span className="dc-muted dc-small"> · {t.client_name}</span>}</div>
                        <div className="dc-small dc-muted">{render(t)}</div>
                    </div>
                    <StageBadge stage={t.stage} label={t.stage_label} />
                </li>
            ))}
        </ul>
    );
}

const CLIENT_SORTS = {
    created: (a, b) => b.created - a.created,
    open: (a, b) => b.open - a.open,
    released: (a, b) => b.released - a.released,
    speed: (a, b) => (a.median_release_hours ?? 1e9) - (b.median_release_hours ?? 1e9),
    exams: (a, b) => b.exams - a.exams,
    missing: (a, b) => b.missing_docs - a.missing_docs,
    name: (a, b) => a.client_name.localeCompare(b.client_name),
};

function ClientsTable({ rows, onPick, period }) {
    const [sort, setSort] = useState('created');
    const sorted = useMemo(() => [...rows].sort(CLIENT_SORTS[sort]), [rows, sort]);
    const th = (key, label, align) => (
        <th onClick={() => setSort(key)} className={`dc-sortable ${sort === key ? 'active' : ''}`} style={align ? { textAlign: align } : undefined}>
            {label} {sort === key && <i className="fa-solid fa-arrow-down-short-wide" />}
        </th>
    );
    const exportCsv = () => downloadCsv(`deepclear-clients-${period.from}-to-${period.to}.csv`, [
        { label: 'Client', value: (r) => r.client_name },
        { label: 'Files created', value: (r) => r.created },
        { label: 'Previous period', value: (r) => r.prev_created },
        { label: 'Share %', value: (r) => r.share_pct },
        { label: 'Containers', value: (r) => r.containers },
        { label: 'Open now', value: (r) => r.open },
        { label: 'Need attention', value: (r) => r.attention },
        { label: 'Released in period', value: (r) => r.released },
        { label: 'Median hours to release', value: (r) => r.median_release_hours },
        { label: 'CBSA exams', value: (r) => r.exams },
        { label: 'Open files missing documents', value: (r) => r.missing_docs },
        { label: 'Self-service %', value: (r) => r.self_service_pct },
        { label: 'Last file', value: (r) => (r.last_created ? formatDate(r.last_created) : '') },
    ], sorted);

    return (
        <Card title="Tickets by client" sub="Who sent how many files in this period. Click a client to focus on them." tight
            actions={<Button variant="ghost" size="sm" icon="fa-solid fa-download" onClick={exportCsv} disabled={!rows.length}>CSV</Button>}>
            {rows.length === 0 ? (
                <EmptyState icon="fa-solid fa-building" title="No client activity in this period" />
            ) : (
                <div className="dc-table-wrap">
                    <table className="dc-table">
                        <thead>
                            <tr>
                                {th('name', 'Client')}
                                {th('created', 'Files')}
                                {th('open', 'Open')}
                                {th('released', 'Released')}
                                {th('speed', 'Median release')}
                                {th('exams', 'Exams')}
                                {th('missing', 'Missing docs')}
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r) => {
                                const change = r.prev_created ? Math.round(((r.created - r.prev_created) / r.prev_created) * 100) : null;
                                return (
                                    <tr key={r.client_id} className="clickable" onClick={() => onPick(r.client_id)}>
                                        <td className="dc-td-head" data-label="Client">
                                            <div className="dc-strong">{r.client_name}</div>
                                            <div className="dc-share"><div style={{ width: `${r.share_pct || 0}%` }} /></div>
                                        </td>
                                        <td data-label="Files">
                                            <b>{r.created}</b>
                                            <span className="dc-small dc-muted"> {r.share_pct != null ? `· ${r.share_pct}%` : ''}</span>
                                            {change != null && change !== 0 && (
                                                <span className={`dc-delta small ${change > 0 ? 'up' : 'down'}`}>{change > 0 ? '+' : ''}{change}%</span>
                                            )}
                                            {r.created === 0 && r.prev_created > 0 && <Badge tone="amber">Quiet</Badge>}
                                        </td>
                                        <td data-label="Open">{r.open}{r.attention > 0 && <Badge tone="red">{r.attention} need attention</Badge>}</td>
                                        <td data-label="Released">{r.released}</td>
                                        <td data-label="Median release">{hours(r.median_release_hours)}</td>
                                        <td data-label="Exams">{r.exams || <span className="dc-muted">0</span>}</td>
                                        <td data-label="Missing docs">{r.missing_docs ? <Badge tone="amber">{r.missing_docs}</Badge> : <span className="dc-muted">0</span>}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

function FilesTable({ rows, truncated, period, onOpen }) {
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const per = 12;
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return s ? rows.filter((r) => [r.reference_number, r.client_name, r.stage_label, r.port_of_entry, r.created_by].some((v) => String(v || '').toLowerCase().includes(s))) : rows;
    }, [rows, q]);
    useEffect(() => setPage(1), [q, rows]);
    const pageRows = filtered.slice((page - 1) * per, page * per);
    const pages = Math.max(1, Math.ceil(filtered.length / per));

    const exportCsv = () => downloadCsv(`deepclear-${word}-${period.from}-to-${period.to}.csv`, [
        { label: 'Reference', value: (r) => r.reference_number },
        ...(IS_ADMIN ? [{ label: 'Client', value: (r) => r.client_name }] : []),
        { label: 'Created', value: (r) => formatDate(r.create_date, true) },
        { label: 'Created by', value: (r) => r.created_by },
        { label: 'Stage', value: (r) => r.stage_label },
        { label: 'Mode', value: (r) => TRANSPORT_LABELS[r.transport_mode] || '' },
        { label: 'Origin', value: (r) => (r.origin_country ? countryName(r.origin_country) : '') },
        { label: 'Port of entry', value: (r) => r.port_of_entry },
        { label: 'Containers', value: (r) => r.containers },
        { label: 'Released', value: (r) => (r.released_at ? formatDate(r.released_at, true) : '') },
        { label: 'Hours to release', value: (r) => r.release_hours },
        { label: 'CBSA exam', value: (r) => (r.had_exam ? 'Yes' : '') },
        { label: 'Missing documents', value: (r) => r.missing_docs.join('; ') },
    ], filtered);

    return (
        <Card title={IS_ADMIN ? 'Files in this period' : 'Your shipments in this period'} tight
            actions={<Button variant="ghost" size="sm" icon="fa-solid fa-download" onClick={exportCsv} disabled={!rows.length}>CSV</Button>}>
            <div className="dc-toolbar">
                <div className="dc-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input className="dc-input" placeholder={IS_ADMIN ? 'Search reference, client, stage, port…' : 'Search reference, stage, port…'} value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <span className="dc-small dc-muted">{filtered.length} {word}{truncated ? ' (latest 500)' : ''}</span>
            </div>
            {pageRows.length === 0 ? (
                <EmptyState icon="fa-solid fa-ship" title={rows.length ? 'No match' : `No ${word} in this period`} />
            ) : (
                <div className="dc-table-wrap">
                    <table className="dc-table">
                        <thead>
                            <tr>
                                <th>Reference</th>
                                {IS_ADMIN && <th>Client</th>}
                                <th>Created</th>
                                <th>Stage</th>
                                <th>Route</th>
                                <th>Release time</th>
                                <th>Flags</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map((r) => (
                                <tr key={r.main_id} className="clickable" onClick={() => onOpen(r.main_id)}>
                                    <td className="dc-td-head" data-label="Reference"><span className="dc-strong">{r.reference_number}</span></td>
                                    {IS_ADMIN && <td data-label="Client">{r.client_name}</td>}
                                    <td data-label="Created">
                                        {formatDate(r.create_date)}
                                        <div className="dc-small dc-muted">{r.created_by}</div>
                                    </td>
                                    <td data-label="Stage"><StageBadge stage={r.stage} label={r.stage_label} /></td>
                                    <td data-label="Route">
                                        <span className="dc-small">
                                            {[r.origin_country && countryName(r.origin_country), r.port_of_entry].filter(Boolean).join(' → ') || '—'}
                                        </span>
                                        <div className="dc-small dc-muted">{TRANSPORT_LABELS[r.transport_mode] || ''}{r.containers ? ` · ${r.containers} cntr` : ''}</div>
                                    </td>
                                    <td data-label="Release time">{hours(r.release_hours)}</td>
                                    <td data-label="Flags">
                                        <span className="dc-flags">
                                            {r.had_exam && <Badge tone="red">Exam</Badge>}
                                            {r.missing_docs.length > 0 && <Badge tone="amber" title={r.missing_docs.join(', ')}>{r.missing_docs.length} doc{r.missing_docs.length > 1 ? 's' : ''} missing</Badge>}
                                            {!r.had_exam && !r.missing_docs.length && <span className="dc-muted">—</span>}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {pages > 1 && (
                <div className="dc-pager">
                    <span>Page {page} of {pages}</span>
                    <div className="dc-actions">
                        <Button variant="secondary" size="sm" icon="fa-solid fa-chevron-left" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page" />
                        <Button variant="secondary" size="sm" icon="fa-solid fa-chevron-right" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page" />
                    </div>
                </div>
            )}
        </Card>
    );
}

export default function TicketSummary() {
    const navigate = useNavigate();
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const preset = params.get('p') || (params.get('from') ? 'custom' : '30d');
    const [defFrom, defTo] = rangeFor(preset);
    const from = preset === 'custom' ? params.get('from') || defFrom : defFrom;
    const to = preset === 'custom' ? params.get('to') || defTo : defTo;
    const clientId = IS_ADMIN ? params.get('client') || '' : '';
    const mode = params.get('mode') || '';

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [clients, setClients] = useState([]);
    const [watchTab, setWatchTab] = useState('stuck');

    const update = (patch) => {
        const next = new URLSearchParams(params);
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
        setParams(next, { replace: true });
    };

    useEffect(() => {
        if (!IS_ADMIN) return;
        customsApi.clients().then((r) => setClients(r.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError('');
        call('/ticketSummary', { from, to, client_id: clientId || undefined, transport_mode: mode || undefined })
            .then((d) => alive && setData(d))
            .catch((e) => alive && setError(e.message))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, [from, to, clientId, mode]);

    const openFile = (mainId) => navigate(`/customs-ticket-details?main_id=${mainId}`);
    const openList = (filter) => navigate(`/customs-tickets-list?f=${filter}`);
    const clientName = clientId && (clients.find((c) => String(c.client_id) === String(clientId)) || {}).client_name;

    const k = data && data.kpis;
    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied. It opens this exact view.'), () => {});
    };

    return (
        <Page
            title="Ticket summary"
            subtitle={IS_ADMIN
                ? 'Volumes, speed and risks across your customs files. Pick a period and a client to drill in.'
                : 'How your shipments moved through customs, and what needs you.'}
            actions={(
                <>
                    <Button variant="ghost" icon="fa-solid fa-link" onClick={copyLink}>Share view</Button>
                    <Button icon="fa-solid fa-plus" onClick={() => navigate('/create-customs-ticket')}>{IS_ADMIN ? 'New customs file' : 'New shipment'}</Button>
                </>
            )}
        >
            <div className="dc-card dc-filterbar">
                <div className="dc-seg" role="tablist" aria-label="Period">
                    {PRESETS.map((p) => (
                        <button type="button" key={p.key} role="tab" aria-selected={preset === p.key} className={preset === p.key ? 'active' : ''}
                            onClick={() => update({ p: p.key === '30d' ? '' : p.key, from: '', to: '' })}>
                            {p.label}
                        </button>
                    ))}
                    <button type="button" role="tab" aria-selected={preset === 'custom'} className={preset === 'custom' ? 'active' : ''}
                        onClick={() => update({ p: 'custom', from, to })}>
                        <i className="fa-regular fa-calendar" /> Custom
                    </button>
                </div>
                <div className="dc-filter-fields">
                    {preset === 'custom' && (
                        <>
                            <input type="date" className="dc-input" aria-label="From" value={from} max={to} onChange={(e) => e.target.value && update({ p: 'custom', from: e.target.value, to })} />
                            <span className="dc-muted">to</span>
                            <input type="date" className="dc-input" aria-label="To" value={to} min={from} onChange={(e) => e.target.value && update({ p: 'custom', from, to: e.target.value })} />
                        </>
                    )}
                    {IS_ADMIN && (
                        <select className="dc-input" aria-label="Client" value={clientId} onChange={(e) => update({ client: e.target.value })}>
                            <option value="">All clients</option>
                            {clients.map((c) => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
                        </select>
                    )}
                    <select className="dc-input" aria-label="Transport" value={mode} onChange={(e) => update({ mode: e.target.value })}>
                        <option value="">All transport</option>
                        {Object.entries(TRANSPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                </div>
            </div>

            {(clientName || mode) && (
                <div className="dc-chips" style={{ padding: '0 0 14px' }}>
                    {clientName && <button type="button" className="dc-chip active" onClick={() => update({ client: '' })}>{clientName} <i className="fa-solid fa-xmark" /></button>}
                    {mode && <button type="button" className="dc-chip active" onClick={() => update({ mode: '' })}>{TRANSPORT_LABELS[mode]} <i className="fa-solid fa-xmark" /></button>}
                </div>
            )}

            {error && <div className="dc-alert dc-tone-red">{error}</div>}
            {!data && loading && <Spinner />}

            {data && (
                <div className={loading ? 'dc-refreshing' : ''}>
                    <div className="dc-period-note dc-small dc-muted">
                        {formatDate(`${data.period.from}T12:00:00`)} – {formatDate(`${data.period.to}T12:00:00`)} · {data.period.days} days, compared with the {data.period.days} days before
                    </div>

                    <div className="dc-grid dc-kpis">
                        <Kpi icon="fa-solid fa-folder-plus" tone="teal" label={IS_ADMIN ? 'Files created' : 'Shipments submitted'} value={k.created}
                            delta={k.created_change_pct} sub={`${k.prev_created} in the previous period`} />
                        <Kpi icon="fa-solid fa-box" tone="blue" label="Containers" value={k.containers} sub={k.created ? `${Math.round((k.containers / k.created) * 10) / 10} per ${IS_ADMIN ? 'file' : 'shipment'}` : 'No files yet'} />
                        <Kpi icon="fa-solid fa-circle-check" tone="green" label="Released by CBSA" value={k.released}
                            sub={k.released ? `${pctText(k.released_within_48h_pct)} within 48 h` : 'None in this period'} onClick={() => openList('released')} />
                        <Kpi icon="fa-solid fa-stopwatch" tone="violet" label="Median time to release" value={hours(k.median_release_hours)}
                            sub={k.avg_release_hours != null ? `Average ${hours(k.avg_release_hours)}` : 'From submission to CBSA release'} />
                        <Kpi icon="fa-solid fa-shield" tone={k.exam_rate_pct >= 10 ? 'red' : 'gray'} label="CBSA exams / holds" value={k.exams}
                            sub={k.created ? `${pctText(k.exam_rate_pct)} of ${word}` : '—'} />
                        <Kpi icon="fa-solid fa-triangle-exclamation" tone={k.attention_now ? 'amber' : 'gray'} label={IS_ADMIN ? 'Open · need attention' : 'Open · need you'}
                            value={<>{k.open_now}<span className={`dc-kpi-of ${k.attention_now ? '' : 'none'}`}> · {k.attention_now}</span></>}
                            sub={`${pctText(k.docs_complete_pct)} of open ${word} have all documents`} onClick={() => openList('attention')} />
                    </div>

                    <div className="dc-layout-main">
                        <div>
                            <Card title="Highlights" sub="Worked out from your numbers, most urgent first." tight>
                                <Insights items={data.insights} onOpen={openList} />
                            </Card>
                            <Card title={`${IS_ADMIN ? 'Files' : 'Shipments'} over time`} sub={`Per ${data.period.bucket}. Hover for details.`}>
                                <TrendChart data={data.trend} bucket={data.period.bucket} noun={IS_ADMIN ? 'Files' : 'Shipments'} />
                            </Card>
                        </div>
                        <div>
                            <Card title="Where they are now" sub={`Current stage of ${word} created in this period.`}>
                                {data.stages.length ? (
                                    <StackedBar items={data.stages.map((s) => ({ ...s, tone: STAGE_TONE[s.key] || 'gray' }))} />
                                ) : <div className="dc-muted dc-small">No {word} in this period.</div>}
                            </Card>
                            <Card title="Who created them">
                                <Donut label={word} parts={[
                                    { key: 'client', label: IS_ADMIN ? 'Clients (self-service)' : 'You', count: data.created_by.client, tone: 'teal' },
                                    { key: 'staff', label: IS_ADMIN ? 'DeepClear staff' : 'DeepClear team', count: data.created_by.staff, tone: 'violet' },
                                    ...(data.created_by.unknown ? [{ key: 'unknown', label: 'Before tracking', count: data.created_by.unknown, tone: 'gray' }] : []),
                                ]} />
                                {IS_ADMIN && data.creators.length > 0 && (
                                    <>
                                        <div className="dc-section-title" style={{ marginTop: 16 }}>Top creators</div>
                                        <BarList items={data.creators.slice(0, 6).map((c) => ({
                                            key: `${c.kind}-${c.name}`, label: c.name, count: c.count, tone: c.kind === 'client' ? 'teal' : c.kind === 'admin' ? 'violet' : 'gray',
                                            hint: c.kind === 'client' ? 'Client' : c.kind === 'admin' ? 'Staff' : undefined,
                                        }))} />
                                    </>
                                )}
                            </Card>
                        </div>
                    </div>

                    {IS_ADMIN && !clientId && <ClientsTable rows={data.clients} period={data.period} onPick={(id) => update({ client: String(id) })} />}

                    <div className="dc-grid dc-grid-3 dc-mix">
                        <Card title="Open work by age" sub={`How long open ${word} have been with us.`}>
                            <BarList items={data.aging.map((a, i) => ({ key: a.key, label: a.label, count: a.count, tone: ['green', 'teal', 'amber', 'red'][i] }))} empty={`No open ${word}.`} />
                        </Card>
                        <Card title="Transport" sub="Mode of transport.">
                            <BarList items={data.mix.transport_mode.map((m) => ({ key: m.key, label: TRANSPORT_LABELS[m.key] || (m.key === 'unknown' ? 'Not given' : 'Other'), count: m.count, tone: 'blue' }))}
                                onSelect={(i) => TRANSPORT_LABELS[i.key] && update({ mode: i.key })} />
                        </Card>
                        <Card title="Routes" sub="Top origins and ports of entry.">
                            <BarList items={data.mix.origin_country.slice(0, 4).map((m) => ({ key: m.key, label: m.key === 'other' ? 'Other countries' : countryName(m.key), count: m.count, tone: 'violet' }))} empty="No origins given." />
                            <div className="dc-divider" />
                            <BarList items={data.mix.port_of_entry.slice(0, 4).map((m) => ({ key: m.key, label: m.key === 'other' ? 'Other ports' : m.key, count: m.count, tone: 'teal' }))} empty="No ports given." />
                        </Card>
                    </div>

                    <Card title="Watch list" sub={`Open ${word} that need a push.`} tight className="dc-watch">
                        <Tabs
                            active={watchTab}
                            onChange={setWatchTab}
                            tabs={[
                                { key: 'stuck', label: 'No progress', count: data.stuck.length },
                                { key: 'docs', label: 'Missing documents', count: data.missing_docs.tickets.length },
                                ...(IS_ADMIN ? [{ key: 'cad', label: 'CAD accounting', count: data.accounting_due.length }] : []),
                            ]}
                        />
                        {watchTab === 'stuck' && (
                            <WatchList rows={data.stuck} onOpen={openFile} empty="Every open file moved in the last 5 days."
                                render={(t) => `No change for ${t.idle_days} days · open ${t.age_days} days`} />
                        )}
                        {watchTab === 'docs' && (
                            <>
                                <div className="dc-doc-chips">
                                    {data.missing_docs.by_type.map((d) => (
                                        <span key={d.key} className={`dc-badge dc-tone-${d.count ? 'amber' : 'green'}`}>{d.label}: {d.count ? `${d.count} missing` : 'all in'}</span>
                                    ))}
                                </div>
                                <WatchList rows={data.missing_docs.tickets} onOpen={openFile} empty="All open files have their required documents."
                                    render={(t) => `Missing: ${t.missing_docs.join(', ')}`} />
                            </>
                        )}
                        {watchTab === 'cad' && (
                            <WatchList rows={data.accounting_due} onOpen={openFile} empty="No released file is close to the accounting deadline."
                                render={(t) => `${t.business_days_since_release} business days since release${t.overdue ? ' · past the 5-day deadline' : ' · due now'}`} />
                        )}
                    </Card>

                    <FilesTable rows={data.tickets} truncated={data.tickets_truncated} period={data.period} onOpen={openFile} />
                </div>
            )}
        </Page>
    );
}

