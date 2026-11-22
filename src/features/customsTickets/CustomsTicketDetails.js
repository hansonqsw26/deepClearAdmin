/**
 * One customs shipment: progress, shipment details, containers, documents and
 * the timeline. Admins also move the stage, edit broker fields and post internal
 * notes. Clients can edit until the release is requested, upload documents at
 * any time, and approve the draft entry (CAD).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { docHint, docName, eventText, locale, stageName } from '../../i18n';
import { Badge, Button, Card, DropZone, EmptyState, Field, Page, Spinner, display, formatDate, timeAgo, useToast } from '../../ui/components';
import { customsApi, IS_ADMIN } from './customs.api';
import { CbsaBadge, StageBadge, StageStepper } from './CustomsBits';
import { PoaBadge, PoaUpload, canManageAccounts, poaNeedsAction } from './Importers';
import { CAD_STATUS, COUNTRIES, CURRENCIES, STAGE_TONE, TRANSPORT_ICONS, TRANSPORT_LABELS, checkContainer, countryName, useCustomsOptions } from './customsMeta';

/** Stages after which a missing POA no longer blocks anything. */
const DONE_STAGES = ['released', 'accounted', 'invoiced', 'completed', 'cancelled'];

/** [field, label key (field.*), options] */
const SHIPMENT_FIELDS = [
    ['bill_of_lading', 'blOrAwb', { upper: true }],
    ['house_bill', 'houseBill', { upper: true }],
    ['cargo_control_number', 'ccnShort', { upper: true }],
    ['carrier_name', 'carrier'],
    ['vessel_name', 'vesselOrFlight'],
    ['voyage_number', 'voyage'],
    ['port_of_loading', 'pol'],
    ['port_of_entry', 'poeShort'],
    ['origin_country', 'origin', { country: true }],
    ['shipper_name', 'shipper'],
    ['shipper_address', 'shipperAddress', { textarea: true }],
    ['consignee_name', 'consigneeShort'],
    ['consignee_address', 'consigneeAddress', { textarea: true }],
    ['importer_bn', 'importerBnShort', { upper: true }],
    ['goods_description', 'goodsShort', { textarea: true, wide: true }],
    ['package_count', 'packages', { type: 'number' }],
    ['gross_weight_kg', 'grossWeight', { type: 'number' }],
    ['invoice_value', 'invoiceValue', { type: 'number' }],
    ['invoice_currency', 'currency', { currency: true }],
    ['incoterm', 'incotermShort', { incoterm: true }],
];

const EVENT_STYLE = {
    created: { icon: 'fa-solid fa-flag', tone: 'blue' },
    stage: { icon: 'fa-solid fa-arrow-right', tone: 'teal' },
    comment: { icon: 'fa-regular fa-comment', tone: 'gray' },
    document: { icon: 'fa-regular fa-file-lines', tone: 'violet' },
    cbsa: { icon: 'fa-solid fa-shield', tone: 'green' },
    update: { icon: 'fa-solid fa-pen', tone: 'gray' },
};

/** Broker-side wording for documents whose usual hint speaks to the client. */
const ADMIN_HINT = { 'release cad': 'details.releaseCadAdminHint', 'brokerage invoice': 'details.invoiceHint', 'draft cad': '' };

const toLocalInput = (v) => (v ? String(v).replace(' ', 'T').slice(0, 16) : '');

