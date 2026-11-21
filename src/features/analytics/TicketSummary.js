/**
 * Ticket summary: volumes, speed, exams, missing documents and plain-language
 * highlights for a chosen period. Admins can look at every client or one;
 * clients see their own shipments. Data: POST /<role>/ticketSummary.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { docName, stageName, t as tr, transportName } from '../../i18n';
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
    { key: '7d', range: (d) => [new Date(d - 6 * DAY), d] },
    { key: '30d', range: (d) => [new Date(d - 29 * DAY), d] },
    { key: '90d', range: (d) => [new Date(d - 89 * DAY), d] },
    { key: 'month', range: (d) => [new Date(d.getFullYear(), d.getMonth(), 1), d] },
    { key: 'last-month', range: (d) => [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 0)] },
    { key: 'ytd', range: (d) => [new Date(d.getFullYear(), 0, 1), d] },
    { key: '12m', range: (d) => [new Date(d.getFullYear() - 1, d.getMonth(), d.getDate() + 1), d] },
];

function rangeFor(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const p = PRESETS.find((x) => x.key === preset) || PRESETS[1];
    return p.range(today).map(iso);
}

function hours(h, long = false) {
    if (h == null) return '—';
    if (h < 48) return tr('common.hours', { n: Math.round(h) });
    return tr(long ? 'common.daysLong' : 'common.days', { n: Math.round((h / 24) * 10) / 10 });
}

const pctText = (v) => (v == null ? '—' : `${v}%`);
/** Admin/client wording: picks the ...Admin or ...Client variant of a key. */
const side = (key) => `${key}${IS_ADMIN ? 'Admin' : 'Client'}`;
const filesText = (count) => tr(IS_ADMIN ? 'common.files' : 'common.shipments', { count });
const nounPlural = () => tr(IS_ADMIN ? 'common.filesNoun' : 'common.shipmentsNoun');

/** Creator names the API writes in English for clients. */
const CREATOR_KEY = { You: 'summary.you', 'DeepClear team': 'summary.team', 'DeepClear staff': 'summary.staff', 'Before tracking started': 'summary.beforeTrackingStarted' };
const creatorName = (name) => (CREATOR_KEY[name] ? tr(CREATOR_KEY[name]) : name);
/** Missing document names for a row (keys from newer APIs, English labels from older ones). */
const missingList = (r) => (r.missing_doc_keys || r.missing_docs || []).map(docName);

/** Highlight text: translated by key and vars from the API, English as sent if the key is unknown. */
function insightText(i) {
    if (!i.key) return { title: i.title, detail: i.detail };
    const v = i.vars || {};
    const vars = {
        ...v,
        files: v.count != null ? filesText(v.count) : '',
        noun: nounPlural(),
        doc: v.doc ? docName(v.doc) : '',
        stage: v.stage ? stageName(v.stage) : '',
        time: v.hours != null ? hours(v.hours, true) : '',
    };
    const pick = (field) => {
        const keys = [`insight.${i.key}.${side(field)}`, `insight.${i.key}.${field}`];
        return tr(keys, { ...vars, defaultValue: i[field] });
    };
    return { title: pick('title'), detail: pick('detail') };
}

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
            {items.map((i) => ({ ...i, text: insightText(i) })).map((i) => (
                <button type="button" key={i.key || i.title} className={`dc-insight dc-insight-${i.tone} ${i.filter ? 'link' : ''}`}
                    onClick={i.filter ? () => onOpen(i.filter) : undefined} tabIndex={i.filter ? 0 : -1}>
                    <span className={`dc-insight-icon dc-tone-${i.tone}`}><i className={i.icon} /></span>
                    <span className="dc-insight-text">
                        <b>{i.text.title}</b>
                        <span>{i.text.detail}</span>
                    </span>
                    {i.filter && <i className="fa-solid fa-chevron-right dc-muted" />}
                </button>
            ))}
        </div>
    );
}

