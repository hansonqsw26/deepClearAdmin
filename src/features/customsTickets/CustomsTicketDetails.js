/**
 * One customs shipment: progress, shipment details, containers, documents and
 * the timeline. Admins also move the stage, edit broker fields and post internal
 * notes. Clients can edit until the release is requested, upload documents at
 * any time, and approve the draft entry (CAD).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, DropZone, EmptyState, Field, Page, Spinner, display, formatDate, timeAgo, useToast } from '../../ui/components';
import { customsApi, IS_ADMIN } from './customs.api';
import { CbsaBadge, StageBadge, StageStepper } from './CustomsBits';
import { CAD_STATUS, COUNTRIES, CURRENCIES, STAGE_TONE, TRANSPORT_ICONS, TRANSPORT_LABELS, checkContainer, countryName, useCustomsOptions } from './customsMeta';

const SHIPMENT_FIELDS = [
    ['bill_of_lading', 'Bill of lading / AWB', { upper: true }],
    ['house_bill', 'House bill', { upper: true }],
    ['cargo_control_number', 'Cargo control number', { upper: true }],
    ['carrier_name', 'Carrier'],
    ['vessel_name', 'Vessel / flight'],
    ['voyage_number', 'Voyage'],
    ['port_of_loading', 'Port of loading'],
    ['port_of_entry', 'Port of entry'],
    ['origin_country', 'Country of origin', { country: true }],
    ['shipper_name', 'Shipper / exporter'],
    ['shipper_address', 'Shipper address', { textarea: true }],
    ['consignee_name', 'Consignee / importer'],
    ['consignee_address', 'Consignee address', { textarea: true }],
    ['importer_bn', 'Importer BN (RM)', { upper: true }],
    ['goods_description', 'Goods', { textarea: true, wide: true }],
    ['package_count', 'Packages', { type: 'number' }],
    ['gross_weight_kg', 'Gross weight (kg)', { type: 'number' }],
    ['invoice_value', 'Invoice value', { type: 'number' }],
    ['invoice_currency', 'Currency', { currency: true }],
    ['incoterm', 'Incoterm', { incoterm: true }],
];

const EVENT_STYLE = {
    created: { icon: 'fa-solid fa-flag', tone: 'blue' },
    stage: { icon: 'fa-solid fa-arrow-right', tone: 'teal' },
    comment: { icon: 'fa-regular fa-comment', tone: 'gray' },
    document: { icon: 'fa-regular fa-file-lines', tone: 'violet' },
    cbsa: { icon: 'fa-solid fa-shield', tone: 'green' },
    update: { icon: 'fa-solid fa-pen', tone: 'gray' },
};

const toLocalInput = (v) => (v ? String(v).replace(' ', 'T').slice(0, 16) : '');

export default function CustomsTicketDetails() {
    const [params] = useSearchParams();
    const mainId = params.get('main_id');
    const navigate = useNavigate();
    const toast = useToast();
    const options = useCustomsOptions();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const load = useCallback(() => {
        customsApi.get(mainId).then(setData).catch((e) => setError(e.message));
    }, [mainId]);

    useEffect(() => {
        if (!mainId) setError('No shipment selected.');
        else load();
    }, [mainId, load]);

    const back = { label: 'All shipments', onClick: () => navigate('/customs-tickets-list') };
    if (error) {
        return (
            <Page title="Shipment" back={back}>
                <Card><EmptyState icon="fa-solid fa-circle-exclamation" title="Could not open this shipment">{error}</EmptyState></Card>
            </Page>
        );
    }
    if (!data || !options) return <Page title="Shipment" back={back}><Spinner /></Page>;

    const { ticket, shipment, containers, documents, timeline } = data;
    const mode = shipment.transport_mode;

    return (
        <Page
            title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {ticket.reference_number}
                    <StageBadge stage={ticket.stage} label={ticket.stage_label} />
                </span>
            }
            subtitle={
                <>
                    {mode && <><i className={TRANSPORT_ICONS[mode]} /> {TRANSPORT_LABELS[mode]} · </>}
                    {IS_ADMIN && <>{ticket.client_name} · </>}
                    Opened {formatDate(ticket.create_date)}
                </>
            }
            back={back}
        >
            <Card>
                <StageStepper stage={ticket.stage} stages={options.stages} mainPath={options.main_path} />
            </Card>

            <div className="dc-layout-main">
                <div>
                    <ShipmentCard shipment={shipment} ticket={ticket} canEdit={data.can_edit} options={options} onSaved={load} />
                    <ContainersCard containers={containers} ticket={ticket} mode={mode} canEdit={data.can_edit} options={options} onSaved={load} />
                    <DocumentsCard documents={documents} ticket={ticket} containers={containers} onSaved={load} />
                </div>
                <div>
                    {IS_ADMIN && <StageCard ticket={ticket} options={options} onSaved={load} />}
                    <CadCard ticket={ticket} containers={containers} documents={documents} onSaved={load} toast={toast} />
                    <TimelineCard timeline={timeline} ticket={ticket} onSaved={load} />
                </div>
            </div>
        </Page>
    );
}

/* ---------------------------------------------------------------- shipment */