export default function CustomsTicketDetails() {
    const { t } = useTranslation();
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
        if (!mainId) setError(t('details.noneSelected'));
        else load();
    }, [mainId, load]); // eslint-disable-line react-hooks/exhaustive-deps

    const back = { label: t('details.allShipments'), onClick: () => navigate('/customs-tickets-list') };
    if (error) {
        return (
            <Page title={t('details.shipment')} back={back}>
                <Card><EmptyState icon="fa-solid fa-circle-exclamation" title={t('details.couldNotOpen')}>{error}</EmptyState></Card>
            </Page>
        );
    }
    if (!data || !options) return <Page title={t('details.shipment')} back={back}><Spinner /></Page>;

    const { ticket, shipment, containers, documents, timeline } = data;
    const mode = shipment.transport_mode;
    /** Scroll to a card (and put the cursor in the message box when asked). */
    const jump = (id, focus) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (focus) setTimeout(() => { const box = el.querySelector('textarea'); if (box) box.focus({ preventScroll: true }); }, 400);
    };

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
                    {IS_ADMIN && <>{ticket.company_name ? `${ticket.company_name} (${ticket.client_name})` : ticket.client_name} · </>}
                    {t('details.opened', { date: formatDate(ticket.create_date) })}
                </>
            }
            back={back}
        >
            <Card>
                <StageStepper stage={ticket.stage} stages={options.stages} mainPath={options.main_path}>
                    {!IS_ADMIN && ticket.stage === 'awaiting_client' && (
                        <>
                            {ticket.action_request && (
                                <div className="dc-request">
                                    <div className="dc-small dc-strong">{t('details.requestFrom')}</div>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{ticket.action_request.message}</div>
                                </div>
                            )}
                            <div className="dc-actions" style={{ marginTop: 10 }}>
                                <Button size="sm" icon="fa-solid fa-arrow-up-from-bracket" onClick={() => jump('dc-documents')}>{t('details.uploadDocs')}</Button>
                                <Button size="sm" variant="secondary" icon="fa-regular fa-comment" onClick={() => jump('dc-timeline', true)}>{t('details.reply')}</Button>
                            </div>
                        </>
                    )}
                </StageStepper>
                {IS_ADMIN && ticket.client_replied && (
                    <div className="dc-alert dc-tone-violet" style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <i className="fa-regular fa-comment-dots" />
                        <span style={{ flex: '1 1 220px' }}><b>{t('details.clientReplied')}.</b> {t('details.clientRepliedText')}</span>
                        <Button size="sm" variant="secondary" onClick={() => jump('dc-timeline')}>{t('details.seeTimeline')}</Button>
                    </div>
                )}
                {data.importer && poaNeedsAction(data.importer.poa_state) && !DONE_STAGES.includes(ticket.stage) && (
                    <div className={`dc-alert ${IS_ADMIN ? 'dc-tone-red' : 'dc-tone-amber'}`} style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }} data-testid="poa-alert">
                        <i className="fa-solid fa-file-signature" />
                        <span style={{ flex: '1 1 220px' }}>
                            <b>{t('details.poaTitle', { name: data.importer.legal_name })}</b> <PoaBadge importer={data.importer} />{' '}
                            {IS_ADMIN ? t(`details.poaStaff.${data.importer.poa_state}`) : t(`details.poaClient.${data.importer.poa_state}`)}
                        </span>
                        {IS_ADMIN && <PoaUpload importer={data.importer} onDone={load} />}
                        {(!IS_ADMIN || canManageAccounts()) && (
                            <Link className="dc-btn dc-btn-secondary dc-btn-sm" to={IS_ADMIN ? `/client-accounts?client=${ticket.client_id}` : '/importers'}>
                                {IS_ADMIN ? t('details.poaOpenClient') : t('details.poaUpload')}
                            </Link>
                        )}
                    </div>
                )}
            </Card>

            <div className="dc-layout-main dc-actions-first">
                <div>
                    <ShipmentCard shipment={shipment} ticket={ticket} canEdit={data.can_edit} options={options} onSaved={load} />
                    <ContainersCard containers={containers} ticket={ticket} mode={mode} canEdit={data.can_edit} options={options} onSaved={load} />
                    <DocumentsCard documents={documents} ticket={ticket} containers={containers} onSaved={load} />
                </div>
                <div>
                    {IS_ADMIN && <StageCard ticket={ticket} options={options} documents={documents} onSaved={load} />}
                    <CadCard ticket={ticket} containers={containers} documents={documents} onSaved={load} toast={toast} />
                    <TimelineCard timeline={timeline} ticket={ticket} onSaved={load} />
                </div>
            </div>
        </Page>
    );
}

/* ---------------------------------------------------------------- shipment */