function WatchList({ rows, render, empty, onOpen }) {
    const { t } = useTranslation();
    if (!rows.length) return <EmptyState icon="fa-regular fa-circle-check" title={t('common.nothingHere')}>{empty}</EmptyState>;
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
    const { t } = useTranslation();
    const [sort, setSort] = useState('created');
    const sorted = useMemo(() => [...rows].sort(CLIENT_SORTS[sort]), [rows, sort]);
    const th = (key, label, align) => (
        <th onClick={() => setSort(key)} className={`dc-sortable ${sort === key ? 'active' : ''}`} style={align ? { textAlign: align } : undefined}>
            {label} {sort === key && <i className="fa-solid fa-arrow-down-short-wide" />}
        </th>
    );
    const exportCsv = () => downloadCsv(`deepclear-clients-${period.from}-to-${period.to}.csv`, [
        { label: t('summary.csv.client'), value: (r) => r.client_name },
        { label: t('summary.csv.filesCreated'), value: (r) => r.created },
        { label: t('summary.csv.previous'), value: (r) => r.prev_created },
        { label: t('summary.csv.share'), value: (r) => r.share_pct },
        { label: t('summary.csv.containers'), value: (r) => r.containers },
        { label: t('summary.csv.openNow'), value: (r) => r.open },
        { label: t('summary.csv.attention'), value: (r) => r.attention },
        { label: t('summary.csv.released'), value: (r) => r.released },
        { label: t('summary.csv.medianHours'), value: (r) => r.median_release_hours },
        { label: t('summary.csv.exams'), value: (r) => r.exams },
        { label: t('summary.csv.missingDocs'), value: (r) => r.missing_docs },
        { label: t('summary.csv.selfService'), value: (r) => r.self_service_pct },
        { label: t('summary.csv.lastFile'), value: (r) => (r.last_created ? formatDate(r.last_created) : '') },
    ], sorted);

    return (
        <Card title={t('summary.byClient')} sub={t('summary.byClientSub')} tight
            actions={<Button variant="ghost" size="sm" icon="fa-solid fa-download" onClick={exportCsv} disabled={!rows.length}>{t('common.csv')}</Button>}>
            {rows.length === 0 ? (
                <EmptyState icon="fa-solid fa-building" title={t('summary.noClientActivity')} />
            ) : (
                <div className="dc-table-wrap">
                    <table className="dc-table">
                        <thead>
                            <tr>
                                {th('name', t('summary.col.client'))}
                                {th('created', t('summary.col.files'))}
                                {th('open', t('summary.col.open'))}
                                {th('released', t('summary.col.released'))}
                                {th('speed', t('summary.col.median'))}
                                {th('exams', t('summary.col.exams'))}
                                {th('missing', t('summary.col.missing'))}
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r) => {
                                const change = r.prev_created ? Math.round(((r.created - r.prev_created) / r.prev_created) * 100) : null;
                                return (
                                    <tr key={r.client_id} className="clickable" onClick={() => onPick(r.client_id)}>
                                        <td className="dc-td-head" data-label={t('summary.col.client')}>
                                            <div className="dc-strong">{r.client_name}</div>
                                            <div className="dc-share"><div style={{ width: `${r.share_pct || 0}%` }} /></div>
                                        </td>
                                        <td data-label={t('summary.col.files')}>
                                            <b>{r.created}</b>
                                            <span className="dc-small dc-muted"> {r.share_pct != null ? `· ${r.share_pct}%` : ''}</span>
                                            {change != null && change !== 0 && (
                                                <span className={`dc-delta small ${change > 0 ? 'up' : 'down'}`}>{change > 0 ? '+' : ''}{change}%</span>
                                            )}
                                            {r.created === 0 && r.prev_created > 0 && <Badge tone="amber">{t('summary.quiet')}</Badge>}
                                        </td>
                                        <td data-label={t('summary.col.open')}>{r.open}{r.attention > 0 && <Badge tone="red">{t('summary.needAttention', { n: r.attention })}</Badge>}</td>
                                        <td data-label={t('summary.col.released')}>{r.released}</td>
                                        <td data-label={t('summary.col.median')}>{hours(r.median_release_hours)}</td>
                                        <td data-label={t('summary.col.exams')}>{r.exams || <span className="dc-muted">0</span>}</td>
                                        <td data-label={t('summary.col.missing')}>{r.missing_docs ? <Badge tone="amber">{r.missing_docs}</Badge> : <span className="dc-muted">0</span>}</td>
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
    const { t } = useTranslation();
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const per = 12;
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return s ? rows.filter((r) => [r.reference_number, r.client_name, r.stage_label, stageName(r.stage, r.stage_label), r.port_of_entry, r.created_by].some((v) => String(v || '').toLowerCase().includes(s))) : rows;
    }, [rows, q]);
    useEffect(() => setPage(1), [q, rows]);
    const pageRows = filtered.slice((page - 1) * per, page * per);
    const pages = Math.max(1, Math.ceil(filtered.length / per));

    const exportCsv = () => downloadCsv(`deepclear-${IS_ADMIN ? 'files' : 'shipments'}-${period.from}-to-${period.to}.csv`, [
        { label: t('summary.csv.reference'), value: (r) => r.reference_number },
        ...(IS_ADMIN ? [{ label: t('summary.csv.client'), value: (r) => r.client_name }] : []),
        { label: t('summary.csv.created'), value: (r) => formatDate(r.create_date, true) },
        { label: t('summary.csv.createdBy'), value: (r) => creatorName(r.created_by) },
        { label: t('summary.csv.stage'), value: (r) => stageName(r.stage, r.stage_label) },
        { label: t('summary.csv.mode'), value: (r) => TRANSPORT_LABELS[r.transport_mode] || '' },
        { label: t('summary.csv.origin'), value: (r) => (r.origin_country ? countryName(r.origin_country) : '') },
        { label: t('summary.csv.poe'), value: (r) => r.port_of_entry },
        { label: t('summary.csv.containers'), value: (r) => r.containers },
        { label: t('summary.csv.releasedAt'), value: (r) => (r.released_at ? formatDate(r.released_at, true) : '') },
        { label: t('summary.csv.hoursToRelease'), value: (r) => r.release_hours },
        { label: t('summary.csv.cbsaExam'), value: (r) => (r.had_exam ? t('common.yes') : '') },
        { label: t('summary.csv.missingDocuments'), value: (r) => missingList(r).join('; ') },
    ], filtered);

    return (
        <Card title={t(side('summary.files'))} tight
            actions={<Button variant="ghost" size="sm" icon="fa-solid fa-download" onClick={exportCsv} disabled={!rows.length}>{t('common.csv')}</Button>}>
            <div className="dc-toolbar">
                <div className="dc-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input className="dc-input" placeholder={t(side('summary.search'))} value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <span className="dc-small dc-muted">{t(IS_ADMIN ? 'summary.countFiles' : 'summary.countShipments', { count: filtered.length })}{truncated ? t('summary.latest500') : ''}</span>
            </div>
            {pageRows.length === 0 ? (
                <EmptyState icon="fa-solid fa-ship" title={rows.length ? t('summary.noMatch') : t(side('summary.none'))} />
            ) : (
                <div className="dc-table-wrap">
                    <table className="dc-table">
                        <thead>
                            <tr>
                                <th>{t('summary.col.reference')}</th>
                                {IS_ADMIN && <th>{t('summary.col.client')}</th>}
                                <th>{t('summary.col.created')}</th>
                                <th>{t('summary.col.stage')}</th>
                                <th>{t('summary.col.route')}</th>
                                <th>{t('summary.col.releaseTime')}</th>
                                <th>{t('summary.col.flags')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map((r) => (
                                <tr key={r.main_id} className="clickable" onClick={() => onOpen(r.main_id)}>
                                    <td className="dc-td-head" data-label={t('summary.col.reference')}><span className="dc-strong">{r.reference_number}</span></td>
                                    {IS_ADMIN && <td data-label={t('summary.col.client')}>{r.client_name}</td>}
                                    <td data-label={t('summary.col.created')}>
                                        {formatDate(r.create_date)}
                                        <div className="dc-small dc-muted">{creatorName(r.created_by)}</div>
                                    </td>
                                    <td data-label={t('summary.col.stage')}><StageBadge stage={r.stage} label={r.stage_label} /></td>
                                    <td data-label={t('summary.col.route')}>
                                        <span className="dc-small">
                                            {[r.origin_country && countryName(r.origin_country), r.port_of_entry].filter(Boolean).join(' → ') || '—'}
                                        </span>
                                        <div className="dc-small dc-muted">{TRANSPORT_LABELS[r.transport_mode] || ''}{r.containers ? ` · ${t('summary.cntr', { n: r.containers })}` : ''}</div>
                                    </td>
                                    <td data-label={t('summary.col.releaseTime')}>{hours(r.release_hours)}</td>
                                    <td data-label={t('summary.col.flags')}>
                                        <span className="dc-flags">
                                            {r.had_exam && <Badge tone="red">{t('summary.exam')}</Badge>}
                                            {r.missing_docs.length > 0 && (
                                                <Badge tone="amber" title={missingList(r).join(t('common.listSep'))}>{t('summary.docsMissingBadge', { count: r.missing_docs.length })}</Badge>
                                            )}
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
                    <span>{t('ui.pagerPage', { page, pages })}</span>
                    <div className="dc-actions">
                        <Button variant="secondary" size="sm" icon="fa-solid fa-chevron-left" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t('ui.previousPage')} />
                        <Button variant="secondary" size="sm" icon="fa-solid fa-chevron-right" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={t('ui.nextPage')} />
                    </div>
                </div>
            )}
        </Card>
    );
}

export default function TicketSummary() {
    const { t } = useTranslation();
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
        navigator.clipboard.writeText(window.location.href).then(() => toast.success(t('summary.copied')), () => {});
    };

    return (
        <Page
            title={t('summary.title')}
            subtitle={t(side('summary.sub'))}
            actions={(
                <>
                    <Button variant="ghost" icon="fa-solid fa-link" onClick={copyLink}>{t('summary.share')}</Button>
                    <Button icon="fa-solid fa-plus" onClick={() => navigate('/create-customs-ticket')}>{IS_ADMIN ? t('common.newFile') : t('common.newShipment')}</Button>
                </>
            )}
        >
            <div className="dc-card dc-filterbar">
                <div className="dc-seg" role="tablist" aria-label={t('summary.period')}>
                    {PRESETS.map((p) => (
                        <button type="button" key={p.key} role="tab" aria-selected={preset === p.key} className={preset === p.key ? 'active' : ''}
                            onClick={() => update({ p: p.key === '30d' ? '' : p.key, from: '', to: '' })}>
                            {t(`summary.preset.${p.key}`)}
                        </button>
                    ))}
                    <button type="button" role="tab" aria-selected={preset === 'custom'} className={preset === 'custom' ? 'active' : ''}
                        onClick={() => update({ p: 'custom', from, to })}>
                        <i className="fa-regular fa-calendar" /> {t('summary.custom')}
                    </button>
                </div>
                <div className="dc-filter-fields">
                    {preset === 'custom' && (
                        <>
                            <input type="date" className="dc-input" aria-label={t('summary.from')} value={from} max={to} onChange={(e) => e.target.value && update({ p: 'custom', from: e.target.value, to })} />
                            <span className="dc-muted">{t('summary.to')}</span>
                            <input type="date" className="dc-input" aria-label={t('summary.toLabel')} value={to} min={from} onChange={(e) => e.target.value && update({ p: 'custom', from, to: e.target.value })} />
                        </>
                    )}
                    {IS_ADMIN && (
                        <select className="dc-input" aria-label={t('summary.col.client')} value={clientId} onChange={(e) => update({ client: e.target.value })}>
                            <option value="">{t('summary.allClients')}</option>
                            {clients.map((c) => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
                        </select>
                    )}
                    <select className="dc-input" aria-label={t('summary.transport')} value={mode} onChange={(e) => update({ mode: e.target.value })}>
                        <option value="">{t('summary.allTransport')}</option>
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
                        {t('summary.periodNote', { from: formatDate(`${data.period.from}T12:00:00`), to: formatDate(`${data.period.to}T12:00:00`), days: data.period.days })}
                    </div>

                    <div className="dc-grid dc-kpis">
                        <Kpi icon="fa-solid fa-folder-plus" tone="teal" label={IS_ADMIN ? t('summary.kpi.createdAdmin') : t('summary.kpi.createdClient')} value={k.created}
                            delta={k.created_change_pct} sub={t('summary.kpi.createdSub', { n: k.prev_created })} />
                        <Kpi icon="fa-solid fa-box" tone="blue" label={t('summary.kpi.containers')} value={k.containers}
                            sub={k.created ? t(IS_ADMIN ? 'summary.kpi.perFile' : 'summary.kpi.perShipment', { n: Math.round((k.containers / k.created) * 10) / 10 }) : t('summary.kpi.noFiles')} />
                        <Kpi icon="fa-solid fa-circle-check" tone="green" label={t('summary.kpi.released')} value={k.released}
                            sub={k.released ? t('summary.kpi.within48', { pct: pctText(k.released_within_48h_pct) }) : t('summary.kpi.noneInPeriod')} onClick={() => openList('released')} />
                        <Kpi icon="fa-solid fa-stopwatch" tone="violet" label={t('summary.kpi.median')} value={hours(k.median_release_hours)}
                            sub={k.avg_release_hours != null ? t('summary.kpi.average', { v: hours(k.avg_release_hours) }) : t('summary.kpi.fromSubmission')} />
                        <Kpi icon="fa-solid fa-shield" tone={k.exam_rate_pct >= 10 ? 'red' : 'gray'} label={t('summary.kpi.exams')} value={k.exams}
                            sub={k.created ? t(IS_ADMIN ? 'summary.kpi.examOfFiles' : 'summary.kpi.examOfShipments', { pct: pctText(k.exam_rate_pct) }) : '—'} />
                        <Kpi icon="fa-solid fa-triangle-exclamation" tone={k.attention_now ? 'amber' : 'gray'} label={IS_ADMIN ? t('summary.kpi.openAdmin') : t('summary.kpi.openClient')}
                            value={<>{k.open_now}<span className={`dc-kpi-of ${k.attention_now ? '' : 'none'}`}> · {k.attention_now}</span></>}
                            sub={t(IS_ADMIN ? 'summary.kpi.docsCompleteFiles' : 'summary.kpi.docsCompleteShipments', { pct: pctText(k.docs_complete_pct) })} onClick={() => openList('attention')} />
                    </div>

                    <div className="dc-layout-main">
                        <div>
                            <Card title={t('summary.highlights')} sub={t('summary.highlightsSub')} tight>
                                <Insights items={data.insights} onOpen={openList} />
                            </Card>
                            <Card title={t(side('summary.overTime'))} sub={t(`summary.bucketSub.${data.period.bucket}`)}>
                                <TrendChart data={data.trend} bucket={data.period.bucket} noun={t(IS_ADMIN ? 'common.FilesNoun' : 'common.ShipmentsNoun')} />
                            </Card>
                        </div>
                        <div>
                            <Card title={t('summary.whereNow')} sub={t(side('summary.whereNowSub'))}>
                                {data.stages.length ? (
                                    <StackedBar items={data.stages.map((s) => ({ ...s, label: stageName(s.key, s.label), tone: STAGE_TONE[s.key] || 'gray' }))} />
                                ) : <div className="dc-muted dc-small">{t(side('summary.none'))}</div>}
                            </Card>
                            <Card title={t('summary.whoCreated')}>
                                <Donut label={nounPlural()} parts={[
                                    { key: 'client', label: IS_ADMIN ? t('summary.clientsSelf') : t('summary.you'), count: data.created_by.client, tone: 'teal' },
                                    { key: 'staff', label: IS_ADMIN ? t('summary.staff') : t('summary.team'), count: data.created_by.staff, tone: 'violet' },
                                    ...(data.created_by.unknown ? [{ key: 'unknown', label: t('summary.beforeTracking'), count: data.created_by.unknown, tone: 'gray' }] : []),
                                ]} />
                                {IS_ADMIN && data.creators.length > 0 && (
                                    <>
                                        <div className="dc-section-title" style={{ marginTop: 16 }}>{t('summary.topCreators')}</div>
                                        <BarList items={data.creators.slice(0, 6).map((c) => ({
                                            key: `${c.kind}-${c.name}`, label: creatorName(c.name), count: c.count, tone: c.kind === 'client' ? 'teal' : c.kind === 'admin' ? 'violet' : 'gray',
                                            hint: c.kind === 'client' ? t('summary.kindClient') : c.kind === 'admin' ? t('summary.kindStaff') : undefined,
                                        }))} />
                                    </>
                                )}
                            </Card>
                        </div>
                    </div>

                    {IS_ADMIN && !clientId && <ClientsTable rows={data.clients} period={data.period} onPick={(id) => update({ client: String(id) })} />}

                    <div className="dc-grid dc-grid-3 dc-mix">
                        <Card title={t('summary.aging')} sub={t(side('summary.agingSub'))}>
                            <BarList items={data.aging.map((a, i) => ({ key: a.key, label: t(`summary.age.${a.key}`, { defaultValue: a.label }), count: a.count, tone: ['green', 'teal', 'amber', 'red'][i] }))}
                                empty={t(side('summary.noOpen'))} />
                        </Card>
                        <Card title={t('summary.transport')} sub={t('summary.transportSub')}>
                            <BarList items={data.mix.transport_mode.map((m) => ({ key: m.key, label: TRANSPORT_LABELS[m.key] || transportName(m.key === 'unknown' ? 'unknown' : 'other'), count: m.count, tone: 'blue' }))}
                                onSelect={(i) => TRANSPORT_LABELS[i.key] && update({ mode: i.key })} />
                        </Card>
                        <Card title={t('summary.routes')} sub={t('summary.routesSub')}>
                            <BarList items={data.mix.origin_country.slice(0, 4).map((m) => ({ key: m.key, label: m.key === 'other' ? t('summary.otherCountries') : countryName(m.key), count: m.count, tone: 'violet' }))}
                                empty={t('summary.noOrigins')} />
                            <div className="dc-divider" />
                            <BarList items={data.mix.port_of_entry.slice(0, 4).map((m) => ({ key: m.key, label: m.key === 'other' ? t('summary.otherPorts') : m.key, count: m.count, tone: 'teal' }))} empty={t('summary.noPorts')} />
                        </Card>
                    </div>

                    <Card title={t('summary.watch')} sub={t(side('summary.watchSub'))} tight className="dc-watch">
                        <Tabs
                            active={watchTab}
                            onChange={setWatchTab}
                            tabs={[
                                { key: 'stuck', label: t('summary.tabStuck'), count: data.stuck.length },
                                { key: 'docs', label: t('summary.tabDocs'), count: data.missing_docs.tickets.length },
                                ...(IS_ADMIN ? [{ key: 'cad', label: t('summary.tabCad'), count: data.accounting_due.length }] : []),
                            ]}
                        />
                        {watchTab === 'stuck' && (
                            <WatchList rows={data.stuck} onOpen={openFile} empty={t('summary.stuckEmpty')}
                                render={(r) => t('summary.stuckLine', { idle: r.idle_days, age: r.age_days })} />
                        )}
                        {watchTab === 'docs' && (
                            <>
                                <div className="dc-doc-chips">
                                    {data.missing_docs.by_type.map((d) => (
                                        <span key={d.key} className={`dc-badge dc-tone-${d.count ? 'amber' : 'green'}`}>
                                            {d.count ? t('summary.docMissing', { doc: docName(d.key), n: d.count }) : t('summary.docAllIn', { doc: docName(d.key) })}
                                        </span>
                                    ))}
                                </div>
                                <WatchList rows={data.missing_docs.tickets} onOpen={openFile} empty={t('summary.docsEmpty')}
                                    render={(r) => t('summary.missingLine', { list: missingList(r).join(t('common.listSep')) })} />
                            </>
                        )}
                        {watchTab === 'cad' && (
                            <WatchList rows={data.accounting_due} onOpen={openFile} empty={t('summary.cadEmpty')}
                                render={(r) => `${t('summary.cadLine', { n: r.business_days_since_release })}${r.overdue ? t('summary.cadOverdue') : t('summary.cadDue')}`} />
                        )}
                    </Card>

                    <FilesTable rows={data.tickets} truncated={data.tickets_truncated} period={data.period} onOpen={openFile} />
                </div>
            )}
        </Page>
    );
}

