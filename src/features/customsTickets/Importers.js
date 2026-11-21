/**
 * Importer profiles and their power of attorney (POA).
 *
 * A client can import under one or more businesses (importers). Each needs a
 * signed POA (agency agreement) on file before DeepClear clears goods for it.
 * This is set up once per importer; a new shipment just picks the importer.
 *
 *   Staff (account managers): add / edit / remove importers, set the default,
 *          record the POA status and dates, upload the signed POA.
 *   Clients: see their importers and upload a signed POA.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACCEPTED_FILES, Badge, Button, Card, EmptyState, Field, Page, Spinner, formatDate, useToast } from '../../ui/components';
import { getSession } from '../../api/session';
import { IS_ADMIN, importersApi } from './customs.api';

/** Staff who manage client accounts (operations staff, department 2, do not). */
export const canManageAccounts = () => IS_ADMIN && Number((getSession() || {}).department) !== 2;

const POA_TONE = { ok: 'green', expiring: 'amber', expired: 'red', sent: 'amber', missing: 'red' };
const POA_ICON = {
    ok: 'fa-solid fa-circle-check',
    expiring: 'fa-solid fa-hourglass-half',
    expired: 'fa-solid fa-circle-exclamation',
    sent: 'fa-regular fa-paper-plane',
    missing: 'fa-solid fa-circle-exclamation',
};
/** POA states that should stop a clearance until someone chases the signed copy. */
export const poaNeedsAction = (state) => ['missing', 'sent', 'expired'].includes(state);

export function PoaBadge({ importer }) {
    const { t } = useTranslation();
    const state = importer.poa_state || 'missing';
    const title = importer.poa_expires_on ? t('importers.expiresOn', { date: formatDate(importer.poa_expires_on) }) : undefined;
    return (
        <Badge tone={POA_TONE[state]} title={title}>
            <i className={POA_ICON[state]} style={{ marginRight: 4 }} />{t(`importers.poa.${state}`)}
        </Badge>
    );
}

/** One line for a POA: signed / expiry dates. */
function PoaDates({ importer }) {
    const { t } = useTranslation();
    const parts = [];
    if (importer.poa_signed_on) parts.push(t('importers.signedOn', { date: formatDate(importer.poa_signed_on) }));
    if (importer.poa_expires_on) parts.push(t('importers.expiresOn', { date: formatDate(importer.poa_expires_on) }));
    else if (importer.poa_status === 'signed') parts.push(t('importers.noExpiry'));
    return parts.length ? <div className="dc-small dc-muted">{parts.join(' · ')}</div> : null;
}

const EMPTY = { legal_name: '', importer_bn: '', address: '', is_default: false, poa_status: 'missing', poa_signed_on: '', poa_expires_on: '' };
const pick = (r) => ({
    legal_name: r.legal_name || '',
    importer_bn: r.importer_bn || '',
    address: r.address || '',
    is_default: Boolean(r.is_default),
    poa_status: r.poa_status || 'missing',
    poa_signed_on: r.poa_signed_on || '',
    poa_expires_on: r.poa_expires_on || '',
});