function ShipmentCard({ shipment, ticket, canEdit, options, onSaved }) {
    const { t } = useTranslation();
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
            toast.success(t('details.saved'));
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
        if (k === 'invoice_value') return Number(v).toLocaleString(locale(), { minimumFractionDigits: 2 });
        if (k === 'gross_weight_kg') return `${Number(v).toLocaleString(locale())} kg`;
        return String(v);
    };

    if (!editing) {
        return (
            <Card
                title={t('details.shipmentDetails')}
                actions={canEdit && <Button variant="secondary" size="sm" icon="fa-solid fa-pen" onClick={start}>{t('common.edit')}</Button>}
            >
                <dl className="dc-kv">
                    {SHIPMENT_FIELDS.map(([k, label, opt = {}]) => (
                        <div key={k} style={opt.wide ? { gridColumn: '1 / -1' } : undefined}>
                            <dt>{t(`field.${label}`)}</dt>
                            <dd className={opt.upper ? 'dc-mono' : ''}>{fmt(k, shipment[k], opt)}</dd>
                        </div>
                    ))}
                    {ticket.note && (
                        <div style={{ gridColumn: '1 / -1' }}>
                            <dt>{t('field.notes')}</dt>
                            <dd style={{ whiteSpace: 'pre-wrap' }}>{ticket.note}</dd>
                        </div>
                    )}
                </dl>
                {!canEdit && (
                    <div className="dc-small dc-muted" style={{ marginTop: 16 }}>
                        <i className="fa-solid fa-lock" /> {t('details.locked')}
                    </div>
                )}
            </Card>
        );
    }

    const input = (k, label, opt = {}) => {
        const common = { key: k, label: t(`field.${label}`), name: k, value: form[k] ?? '', error: errors[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) };
        if (opt.country) return <Field {...common} as="select" options={[{ value: '', label: '—' }, ...COUNTRIES.map(([c]) => ({ value: c, label: `${countryName(c)} (${c})` }))]} />;
        if (opt.currency) return <Field {...common} as="select" options={[{ value: '', label: '—' }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]} />;
        if (opt.incoterm) return <Field {...common} as="select" options={[{ value: '', label: '—' }, ...options.incoterms.map((c) => ({ value: c, label: c }))]} />;
        if (opt.textarea) return <Field {...common} as="textarea" rows={2} className={opt.wide ? 'dc-span-all' : ''} />;
        return <Field {...common} type={opt.type || 'text'} upper={opt.upper} />;
    };

    return (
        <Card title={t('details.editShipment')}>
            <div className="dc-grid dc-grid-2">
                <Field label={t('field.transport')} name="transport_mode" as="select" value={form.transport_mode}
                    onChange={(e) => setForm((f) => ({ ...f, transport_mode: e.target.value }))}
                    options={options.transport_modes.map((m) => ({ value: m, label: TRANSPORT_LABELS[m] }))} />
                {SHIPMENT_FIELDS.map(([k, label, opt]) => input(k, label, opt))}
                <Field label={t('field.notes')} name="note" as="textarea" rows={2} className="dc-span-all" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="dc-actions end" style={{ marginTop: 16 }}>
                <Button variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
                <Button busy={saving} icon="fa-solid fa-check" onClick={save}>{t('common.saveChanges')}</Button>
            </div>
        </Card>
    );
}

/* -------------------------------------------------------------- containers */