function ShipmentCard({ shipment, ticket, canEdit, options, onSaved }) {
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});
    const [note, setNote] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const start = () => {
        const f = {};
        for (const [k] of SHIPMENT_FIELDS) f[k] = shipment[k] ?? '';
        f.transport_mode = shipment.transport_mode || 'marine';
        setForm(f);
        setNote(ticket.note || '');
        setErrors({});
        setEditing(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            await customsApi.update(ticket.main_id, { shipment: form, note });
            toast.success('Shipment details saved.');
            setEditing(false);
            onSaved();
        } catch (e) {
            setErrors(e.fields || {});
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const fmt = (k, v, opt = {}) => {
        if (v === null || v === undefined || v === '') return '—';
        if (opt.country) return `${countryName(v)} (${v})`;
        if (k === 'invoice_value') return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });
        if (k === 'gross_weight_kg') return `${Number(v).toLocaleString()} kg`;
        return String(v);
    };

    if (!editing) {
        return (
            <Card
                title="Shipment details"
                actions={canEdit && <Button variant="secondary" size="sm" icon="fa-solid fa-pen" onClick={start}>Edit</Button>}
            >
                <dl className="dc-kv">
                    {SHIPMENT_FIELDS.map(([k, label, opt = {}]) => (
                        <div key={k} style={opt.wide ? { gridColumn: '1 / -1' } : undefined}>
                            <dt>{label}</dt>
                            <dd className={opt.upper ? 'dc-mono' : ''}>{fmt(k, shipment[k], opt)}</dd>
                        </div>
                    ))}
                    {ticket.note && (
                        <div style={{ gridColumn: '1 / -1' }}>
                            <dt>Notes</dt>
                            <dd style={{ whiteSpace: 'pre-wrap' }}>{ticket.note}</dd>
                        </div>
                    )}
                </dl>
                {!canEdit && (
                    <div className="dc-small dc-muted" style={{ marginTop: 16 }}>
                        <i className="fa-solid fa-lock" /> Locked because the release was requested from CBSA. Send us a message if something needs to change.
                    </div>
                )}
            </Card>
        );
    }

    const input = (k, label, opt = {}) => {
        const common = { key: k, label, name: k, value: form[k] ?? '', error: errors[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) };
        if (opt.country) return <Field {...common} as="select" options={[{ value: '', label: '—' }, ...COUNTRIES.map(([c, n]) => ({ value: c, label: `${n} (${c})` }))]} />;
        if (opt.currency) return <Field {...common} as="select" options={[{ value: '', label: '—' }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]} />;
        if (opt.incoterm) return <Field {...common} as="select" options={[{ value: '', label: '—' }, ...options.incoterms.map((c) => ({ value: c, label: c }))]} />;
        if (opt.textarea) return <Field {...common} as="textarea" rows={2} className={opt.wide ? 'dc-span-all' : ''} />;
        return <Field {...common} type={opt.type || 'text'} upper={opt.upper} />;
    };

    return (
        <Card title="Edit shipment details">
            <div className="dc-grid dc-grid-2">
                <Field label="Transport" name="transport_mode" as="select" value={form.transport_mode}
                    onChange={(e) => setForm((f) => ({ ...f, transport_mode: e.target.value }))}
                    options={options.transport_modes.map((m) => ({ value: m, label: TRANSPORT_LABELS[m] }))} />
                {SHIPMENT_FIELDS.map(([k, label, opt]) => input(k, label, opt))}
                <Field label="Notes" name="note" as="textarea" rows={2} className="dc-span-all" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="dc-actions end" style={{ marginTop: 16 }}>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button busy={saving} icon="fa-solid fa-check" onClick={save}>Save changes</Button>
            </div>
        </Card>
    );
}