function ImporterForm({ clientId, editing, onDone, onCancel }) {
    const { t } = useTranslation();
    const toast = useToast();
    const isNew = editing === 'new';
    const [form, setForm] = useState(isNew ? EMPTY : pick(editing));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const set = (k) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm((f) => ({ ...f, [k]: v }));
        setErrors((x) => ({ ...x, [k]: undefined }));
    };

    async function save(e) {
        e.preventDefault();
        setSaving(true);
        try {
            const body = { ...form, poa_signed_on: form.poa_signed_on || null, poa_expires_on: form.poa_expires_on || null };
            if (isNew) body.client_id = clientId; else body.importer_id = editing.importer_id;
            const r = await importersApi.save(body);
            toast.success(isNew ? t('importers.added') : t('importers.saved'));
            onDone(r.importer);
        } catch (err) {
            setErrors(err.fields || {});
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={save} noValidate className="dc-row-card" style={{ marginBottom: 12 }}>
            <div className="dc-row-card-head"><span>{isNew ? t('importers.add') : t('importers.edit', { name: editing.legal_name })}</span></div>
            <div className="dc-grid dc-grid-2">
                <Field label={t('importers.legalName')} required name="imp_legal_name" value={form.legal_name} onChange={set('legal_name')}
                    error={errors.legal_name} hint={t('importers.legalNameHint')} autoFocus />
                <Field label={t('importers.bn')} required name="imp_importer_bn" upper value={form.importer_bn} onChange={set('importer_bn')}
                    error={errors.importer_bn} placeholder="123456789RM0001" hint={t('importers.bnHint')} />
                <Field label={t('importers.address')} name="imp_address" as="textarea" rows={2} value={form.address} onChange={set('address')} className="dc-span-all" />
                <Field label={t('importers.poaStatus')} name="imp_poa_status" as="select" value={form.poa_status} onChange={set('poa_status')} error={errors.poa_status}
                    options={['missing', 'sent', 'signed'].map((s) => ({ value: s, label: t(`importers.status.${s}`) }))} />
                <div className="dc-field">
                    <label htmlFor="imp_is_default">{t('importers.default')}</label>
                    <label className="dc-check" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                        <input id="imp_is_default" type="checkbox" checked={form.is_default} onChange={set('is_default')} />
                        {t('importers.defaultHint')}
                    </label>
                </div>
                <Field label={t('importers.signedLabel')} name="imp_poa_signed_on" type="date" value={form.poa_signed_on} onChange={set('poa_signed_on')} error={errors.poa_signed_on} />
                <Field label={t('importers.expiresLabel')} name="imp_poa_expires_on" type="date" value={form.poa_expires_on} onChange={set('poa_expires_on')}
                    error={errors.poa_expires_on} hint={t('importers.expiresHint')} />
            </div>
            <div className="dc-actions end" style={{ marginTop: 8 }}>
                <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
                <Button type="submit" busy={saving} icon="fa-solid fa-check">{isNew ? t('importers.addBtn') : t('common.save')}</Button>
            </div>
        </form>
    );
}