function ContainersCard({ containers, ticket, mode, canEdit, options, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const iso = !mode || mode === 'marine' || mode === 'rail';
    const [editing, setEditing] = useState(null); // container_id or 'new'
    const [form, setForm] = useState({});
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [entry, setEntry] = useState(null); // { txn, ids: Set } while the customs-entry panel is open

    const [refreshing, setRefreshing] = useState(false);

    const startEdit = (c) => {
        setEntry(null);
        setForm(c ? {
            container_number: c.container_number || '', size_type: c.size_type || '', seal_number: c.seal_number || '',
            transaction_number: c.transaction_number || '', destination: c.destination || '', eta: toLocalInput(c.eta),
            vessel_eta: toLocalInput(c.vessel_eta), port_eta: toLocalInput(c.port_eta), rail_eta: toLocalInput(c.rail_eta),
            rail_carrier: c.rail_carrier || '', rail_destination: c.rail_destination || '',
        } : {
            container_number: '', size_type: '40HC', seal_number: '', transaction_number: '', destination: '', eta: '',
            vessel_eta: '', port_eta: '', rail_eta: '', rail_carrier: '', rail_destination: '',
        });
        setErrors({});
        setEditing(c ? c.container_id : 'new');
    };

    const save = async () => {
        setSaving(true);
        const body = { ...form };
        for (const f of ['eta', ...ETA_FIELDS]) body[f] = form[f] ? form[f].replace('T', ' ') : '';
        if (!IS_ADMIN) for (const f of ['transaction_number', ...ETA_FIELDS, 'rail_carrier', 'rail_destination']) delete body[f];
        try {
            if (editing === 'new') await customsApi.addContainer(ticket.main_id, body);
            else await customsApi.updateContainer(editing, body);
            toast.success(editing === 'new' ? t('details.containerAdded') : t('details.containerSaved'));
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
        if (!window.confirm(t('details.confirmRemove', { what: c.container_number || t('details.thisUnit') }))) return;
        try {
            await customsApi.removeContainer(c.container_id);
            toast.success(t('details.removed'));
            onSaved();
        } catch (e) {
            toast.error(e.message);
        }
    };

    const canChange = IS_ADMIN || canEdit;
    const check = iso ? checkContainer(form.container_number) : {};

    /* Customs entry (admin): one Candata transaction number for the containers it covers. */
    const openEntry = () => {
        const missing = containers.filter((c) => !c.transaction_number);
        // Start with the containers that still need a number, or all of them when none do.
        const ids = new Set((missing.length ? missing : containers).map((c) => c.container_id));
        setEditing(null);
        setErrors({});
        setEntry({ txn: '', ids });
    };
    const toggleEntryId = (id) => setEntry((e) => {
        const ids = new Set(e.ids);
        if (ids.has(id)) ids.delete(id); else ids.add(id);
        return { ...e, ids };
    });
    const saveEntry = async () => {
        setSaving(true);
        try {
            await customsApi.setEntry(ticket.main_id, entry.txn, [...entry.ids]);
            toast.success(t('details.entrySaved'));
            setEntry(null);
            onSaved();
        } catch (e) {
            setErrors(e.fields || {});
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };
    /* Ask the official ETA sources now (admin). */
    const refreshEtas = async () => {
        setRefreshing(true);
        try {
            const r = await customsApi.refreshEtas(ticket.main_id);
            const connected = r.sources && (r.sources.carriers.length + r.sources.railways.length) > 0;
            if (!connected) toast.error(t('details.etasNoSource'));
            else if (r.changed) toast.success(t('details.etasRefreshed', { count: r.changed }));
            else toast.success(t('details.etasNoChange'));
            onSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setRefreshing(false);
        }
    };
    const etaNotes = IS_ADMIN ? [...new Set(containers.map((c) => c.eta_check_note).filter(Boolean))] : [];
    const lastCheck = containers.map((c) => c.eta_checked_at).filter(Boolean).sort().pop();

    const missingTxn = containers.filter((c) => !c.transaction_number).length;
    const closed = ['invoiced', 'completed', 'cancelled'].includes(ticket.stage);
    const showMissing = IS_ADMIN && missingTxn > 0 && !closed && ticket.stage !== 'submitted';

    return (
        <Card
            title={iso ? t('details.containers', { count: containers.length }) : t('details.units', { count: containers.length })}
            sub={t('details.containersSub')}
            tight
            actions={canChange && editing === null && entry === null && (
                <>
                    {IS_ADMIN && iso && containers.length > 0 && <Button variant="secondary" size="sm" icon="fa-solid fa-rotate" busy={refreshing} onClick={refreshEtas}>{t('details.refreshEtas')}</Button>}
                    {IS_ADMIN && containers.length > 0 && <Button variant="secondary" size="sm" icon="fa-solid fa-file-signature" onClick={openEntry}>{t('details.entryButton')}</Button>}
                    <Button variant="secondary" size="sm" icon="fa-solid fa-plus" onClick={() => startEdit(null)}>{t('common.add')}</Button>
                </>
            )}
        >
            {showMissing && entry === null && (
                <div className="dc-alert dc-tone-amber" style={{ margin: '0 16px 12px' }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />
                    {missingTxn === containers.length
                        ? t('details.noTxnAll')
                        : t('details.noTxnSome', { count: missingTxn, total: containers.length })}
                </div>
            )}
            {entry !== null && (
                <div style={{ padding: 16, borderBottom: '1px solid var(--dc-line)' }}>
                    <div className="dc-section-title">{t('details.entryTitle')}</div>
                    <p className="dc-small dc-muted" style={{ marginTop: 0 }}>{t('details.entryHelp')}</p>
                    <div className="dc-grid dc-grid-3">
                        <Field label={t('field.transactionNumber')} name="entry_txn" value={entry.txn} inputMode="numeric" autoFocus
                            error={errors.transaction_number} hint={t('field.transactionHintAdmin')}
                            onChange={(e) => setEntry((x) => ({ ...x, txn: e.target.value }))} />
                    </div>
                    <div className="dc-small dc-strong" style={{ margin: '10px 0 6px' }}>{t('details.entryCovers')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
                        {containers.map((c) => (
                            <label key={c.container_id} className="dc-small" style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
                                <input type="checkbox" checked={entry.ids.has(c.container_id)} onChange={() => toggleEntryId(c.container_id)} />
                                <span className="dc-mono">{c.container_number || t('details.thisUnit')}</span>
                                {c.transaction_number && <span className="dc-muted dc-mono">({c.transaction_number})</span>}
                            </label>
                        ))}
                    </div>
                    <div className="dc-actions end" style={{ marginTop: 14 }}>
                        <Button variant="ghost" onClick={() => setEntry(null)}>{t('common.cancel')}</Button>
                        <Button busy={saving} disabled={!entry.txn.trim() || entry.ids.size === 0} icon="fa-solid fa-check" onClick={saveEntry}>
                            {t('details.entrySave', { count: entry.ids.size })}
                        </Button>
                    </div>
                </div>
            )}
            {containers.length === 0 && <EmptyState icon="fa-solid fa-box" title={t('details.noContainers')} />}
            {containers.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                    <table className="dc-table">
                        <thead>
                            <tr>
                                <th>{iso ? t('details.colContainer') : t('details.colUnit')}</th>
                                <th>{iso ? t('details.colEtas') : t('field.etaShort')}</th>
                                <th>{t('details.colCbsa')}</th>
                                {canChange && <th aria-label="actions" />}
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map((c) => (
                                <tr key={c.container_id}>
                                    <td className="dc-td-head" data-label={t('details.colContainer')}>
                                        <div>
                                            <span className="dc-mono dc-strong">{c.container_number || '—'}</span>
                                            {c.size_type && <span className="dc-small dc-muted"> · {c.size_type}</span>}
                                            {c.seal_number && <div className="dc-small dc-muted">{t('field.sealShort')} <span className="dc-mono">{c.seal_number}</span></div>}
                                        </div>
                                    </td>
                                    <td data-label={iso ? t('details.colEtas') : t('field.etaShort')}>
                                        {iso ? <EtaList c={c} /> : <span style={{ whiteSpace: 'nowrap' }}>{formatDate(c.eta, true)}</span>}
                                    </td>
                                    <td data-label={t('details.colCbsa')}>
                                        <div>
                                            <CbsaBadge code={c.cb_status} label={c.cb_status_label} />
                                            {c.cb_status_time && <div className="dc-small dc-muted">{formatDate(c.cb_status_time, true)}</div>}
                                            {IS_ADMIN && <div className="dc-small dc-muted" style={{ whiteSpace: 'nowrap' }}>{t('details.colTxn')} <span className="dc-mono">{display(c.transaction_number)}</span></div>}
                                        </div>
                                    </td>
                                    {canChange && (
                                        <td data-label="" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <Button variant="ghost" size="sm" icon="fa-solid fa-pen" onClick={() => startEdit(c)} aria-label={t('common.edit')} />
                                            {containers.length > 1 && <Button variant="ghost" size="sm" icon="fa-regular fa-trash-can" onClick={() => remove(c)} aria-label={t('common.remove')} />}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {IS_ADMIN && iso && (etaNotes.length > 0 || lastCheck) && (
                <div className="dc-small dc-muted" style={{ padding: '8px 16px 12px' }}>
                    <i className="fa-solid fa-satellite-dish" style={{ marginRight: 6 }} />
                    {lastCheck && t('details.etaChecked', { when: formatDate(lastCheck, true) })}
                    {etaNotes.length > 0 && <span>{lastCheck ? ' · ' : ''}{etaNotes.join(' ')}</span>}
                </div>
            )}
            {editing !== null && (
                <div style={{ padding: 16, borderTop: '1px solid var(--dc-line)' }}>
                    <div className="dc-section-title">{editing === 'new' ? t('details.addContainerTitle') : t('details.editContainerTitle')}</div>
                    <div className="dc-grid dc-grid-3">
                        <Field label={iso ? t('field.containerNumber') : t('field.uldShort')} required={iso} upper name="container_number" value={form.container_number}
                            error={errors.container_number} warning={check.error || check.warning}
                            onChange={(e) => setForm((f) => ({ ...f, container_number: e.target.value }))} />
                        {iso && (
                            <Field label={t('field.sizeType')} name="size_type" as="select" value={form.size_type} onChange={(e) => setForm((f) => ({ ...f, size_type: e.target.value }))}
                                options={[{ value: '', label: '—' }, ...options.container_sizes.map((s) => ({ value: s, label: s }))]} />
                        )}
                        <Field label={t('field.sealShort')} name="seal_number" value={form.seal_number} onChange={(e) => setForm((f) => ({ ...f, seal_number: e.target.value }))} />
                        <Field label={IS_ADMIN && iso ? t('details.etaExpected') : t('field.etaShort')} name="eta" type="datetime-local" value={form.eta} onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))} />
                        <Field label={t('field.destinationShort')} name="destination" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
                        {IS_ADMIN && (
                            <Field label={t('field.transactionNumber')} name="transaction_number" value={form.transaction_number} error={errors.transaction_number}
                                hint={t('field.transactionHintAdmin')} onChange={(e) => setForm((f) => ({ ...f, transaction_number: e.target.value }))} />
                        )}
                    </div>
                    {IS_ADMIN && iso && (
                        <>
                            <div className="dc-section-title" style={{ marginTop: 16 }}>{t('details.etasTitle')}</div>
                            <p className="dc-small dc-muted" style={{ marginTop: 0 }}>{t('details.etasHelp')}</p>
                            <div className="dc-grid dc-grid-3">
                                <Field label={t('details.etaVessel')} name="vessel_eta" type="datetime-local" value={form.vessel_eta} error={errors.vessel_eta}
                                    onChange={(e) => setForm((f) => ({ ...f, vessel_eta: e.target.value }))} />
                                <Field label={t('details.etaPort')} name="port_eta" type="datetime-local" value={form.port_eta} error={errors.port_eta}
                                    onChange={(e) => setForm((f) => ({ ...f, port_eta: e.target.value }))} />
                                <Field label={t('details.railCarrier')} name="rail_carrier" as="select" value={form.rail_carrier} error={errors.rail_carrier}
                                    onChange={(e) => setForm((f) => ({ ...f, rail_carrier: e.target.value }))}
                                    options={[{ value: '', label: t('details.railCarrierNone') }, { value: 'CN', label: 'CN (Canadian National)' }, { value: 'CPKC', label: 'CPKC (Canadian Pacific Kansas City)' }]} />
                                <Field label={t('details.etaRail')} name="rail_eta" type="datetime-local" value={form.rail_eta} error={errors.rail_eta}
                                    onChange={(e) => setForm((f) => ({ ...f, rail_eta: e.target.value }))} />
                                <Field label={t('details.railDestination')} name="rail_destination" value={form.rail_destination} placeholder={t('details.railDestinationPlaceholder')}
                                    onChange={(e) => setForm((f) => ({ ...f, rail_destination: e.target.value }))} />
                            </div>
                        </>
                    )}
                    <div className="dc-actions end" style={{ marginTop: 14 }}>
                        <Button variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
                        <Button busy={saving} icon="fa-solid fa-check" onClick={save}>{t('common.save')}</Button>
                    </div>
                </div>
            )}
        </Card>
    );
}

/** The three tracked ETAs of one container, each with where it came from. */
const ETA_FIELDS = ['vessel_eta', 'port_eta', 'rail_eta'];

function EtaSource({ source, updatedAt }) {
    const { t } = useTranslation();
    if (!source) return null;
    // "Manual" only means something to staff; clients just see the date.
    if (!IS_ADMIN && source === 'manual') return null;
    const name = t(`details.source.${source}`, { defaultValue: source });
    return (
        <Badge tone={source === 'manual' ? 'gray' : 'blue'} plain title={updatedAt ? t('details.etaSourceTitle', { source: name, when: formatDate(updatedAt, true) }) : name}>
            {name}
        </Badge>
    );
}

function EtaList({ c }) {
    const { t } = useTranslation();
    const rows = [
        c.vessel_eta && { key: 'vessel', label: t('details.etaVessel'), when: c.vessel_eta, source: c.vessel_eta_source, updated: c.vessel_eta_updated_at },
        c.port_eta && { key: 'port', label: t('details.etaPort'), when: c.port_eta, source: c.port_eta_source, updated: c.port_eta_updated_at },
        (c.rail_eta || c.rail_carrier) && {
            key: 'rail',
            label: c.rail_carrier ? t('details.etaRailBy', { carrier: c.rail_carrier }) : t('details.etaRail'),
            when: c.rail_eta,
            source: c.rail_eta_source,
            updated: c.rail_eta_updated_at,
            place: c.rail_destination,
        },
    ].filter(Boolean);
    if (!rows.length && c.eta) rows.push({ key: 'expected', label: IS_ADMIN ? t('details.etaExpected') : t('field.etaShort'), when: c.eta });
    if (!rows.length) return <span className="dc-muted">{t('details.etaNone')}</span>;
    return (
        <div style={{ display: 'grid', gap: 4, minWidth: 160 }}>
            {rows.map((r) => (
                <div key={r.key} className="dc-small" style={{ lineHeight: 1.35 }}>
                    <span className="dc-muted">{r.label}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="dc-strong" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.when, true)}</span>
                        <EtaSource source={r.source} updatedAt={r.updated} />
                    </div>
                    {r.place && <div className="dc-muted">{t('details.etaTo', { place: r.place })}</div>}
                </div>
            ))}
        </div>
    );
}

/* --------------------------------------------------------------- documents */

function DocumentsCard({ documents, ticket, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [busyType, setBusyType] = useState(null);
    const required = documents.filter((d) => d.requirement === 'required');
    const received = required.filter((d) => d.received).length;
    const visible = documents.filter((d) => d.requirement !== 'broker' || d.received || IS_ADMIN);

    const upload = async (type, files) => {
        setBusyType(type);
        try {
            for (const f of files) await customsApi.upload(ticket.cb_id, type, f);
            toast.success(files.length > 1 ? t('details.filesUploaded', { count: files.length }) : t('details.fileUploaded'));
            onSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusyType(null);
        }
    };

    const remove = async (file) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(t('details.confirmDelete', { name: file.file_name }))) return;
        try {
            await customsApi.deleteFile(file.file_id);
            toast.success(t('details.fileDeleted'));
            onSaved();
        } catch (e) {
            toast.error(e.message);
        }
    };

    return (
        <Card
            id="dc-documents"
            title={t('details.documents')}
            sub={t('details.docsReceived', { received, required: required.length })}
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
                                {docName(d.key)}
                                {d.requirement === 'required' && !d.received && <Badge tone="amber" plain>{t('common.required')}</Badge>}
                                {d.requirement === 'recommended' && !d.received && <Badge tone="gray" plain>{t('common.recommended')}</Badge>}
                            </div>
                            {d.hint && <div className="dc-doc-hint">{IS_ADMIN && ADMIN_HINT[d.key] ? t(ADMIN_HINT[d.key]) : docHint(d.key, d.hint)}</div>}
                            {d.files.length > 0 && (
                                <div className="dc-doc-files">
                                    {d.files.map((f) => (
                                        <div className="dc-doc-file" key={f.file_id}>
                                            <i className="fa-regular fa-file-lines dc-muted" />
                                            <a href={f.file_link} target="_blank" rel="noreferrer">{f.file_name || t('common.file')}</a>
                                            <span>{formatDate(f.create_date)}</span>
                                            {IS_ADMIN && <button type="button" className="dc-link" style={{ color: 'var(--dc-red)' }} onClick={() => remove(f)}>{t('common.delete')}</button>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="dc-doc-side">
                            {busyType === d.key ? <span className="dc-spinner" /> : (
                                (IS_ADMIN || d.requirement !== 'broker' || d.key === 'release cad') && (
                                    <DropZone compact label={d.received ? t('common.add') : t('common.upload')} onFiles={(files) => upload(d.key, files)} />
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
    const { t } = useTranslation();
    const draft = documents.find((d) => d.key === 'draft cad');
    const cad = containers.reduce((max, c) => Math.max(max, Number(c.cad_status) || 0), 0);
    const [busy, setBusy] = useState(false);
    if (!draft || !draft.received) return null;

    const approve = async () => {
        setBusy(true);
        try {
            await customsApi.update(ticket.main_id, { cad_status: 2 });
            toast.success(t('details.approved'));
            onSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    const latest = draft.files[0];
    return (
        <Card title={t('details.cadTitle')}>
            <p style={{ fontSize: 14, marginTop: 0 }}>
                {IS_ADMIN ? t('details.cadAdmin') : t('details.cadClient')}
            </p>
            {latest && (
                <a className="dc-btn dc-btn-secondary dc-btn-block" href={latest.file_link} target="_blank" rel="noreferrer" style={{ marginBottom: 10 }}>
                    <i className="fa-regular fa-file-pdf" /> {t('details.openDraft')}
                </a>
            )}
            {cad >= 2 ? (
                <Badge tone="green">{CAD_STATUS[2]}</Badge>
            ) : IS_ADMIN ? (
                <Badge tone="amber">{t('details.waitingApproval')}</Badge>
            ) : (
                <Button block busy={busy} icon="fa-solid fa-check" onClick={approve}>{t('details.approveDraft')}</Button>
            )}
        </Card>
    );
}

/* ------------------------------------------------------------- stage (admin) */

function StageCard({ ticket, options, documents, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [stage, setStage] = useState(ticket.stage);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => setStage(ticket.stage), [ticket.stage]);

    const save = async (nextStage = stage, msg = message) => {
        setBusy(true);
        try {
            await customsApi.setStage(ticket.main_id, nextStage, msg || undefined);
            toast.success(t('details.stageUpdated'));
            setMessage('');
            onSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    const path = options.main_path;
    // From "action needed" the next step is back to the review; an exam continues to release.
    const next = ticket.stage === 'awaiting_client' ? 'in_review' : path[path.indexOf(ticket.stage === 'cbsa_exam' ? 'release_requested' : ticket.stage) + 1];
    // Documents the client could still send, offered when asking the client for something.
    const askable = documents.filter((d) => d.requirement !== 'broker' && !d.received);
    const ask = (d) => {
        const name = docName(d.key);
        setMessage((m) => (m.includes(name) ? m : (m ? `${m.trim()} ` : '') + t('details.askForMessage', { list: name })));
    };
    const nextLabel = next && stageName(next, options.stages.find((s) => s.key === next).label);

    return (
        <Card title={t('details.stageTitle')} sub={t('details.stageSub')}>
            {nextLabel && !['completed', 'cancelled'].includes(ticket.stage) && (
                <Button block busy={busy} icon="fa-solid fa-forward" onClick={() => save(next, message)} style={{ marginBottom: 14 }}>
                    {t('details.moveTo', { stage: nextLabel })}
                </Button>
            )}
            <div className="dc-grid" style={{ gap: 12 }}>
                <Field label={t('details.orSet')} name="stage" as="select" value={stage} onChange={(e) => setStage(e.target.value)}
                    options={options.stages.map((s) => ({ value: s.key, label: stageName(s.key, s.label) }))} />
                {stage === 'awaiting_client' && askable.length > 0 && (
                    <div>
                        <div className="dc-small dc-muted" style={{ marginBottom: 6 }}>{t('details.askFor')}</div>
                        <div className="dc-chips" style={{ padding: 0 }}>
                            {askable.map((d) => (
                                <button key={d.key} type="button" className="dc-chip" onClick={() => ask(d)}>{docName(d.key)}</button>
                            ))}
                        </div>
                    </div>
                )}
                <Field label={t('details.messageToClient')} name="stage_message" as="textarea" rows={2} value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={stage === 'awaiting_client' ? t('details.messageAwaiting') : t('details.messageShown')} />
                <Button variant="secondary" busy={busy} disabled={stage === ticket.stage} onClick={() => save()}>{t('details.updateStage')}</Button>
            </div>
        </Card>
    );
}

/* ---------------------------------------------------------------- timeline */

function TimelineCard({ timeline, ticket, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [text, setText] = useState('');
    const [internal, setInternal] = useState(false);
    const [busy, setBusy] = useState(false);
    const endRef = useRef(null);
    const items = useMemo(() => [...timeline].reverse(), [timeline]);
    const [all, setAll] = useState(false);
    const SHOWN = 6;
    const shown = all ? items : items.slice(0, SHOWN);

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
        <Card id="dc-timeline" title={t('details.timeline')} tight>
            <div className="dc-composer" style={{ borderTop: 0, borderBottom: '1px solid var(--dc-line)' }}>
                <textarea
                    className="dc-input"
                    rows={2}
                    placeholder={IS_ADMIN ? t('details.composeAdmin') : t('details.composeClient')}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
                />
                <div className="dc-actions" style={{ justifyContent: 'space-between' }}>
                    {IS_ADMIN ? (
                        <label className="dc-small" style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
                            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> {t('details.internalNote')}
                        </label>
                    ) : <span />}
                    <Button size="sm" busy={busy} disabled={!text.trim()} icon="fa-solid fa-paper-plane" onClick={send}>{t('common.send')}</Button>
                </div>
            </div>
            <div style={{ padding: '18px 20px 4px' }}>
                {items.length === 0 && <div className="dc-muted">{t('common.nothingYet')}</div>}
                <ul className="dc-timeline">
                    {shown.map((e) => {
                        const style = e.event_type === 'stage' ? { icon: '', tone: STAGE_TONE[e.stage] || 'teal' } : EVENT_STYLE[e.event_type] || EVENT_STYLE.update;
                        const who = e.actor_role === 'system' ? (e.actor_name && e.actor_name !== 'CBSA via Candata' ? e.actor_name : t('details.whoSystem')) : e.actor_role === 'admin' ? (IS_ADMIN ? e.actor_name || 'DeepClear' : 'DeepClear') : e.actor_name || t('details.whoClient');
                        return (
                            <li key={e.event_id} className={`dc-tl-item ${e.event_type === 'comment' ? 'comment' : ''} ${!e.visible_to_client ? 'internal' : ''}`}>
                                <span className={`dc-tl-dot dc-tone-${style.tone}`} style={{ background: 'currentColor' }} />
                                <div className="dc-tl-meta">
                                    <b style={{ color: 'var(--dc-ink-2)' }}>{who}</b> · <span title={formatDate(e.created_at, true)}>{timeAgo(e.created_at)}</span>
                                    {!e.visible_to_client && <> · <Badge tone="amber" plain>{t('common.internal')}</Badge></>}
                                </div>
                                {e.event_type === 'stage' && (
                                    <div className="dc-tl-text">{t('details.stageLine')} <b>{stageName(e.stage, e.stage_label)}</b></div>
                                )}
                                {e.message && <div className="dc-tl-text">{eventText(e.message)}</div>}
                            </li>
                        );
                    })}
                </ul>
                {items.length > SHOWN && (
                    <button type="button" className="dc-link" style={{ margin: '0 0 14px 22px' }} onClick={() => setAll((v) => !v)}>
                        {all ? t('details.showLess') : t('details.showAll', { count: items.length })}
                    </button>
                )}
                <div ref={endRef} />
            </div>
        </Card>
    );
}