/* -------------------------------------------------------------- containers */

function ContainersCard({ containers, ticket, mode, canEdit, options, onSaved }) {
    const toast = useToast();
    const iso = !mode || mode === 'marine' || mode === 'rail';
    const [editing, setEditing] = useState(null); // container_id or 'new'
    const [form, setForm] = useState({});
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const startEdit = (c) => {
        setForm(c ? {
            container_number: c.container_number || '', size_type: c.size_type || '', seal_number: c.seal_number || '',
            transaction_number: c.transaction_number || '', destination: c.destination || '', eta: toLocalInput(c.eta),
        } : { container_number: '', size_type: '40HC', seal_number: '', transaction_number: '', destination: '', eta: '' });
        setErrors({});
        setEditing(c ? c.container_id : 'new');
    };

    const save = async () => {
        setSaving(true);
        const body = { ...form, eta: form.eta ? form.eta.replace('T', ' ') : '' };
        if (!IS_ADMIN) delete body.transaction_number;
        try {
            if (editing === 'new') await customsApi.addContainer(ticket.main_id, body);
            else await customsApi.updateContainer(editing, body);
            toast.success(editing === 'new' ? 'Container added.' : 'Container saved.');
            setEditing(null);
            onSaved();
        } catch (e) {
            setErrors(e.fields || {});
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (c) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Remove ${c.container_number || 'this unit'} from the shipment?`)) return;
        try {
            await customsApi.removeContainer(c.container_id);
            toast.success('Removed.');
            onSaved();
        } catch (e) {
            toast.error(e.message);
        }
    };

    const canChange = IS_ADMIN || canEdit;
    const check = iso ? checkContainer(form.container_number) : {};

    return (
        <Card
            title={`${iso ? 'Containers' : 'Units'} (${containers.length})`}
            sub="CBSA status updates automatically every few minutes once the transaction number is set."
            tight
            actions={canChange && editing === null && <Button variant="secondary" size="sm" icon="fa-solid fa-plus" onClick={() => startEdit(null)}>Add</Button>}
        >
            {containers.length === 0 && <EmptyState icon="fa-solid fa-box" title="No containers yet" />}
            {containers.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                    <table className="dc-table">
                        <thead>
                            <tr>
                                <th>{iso ? 'Container' : 'Unit'}</th>
                                <th>Seal</th>
                                <th>ETA</th>
                                {IS_ADMIN && <th>Transaction no.</th>}
                                <th>CBSA status</th>
                                {canChange && <th aria-label="actions" />}
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map((c) => (
                                <tr key={c.container_id}>
                                    <td className="dc-td-head" data-label="Container">
                                        <span className="dc-mono dc-strong">{c.container_number || '—'}</span>
                                        {c.size_type && <span className="dc-small dc-muted"> · {c.size_type}</span>}
                                    </td>
                                    <td data-label="Seal">{display(c.seal_number)}</td>
                                    <td data-label="ETA">{formatDate(c.eta, true)}</td>
                                    {IS_ADMIN && <td data-label="Transaction" className="dc-mono">{display(c.transaction_number)}</td>}
                                    <td data-label="CBSA">
                                        <CbsaBadge code={c.cb_status} label={c.cb_status_label} />
                                        {c.cb_status_time && <div className="dc-small dc-muted">{formatDate(c.cb_status_time, true)}</div>}
                                    </td>
                                    {canChange && (
                                        <td data-label="" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <Button variant="ghost" size="sm" icon="fa-solid fa-pen" onClick={() => startEdit(c)} aria-label="Edit" />
                                            {containers.length > 1 && <Button variant="ghost" size="sm" icon="fa-regular fa-trash-can" onClick={() => remove(c)} aria-label="Remove" />}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {editing !== null && (
                <div style={{ padding: 16, borderTop: '1px solid var(--dc-line)' }}>
                    <div className="dc-section-title">{editing === 'new' ? 'Add container' : 'Edit container'}</div>
                    <div className="dc-grid dc-grid-3">
                        <Field label={iso ? 'Container number' : 'ULD / trailer'} required={iso} upper name="container_number" value={form.container_number}
                            error={errors.container_number} warning={check.error || check.warning}
                            onChange={(e) => setForm((f) => ({ ...f, container_number: e.target.value }))} />
                        {iso && (
                            <Field label="Size / type" name="size_type" as="select" value={form.size_type} onChange={(e) => setForm((f) => ({ ...f, size_type: e.target.value }))}
                                options={[{ value: '', label: '—' }, ...options.container_sizes.map((s) => ({ value: s, label: s }))]} />
                        )}
                        <Field label="Seal" name="seal_number" value={form.seal_number} onChange={(e) => setForm((f) => ({ ...f, seal_number: e.target.value }))} />
                        <Field label="ETA" name="eta" type="datetime-local" value={form.eta} onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))} />
                        <Field label="Destination" name="destination" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
                        {IS_ADMIN && (
                            <Field label="Transaction number" name="transaction_number" value={form.transaction_number} error={errors.transaction_number}
                                hint="14 digits from Candata." onChange={(e) => setForm((f) => ({ ...f, transaction_number: e.target.value }))} />
                        )}
                    </div>
                    <div className="dc-actions end" style={{ marginTop: 14 }}>
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button busy={saving} icon="fa-solid fa-check" onClick={save}>Save</Button>
                    </div>
                </div>
            )}
        </Card>
    );
}

/* --------------------------------------------------------------- documents */

function DocumentsCard({ documents, ticket, onSaved }) {
    const toast = useToast();
    const [busyType, setBusyType] = useState(null);
    const required = documents.filter((d) => d.requirement === 'required');
    const received = required.filter((d) => d.received).length;
    const visible = documents.filter((d) => d.requirement !== 'broker' || d.received || IS_ADMIN);

    const upload = async (type, files) => {
        setBusyType(type);
        try {
            for (const f of files) await customsApi.upload(ticket.cb_id, type, f);
            toast.success(files.length > 1 ? `${files.length} files uploaded.` : 'File uploaded.');
            onSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusyType(null);
        }
    };

    const remove = async (file) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Delete ${file.file_name}?`)) return;
        try {
            await customsApi.deleteFile(file.file_id);
            toast.success('File deleted.');
            onSaved();
        } catch (e) {
            toast.error(e.message);
        }
    };

    return (
        <Card
            title="Documents"
            sub={`${received} of ${required.length} required documents received`}
            tight
            actions={<div style={{ width: 120 }} className="dc-progress"><div style={{ width: `${required.length ? (received / required.length) * 100 : 0}%` }} /></div>}
        >
            {visible.map((d) => {
                const tone = d.received ? 'green' : d.requirement === 'required' ? 'amber' : 'gray';
                return (
                    <div className="dc-doc" key={d.key}>
                        <div className={`dc-doc-icon dc-tone-${tone}`}>
                            <i className={d.received ? 'fa-solid fa-check' : d.requirement === 'required' ? 'fa-solid fa-exclamation' : 'fa-regular fa-file'} />
                        </div>
                        <div className="dc-doc-main">
                            <div className="dc-doc-title">
                                {d.label}
                                {d.requirement === 'required' && !d.received && <Badge tone="amber" plain>Required</Badge>}
                                {d.requirement === 'recommended' && !d.received && <Badge tone="gray" plain>Recommended</Badge>}
                            </div>
                            {d.hint && <div className="dc-doc-hint">{d.hint}</div>}
                            {d.files.length > 0 && (
                                <div className="dc-doc-files">
                                    {d.files.map((f) => (
                                        <div className="dc-doc-file" key={f.file_id}>
                                            <i className="fa-regular fa-file-lines dc-muted" />
                                            <a href={f.file_link} target="_blank" rel="noreferrer">{f.file_name || 'file'}</a>
                                            <span>{formatDate(f.create_date)}</span>
                                            {IS_ADMIN && <button type="button" className="dc-link" style={{ color: 'var(--dc-red)' }} onClick={() => remove(f)}>delete</button>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="dc-doc-side">
                            {busyType === d.key ? <span className="dc-spinner" /> : (
                                (d.key !== 'draft cad' || IS_ADMIN) && (
                                    <DropZone compact label={d.received ? 'Add' : 'Upload'} onFiles={(files) => upload(d.key, files)} />
                                )
                            )}
                        </div>
                    </div>
                );
            })}
        </Card>
    );
}

/* -------------------------------------------------------------- CAD review */

function CadCard({ ticket, containers, documents, onSaved, toast }) {
    const draft = documents.find((d) => d.key === 'draft cad');
    const cad = containers.reduce((max, c) => Math.max(max, Number(c.cad_status) || 0), 0);
    const [busy, setBusy] = useState(false);
    if (!draft || !draft.received) return null;

    const approve = async () => {
        setBusy(true);
        try {
            await customsApi.update(ticket.main_id, { cad_status: 2 });
            toast.success('Thanks, the draft entry is approved.');
            onSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    const latest = draft.files[0];
    return (
        <Card title="Draft entry (CAD)">
            <p style={{ fontSize: 14, marginTop: 0 }}>
                {IS_ADMIN ? 'Shared with the client for approval.' : 'Please check the draft customs entry we prepared and approve it.'}
            </p>
            {latest && (
                <a className="dc-btn dc-btn-secondary dc-btn-block" href={latest.file_link} target="_blank" rel="noreferrer" style={{ marginBottom: 10 }}>
                    <i className="fa-regular fa-file-pdf" /> Open draft
                </a>
            )}
            {cad >= 2 ? (
                <Badge tone="green">{CAD_STATUS[2]}</Badge>
            ) : IS_ADMIN ? (
                <Badge tone="amber">Waiting for client approval</Badge>
            ) : (
                <Button block busy={busy} icon="fa-solid fa-check" onClick={approve}>Approve draft entry</Button>
            )}
        </Card>
    );
}

/* ------------------------------------------------------------- stage (admin) */

function StageCard({ ticket, options, onSaved }) {
    const toast = useToast();
    const [stage, setStage] = useState(ticket.stage);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => setStage(ticket.stage), [ticket.stage]);

    const save = async (nextStage = stage, msg = message) => {
        setBusy(true);
        try {
            await customsApi.setStage(ticket.main_id, nextStage, msg || undefined);
            toast.success('Stage updated. The client can see it now.');
            setMessage('');
            onSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    const path = options.main_path;
    const next = path[path.indexOf({ awaiting_client: 'in_review', cbsa_exam: 'release_requested' }[ticket.stage] || ticket.stage) + 1];
    const nextLabel = next && options.stages.find((s) => s.key === next).label;

    return (
        <Card title="Stage" sub="Release, exam and released also update automatically from Candata.">
            {nextLabel && !['completed', 'cancelled'].includes(ticket.stage) && (
                <Button block busy={busy} icon="fa-solid fa-forward" onClick={() => save(next, message)} style={{ marginBottom: 14 }}>
                    Move to: {nextLabel}
                </Button>
            )}
            <div className="dc-grid" style={{ gap: 12 }}>
                <Field label="Or set stage" name="stage" as="select" value={stage} onChange={(e) => setStage(e.target.value)}
                    options={options.stages.map((s) => ({ value: s.key, label: s.label }))} />
                <Field label="Message to client (optional)" name="stage_message" as="textarea" rows={2} value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={stage === 'awaiting_client' ? 'e.g. Please upload the certificate of origin.' : 'Shown on the client timeline.'} />
                <Button variant="secondary" busy={busy} disabled={stage === ticket.stage} onClick={() => save()}>Update stage</Button>
            </div>
        </Card>
    );
}

/* ---------------------------------------------------------------- timeline */

function TimelineCard({ timeline, ticket, onSaved }) {
    const toast = useToast();
    const [text, setText] = useState('');
    const [internal, setInternal] = useState(false);
    const [busy, setBusy] = useState(false);
    const endRef = useRef(null);
    const items = useMemo(() => [...timeline].reverse(), [timeline]);

    const send = async () => {
        if (!text.trim()) return;
        setBusy(true);
        try {
            await customsApi.comment(ticket.main_id, text.trim(), internal);
            setText('');
            setInternal(false);
            onSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card title="Timeline and messages" tight>
            <div className="dc-composer" style={{ borderTop: 0, borderBottom: '1px solid var(--dc-line)' }}>
                <textarea
                    className="dc-input"
                    rows={2}
                    placeholder={IS_ADMIN ? 'Message the client or add a note…' : 'Send a message to your broker…'}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
                />
                <div className="dc-actions" style={{ justifyContent: 'space-between' }}>
                    {IS_ADMIN ? (
                        <label className="dc-small" style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
                            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (client can't see)
                        </label>
                    ) : <span />}
                    <Button size="sm" busy={busy} disabled={!text.trim()} icon="fa-solid fa-paper-plane" onClick={send}>Send</Button>
                </div>
            </div>
            <div style={{ padding: '18px 20px 4px' }}>
                {items.length === 0 && <div className="dc-muted">Nothing yet.</div>}
                <ul className="dc-timeline">
                    {items.map((e) => {
                        const style = e.event_type === 'stage' ? { icon: '', tone: STAGE_TONE[e.stage] || 'teal' } : EVENT_STYLE[e.event_type] || EVENT_STYLE.update;
                        const who = e.actor_role === 'system' ? 'CBSA via Candata' : e.actor_role === 'admin' ? (IS_ADMIN ? e.actor_name || 'DeepClear' : 'DeepClear') : e.actor_name || 'Client';
                        return (
                            <li key={e.event_id} className={`dc-tl-item ${e.event_type === 'comment' ? 'comment' : ''} ${!e.visible_to_client ? 'internal' : ''}`}>
                                <span className={`dc-tl-dot dc-tone-${style.tone}`} style={{ background: 'currentColor' }} />
                                <div className="dc-tl-meta">
                                    <b style={{ color: 'var(--dc-ink-2)' }}>{who}</b> · <span title={formatDate(e.created_at, true)}>{timeAgo(e.created_at)}</span>
                                    {!e.visible_to_client && <> · <Badge tone="amber" plain>Internal</Badge></>}
                                </div>
                                {e.event_type === 'stage' && (
                                    <div className="dc-tl-text">Stage: <b>{e.stage_label || e.stage}</b></div>
                                )}
                                {e.message && <div className="dc-tl-text">{e.message}</div>}
                            </li>
                        );
                    })}
                </ul>
                <div ref={endRef} />
            </div>
        </Card>
    );
}