/** Upload-signed-POA button (hidden file input). */
export function PoaUpload({ importer, onDone }) {
    const { t } = useTranslation();
    const toast = useToast();
    const input = useRef(null);
    const [busy, setBusy] = useState(false);
    async function onFile(e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        try {
            const r = await importersApi.uploadPoa(importer.importer_id, file);
            toast.success(t('importers.uploaded', { name: importer.legal_name }));
            onDone(r.importer);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }
    const signed = importer.poa_status === 'signed';
    return (
        <>
            <input ref={input} type="file" accept={ACCEPTED_FILES} style={{ display: 'none' }} onChange={onFile} data-testid={`poa-file-${importer.importer_id}`} />
            <Button variant={signed ? 'ghost' : 'primary'} size="sm" icon="fa-solid fa-file-arrow-up" busy={busy} onClick={() => input.current && input.current.click()}>
                {signed ? t('importers.replacePoa') : t('importers.uploadPoa')}
            </Button>
        </>
    );
}

/**
 * The importers of one client, as a list of cards.
 * canManage: staff who may add / edit / remove (account managers).
 */
export function ImportersPanel({ clientId, canManage = false, onChange }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null); // null | 'new' | row

    const load = useCallback(() => {
        setError('');
        return importersApi.list(clientId).then((r) => setRows(r.data || [])).catch((e) => setError(e.message));
    }, [clientId]);
    useEffect(() => { setRows(null); setEditing(null); load(); }, [load]);

    const changed = () => { load(); if (onChange) onChange(); };

    async function remove(row) {
        // eslint-disable-next-line no-alert
        if (!window.confirm(t('importers.confirmRemove', { name: row.legal_name }))) return;
        try {
            await importersApi.remove(row.importer_id);
            toast.success(t('importers.removed', { name: row.legal_name }));
            changed();
        } catch (e) {
            toast.error(e.message);
        }
    }
    async function makeDefault(row) {
        try {
            await importersApi.save({ importer_id: row.importer_id, legal_name: row.legal_name, importer_bn: row.importer_bn, address: row.address, is_default: true });
            changed();
        } catch (e) {
            toast.error(e.message);
        }
    }

    if (error) return <div className="dc-alert dc-tone-red">{error}</div>;
    if (!rows) return <Spinner />;

    return (
        <div className="dc-importers">
            {editing && <ImporterForm key={editing === 'new' ? 'new' : editing.importer_id} clientId={clientId} editing={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); changed(); }} />}
            {rows.length === 0 && !editing && (
                <EmptyState icon="fa-solid fa-building-shield" title={t('importers.none')}
                    action={canManage && <Button icon="fa-solid fa-plus" onClick={() => setEditing('new')}>{t('importers.add')}</Button>}>
                    {canManage ? t('importers.noneStaff') : t('importers.noneClient')}
                </EmptyState>
            )}
            {rows.map((r) => (
                <div className="dc-row-card dc-importer" key={r.importer_id} data-importer={r.importer_id}>
                    <div className="dc-importer-main">
                        <div>
                            <div className="dc-strong">
                                {r.legal_name}
                                {r.is_default && <span style={{ marginLeft: 8 }}><Badge tone="teal" plain>{t('importers.defaultBadge')}</Badge></span>}
                            </div>
                            <div className="dc-small"><span className="dc-mono">{r.importer_bn}</span></div>
                            {r.address && <div className="dc-small dc-muted" style={{ whiteSpace: 'pre-line' }}>{r.address}</div>}
                        </div>
                        <div className="dc-importer-poa">
                            <PoaBadge importer={r} />
                            <PoaDates importer={r} />
                            {r.poa_file_link && (
                                <div className="dc-small">
                                    <a href={r.poa_file_link} target="_blank" rel="noreferrer"><i className="fa-regular fa-file-lines" /> {r.poa_file_name || t('importers.poaFile')}</a>
                                </div>
                            )}
                        </div>
                    </div>
                    {poaNeedsAction(r.poa_state) && !IS_ADMIN && (
                        <div className="dc-small" style={{ marginTop: 8, color: 'var(--dc-ink-2, inherit)' }}>{t(`importers.clientNeeds.${r.poa_state}`)}</div>
                    )}
                    <div className="dc-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                        <PoaUpload importer={r} onDone={changed} />
                        {canManage && (
                            <>
                                <Button variant="ghost" size="sm" icon="fa-solid fa-pen" onClick={() => setEditing(r)}>{t('common.edit')}</Button>
                                {!r.is_default && <Button variant="ghost" size="sm" icon="fa-regular fa-star" onClick={() => makeDefault(r)}>{t('importers.makeDefault')}</Button>}
                                <Button variant="ghost" size="sm" icon="fa-regular fa-trash-can" onClick={() => remove(r)}>{t('common.remove')}</Button>
                            </>
                        )}
                    </div>
                </div>
            ))}
            {canManage && rows.length > 0 && !editing && (
                <Button variant="secondary" size="sm" icon="fa-solid fa-plus" onClick={() => setEditing('new')}>{t('importers.add')}</Button>
            )}
        </div>
    );
}

/** Client portal page: "Importers & POA". */
export default function ImportersPage() {
    const { t } = useTranslation();
    return (
        <Page title={t('importers.title')} subtitle={t('importers.clientSub')}>
            <Card>
                <p className="dc-small dc-muted" style={{ marginTop: 0 }}><i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />{t('importers.clientLead')}</p>
                <ImportersPanel />
            </Card>
        </Page>
    );
}
