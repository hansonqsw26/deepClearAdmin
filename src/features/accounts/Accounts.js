/**
 * Client and staff accounts (admin portal).
 *
 *   /client-accounts  importers DeepClear clears goods for (company details, BN, language)
 *   /staff-accounts   DeepClear team members (full access or operations only)
 *
 * New accounts and password resets get a temporary password, shown once with a
 * ready-to-send message; the person chooses their own at first sign-in.
 * Accounts are turned off rather than deleted, so their shipments stay intact.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState, Field, Page, Spinner, formatDate, timeAgo, useDebounced, useToast } from '../../ui/components';
import { call } from '../customsTickets/customs.api';

const CLIENT_PORTAL_URL = process.env.REACT_APP_CLIENT_PORTAL_URL || 'https://client.deepclear.ca';
const ADMIN_PORTAL_URL = process.env.REACT_APP_ADMIN_PORTAL_URL || 'https://admin.deepclear.ca';

const EMPTY_CLIENT = { company_name: '', client_name: '', importer_bn: '', contact_name: '', email: '', phone: '', address: '', preferred_lang: 'en', notes: '' };
const EMPTY_STAFF = { full_name: '', admin_name: '', role: 'full', email: '', phone: '' };

async function copyText(text, toast, t) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(t('accounts.copied'));
    } catch (e) {
        toast.error(t('accounts.copyFailed'));
    }
}

/** Search box, Active / Turned off / All chips. */
function Toolbar({ search, setSearch, status, setStatus, placeholder }) {
    const { t } = useTranslation();
    return (
        <>
            <div className="dc-toolbar">
                <div className="dc-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input className="dc-input" placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </div>
            <div className="dc-chips">
                {[['active', 'filterActive'], ['off', 'filterOff'], ['all', 'filterAll']].map(([key, label]) => (
                    <button key={key} type="button" className={`dc-chip ${status === key ? 'active' : ''}`} onClick={() => setStatus(key)}>
                        {t(`accounts.${label}`)}
                    </button>
                ))}
            </div>
        </>
    );
}

/** Temporary password + a message to send, shown once after create or reset. */
function Credentials({ creds, onClose }) {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const lng = creds.lang || i18n.language;
    const message = t('accounts.invite', { lng, name: creds.greet, url: creds.url, login: creds.login, password: creds.password });
    return (
        <Card title={t('accounts.credsTitle', { name: creds.name })}>
            <p className="dc-small dc-muted" style={{ marginTop: 0 }}>{t('accounts.credsLead', { name: creds.name })}</p>
            <dl className="dc-creds">
                <dt>{t('accounts.portal')}</dt><dd>{creds.url}</dd><span />
                <dt>{t('accounts.loginName')}</dt><dd>{creds.login}</dd>
                <Button variant="ghost" size="sm" icon="fa-regular fa-copy" onClick={() => copyText(creds.login, toast, t)} aria-label={t('accounts.copy')} />
                <dt>{t('accounts.tempPassword')}</dt><dd className="dc-strong">{creds.password}</dd>
                <Button variant="ghost" size="sm" icon="fa-regular fa-copy" onClick={() => copyText(creds.password, toast, t)} aria-label={t('accounts.copy')} />
            </dl>
            <Field label={t('accounts.message')} name="creds_message" as="textarea" rows={10} readOnly value={message} className="dc-span-all" />
            <div className="dc-actions end" style={{ marginTop: 12 }}>
                <Button variant="ghost" onClick={onClose}>{t('accounts.done')}</Button>
                <Button icon="fa-regular fa-copy" onClick={() => copyText(message, toast, t)}>{t('accounts.copyMessage')}</Button>
            </div>
        </Card>
    );
}

const StatusBadge = ({ row }) => {
    const { t } = useTranslation();
    return row.active ? <Badge tone="green">{t('accounts.statusActive')}</Badge> : <Badge tone="gray">{t('accounts.statusOff')}</Badge>;
};

function LastSignIn({ row }) {
    const { t } = useTranslation();
    return (
        <div>
            <div title={row.last_login_at ? formatDate(row.last_login_at, true) : ''}>{row.last_login_at ? timeAgo(row.last_login_at) : <span className="dc-muted">{t('accounts.never')}</span>}</div>
            {row.must_change_password && <div style={{ marginTop: 4 }}><Badge tone="amber" plain>{t('accounts.tempPending')}</Badge></div>}
        </div>
    );
}

/** Shared list state: search, status filter, loading. */
function useAccountList(path) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('active');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const q = useDebounced(search, 250);
    const load = useCallback(() => {
        setError('');
        return call(path, { search: q || undefined, status }).then(setResult).catch((e) => setError(e.message));
    }, [path, q, status]);
    useEffect(() => { setResult(null); load(); }, [load]);
    return { search, setSearch, status, setStatus, result, error, reload: load, filtered: Boolean(q) || status !== 'active' };
}

/** Turn off / on and password reset, the same for clients and staff. */
function useRowActions({ kind, idKey, nameOf, onCreds, reload }) {
    const { t } = useTranslation();
    const toast = useToast();
    const toggle = async (row) => {
        const name = nameOf(row);
        // eslint-disable-next-line no-alert
        if (row.active && !window.confirm(t('accounts.confirmOff', { name }))) return;
        try {
            await call(kind === 'client' ? '/setClientActive' : '/setStaffActive', { [idKey]: row[idKey], active: !row.active });
            toast.success(t(row.active ? 'accounts.turnedOff' : 'accounts.turnedOn', { name }));
            reload();
        } catch (e) {
            toast.error(e.message);
        }
    };
    const reset = async (row) => {
        const name = nameOf(row);
        // eslint-disable-next-line no-alert
        if (!window.confirm(t('accounts.confirmReset', { name }))) return;
        try {
            const r = await call(kind === 'client' ? '/resetClientPassword' : '/resetStaffPassword', { [idKey]: row[idKey] });
            onCreds(row, r.temp_password);
            reload();
        } catch (e) {
            toast.error(e.message);
        }
    };
    return { toggle, reset };
}

function RowActions({ row, onEdit, onReset, onToggle, canToggle = true }) {
    const { t } = useTranslation();
    return (
        <span className="dc-icon-actions" style={{ gap: 0 }} onClick={(e) => e.stopPropagation()} role="presentation">
            <Button variant="ghost" size="sm" icon="fa-solid fa-pen" onClick={() => onEdit(row)} title={t('accounts.edit')} aria-label={t('accounts.edit')} />
            {row.active && <Button variant="ghost" size="sm" icon="fa-solid fa-key" onClick={() => onReset(row)} title={t('accounts.reset')} aria-label={t('accounts.reset')} />}
            {canToggle && (
                <Button variant="ghost" size="sm" icon={row.active ? 'fa-solid fa-power-off' : 'fa-solid fa-rotate-left'} onClick={() => onToggle(row)}
                    title={row.active ? t('accounts.turnOff') : t('accounts.turnOn')} aria-label={row.active ? t('accounts.turnOff') : t('accounts.turnOn')} />
            )}
        </span>
    );
}

function useFormState(empty) {
    const [editing, setEditing] = useState(null); // null | 'new' | row
    const [form, setForm] = useState(empty);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const open = (row, pick) => {
        setErrors({});
        setForm(row ? pick(row) : empty);
        setEditing(row || 'new');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    return { editing, setEditing, form, setForm, errors, setErrors, saving, setSaving, open, set };
}

/* ================================================================= clients */

const pickClient = (r) => Object.fromEntries(Object.keys(EMPTY_CLIENT).map((k) => [k, r[k] || EMPTY_CLIENT[k]]));
const clientLabel = (r) => r.company_name || r.client_name;

export function ClientAccounts() {
    const { t } = useTranslation();
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const list = useAccountList('/listClients');
    const f = useFormState(EMPTY_CLIENT);
    const [creds, setCreds] = useState(null);

    const showCreds = (row, password) => setCreds({
        name: clientLabel(row), greet: row.contact_name || clientLabel(row), login: row.client_name, password,
        url: CLIENT_PORTAL_URL, lang: row.preferred_lang,
    });
    const actions = useRowActions({ kind: 'client', idKey: 'client_id', nameOf: clientLabel, onCreds: showCreds, reload: list.reload });

    useEffect(() => {
        if (params.get('new')) { f.open(null); setParams({}, { replace: true }); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const isNew = f.editing === 'new';
    async function save(e) {
        e.preventDefault();
        f.setSaving(true);
        try {
            const body = { ...f.form };
            if (!isNew) { body.client_id = f.editing.client_id; delete body.client_name; }
            const r = await call('/saveClient', body);
            toast.success(isNew ? t('accounts.created') : t('accounts.saved'));
            f.setEditing(null);
            setCreds(null);
            if (r.temp_password) showCreds(r.client, r.temp_password);
            list.reload();
        } catch (err) {
            f.setErrors(err.fields || {});
            toast.error(err.message);
        } finally {
            f.setSaving(false);
        }
    }

    const rows = list.result ? list.result.data : null;
    return (
        <Page
            title={t('accounts.clientsTitle')}
            subtitle={t('accounts.clientsSub')}
            actions={f.editing === null && <Button icon="fa-solid fa-plus" onClick={() => { setCreds(null); f.open(null); }}>{t('accounts.newClient')}</Button>}
        >
            {creds && <Credentials creds={creds} onClose={() => setCreds(null)} />}

            {f.editing !== null && (
                <Card title={isNew ? t('accounts.newClient') : t('accounts.editClient', { name: clientLabel(f.editing) })}>
                    <form onSubmit={save} noValidate>
                        <div className="dc-section-title">{t('accounts.sectionCompany')}</div>
                        <div className="dc-grid dc-grid-2">
                            <Field label={t('accounts.companyName')} required name="company_name" value={f.form.company_name} onChange={f.set('company_name')}
                                error={f.errors.company_name} hint={t('accounts.companyHint')} autoFocus />
                            <Field label={t('accounts.bn')} name="importer_bn" upper value={f.form.importer_bn} onChange={f.set('importer_bn')}
                                error={f.errors.importer_bn} hint={t('accounts.bnHint')} placeholder="123456789RM0001" />
                            <Field label={t('accounts.address')} name="address" as="textarea" rows={2} value={f.form.address} onChange={f.set('address')} className="dc-span-all" />
                        </div>
                        <div className="dc-section-title">{t('accounts.sectionContact')}</div>
                        <div className="dc-grid dc-grid-3">
                            <Field label={t('accounts.contactName')} name="contact_name" value={f.form.contact_name} onChange={f.set('contact_name')} />
                            <Field label={t('accounts.email')} name="email" type="email" value={f.form.email} onChange={f.set('email')} error={f.errors.email} />
                            <Field label={t('accounts.phone')} name="phone" type="tel" value={f.form.phone} onChange={f.set('phone')} />
                        </div>
                        <div className="dc-section-title">{t('accounts.sectionSignIn')}</div>
                        <div className="dc-grid dc-grid-2">
                            {isNew ? (
                                <Field label={t('accounts.loginName')} required name="client_name" value={f.form.client_name} onChange={f.set('client_name')}
                                    error={f.errors.client_name} hint={t('accounts.loginHint')} autoComplete="off" />
                            ) : (
                                <Field label={t('accounts.loginFixed')} name="client_name" value={f.editing.client_name} readOnly disabled />
                            )}
                            <Field label={t('accounts.lang')} name="preferred_lang" as="select" value={f.form.preferred_lang} onChange={f.set('preferred_lang')}
                                hint={t('accounts.langHint')} options={[{ value: 'en', label: t('accounts.langEn') }, { value: 'zh', label: t('accounts.langZh') }]} />
                        </div>
                        <div className="dc-section-title">{t('accounts.sectionInternal')}</div>
                        <div className="dc-grid dc-grid-2">
                            <Field label={t('accounts.notes')} name="notes" as="textarea" rows={2} value={f.form.notes} onChange={f.set('notes')} hint={t('accounts.notesHint')} className="dc-span-all" />
                        </div>
                        {isNew && <p className="dc-small dc-muted"><i className="fa-solid fa-key" style={{ marginRight: 6 }} />{t('accounts.tempNote')}</p>}
                        <div className="dc-actions end" style={{ marginTop: 12 }}>
                            <Button variant="ghost" onClick={() => f.setEditing(null)}>{t('common.cancel')}</Button>
                            <Button type="submit" busy={f.saving} icon="fa-solid fa-check">{isNew ? t('accounts.create') : t('accounts.save')}</Button>
                        </div>
                    </form>
                </Card>
            )}

            <Card tight>
                <Toolbar search={list.search} setSearch={list.setSearch} status={list.status} setStatus={list.setStatus} placeholder={t('accounts.searchClients')} />
                <div style={{ marginTop: 12 }}>
                    {list.error && <div className="dc-alert dc-tone-red" style={{ margin: 16 }}>{list.error}</div>}
                    {!rows && !list.error && <Spinner />}
                    {rows && rows.length === 0 && (
                        <EmptyState icon="fa-solid fa-building" title={list.filtered ? t('accounts.noMatch') : t('accounts.noClients')}>
                            {list.filtered ? t('accounts.noMatchHint') : t('accounts.noClientsHint')}
                        </EmptyState>
                    )}
                    {rows && rows.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="dc-table">
                                <thead>
                                    <tr>
                                        <th>{t('accounts.colCompany')}</th>
                                        <th>{t('accounts.colContact')}</th>
                                        <th>{t('accounts.colBn')}</th>
                                        <th>{t('accounts.colOpen')}</th>
                                        <th>{t('accounts.colLastSignIn')}</th>
                                        <th>{t('accounts.colStatus')}</th>
                                        <th aria-label={t('accounts.moreActions')} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.client_id} className="clickable" onClick={() => { setCreds(null); f.open(r, pickClient); }} style={r.active ? undefined : { opacity: 0.65 }}>
                                            <td className="dc-td-head" data-label={t('accounts.colCompany')} style={{ minWidth: 180 }}>
                                                <div className="dc-strong">{clientLabel(r)}</div>
                                                <div className="dc-small dc-muted">
                                                    <span className="dc-mono">{r.client_name}</span>
                                                    {r.preferred_lang === 'zh' && <span title={t('accounts.lang')}> · 中文</span>}
                                                </div>
                                            </td>
                                            <td data-label={t('accounts.colContact')}>
                                                <div>{r.contact_name || <span className="dc-muted">—</span>}</div>
                                                {r.email && <div className="dc-small dc-muted">{r.email}</div>}
                                                {r.phone && <div className="dc-small dc-muted">{r.phone}</div>}
                                            </td>
                                            <td data-label={t('accounts.colBn')}>{r.importer_bn ? <span className="dc-mono">{r.importer_bn}</span> : <span className="dc-muted">—</span>}</td>
                                            <td data-label={t('accounts.colOpen')}>{r.open_shipments || <span className="dc-muted">0</span>}</td>
                                            <td data-label={t('accounts.colLastSignIn')}><LastSignIn row={r} /></td>
                                            <td data-label={t('accounts.colStatus')}><StatusBadge row={r} /></td>
                                            <td data-label="" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <RowActions row={r} onEdit={(row) => { setCreds(null); f.open(row, pickClient); }} onReset={actions.reset} onToggle={actions.toggle} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Card>
        </Page>
    );
}

/* =================================================================== staff */

const pickStaff = (r) => Object.fromEntries(Object.keys(EMPTY_STAFF).map((k) => [k, r[k] || EMPTY_STAFF[k]]));
const staffLabel = (r) => r.full_name || r.admin_name;

export function StaffAccounts() {
    const { t } = useTranslation();
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const list = useAccountList('/listStaff');
    const f = useFormState(EMPTY_STAFF);
    const [creds, setCreds] = useState(null);
    const me = list.result && list.result.me;

    const showCreds = (row, password) => setCreds({
        name: staffLabel(row), greet: staffLabel(row), login: row.admin_name, password, url: ADMIN_PORTAL_URL,
    });
    const actions = useRowActions({ kind: 'staff', idKey: 'admin_id', nameOf: staffLabel, onCreds: showCreds, reload: list.reload });

    useEffect(() => {
        if (params.get('new')) { f.open(null); setParams({}, { replace: true }); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const isNew = f.editing === 'new';
    const isMe = !isNew && f.editing && Number(f.editing.admin_id) === Number(me);
    async function save(e) {
        e.preventDefault();
        f.setSaving(true);
        try {
            const body = { ...f.form };
            if (!isNew) { body.admin_id = f.editing.admin_id; delete body.admin_name; }
            const r = await call('/saveStaff', body);
            toast.success(isNew ? t('accounts.created') : t('accounts.saved'));
            f.setEditing(null);
            setCreds(null);
            if (r.temp_password) showCreds(r.staff, r.temp_password);
            list.reload();
        } catch (err) {
            f.setErrors(err.fields || {});
            toast.error(err.message);
        } finally {
            f.setSaving(false);
        }
    }

    const rows = list.result ? list.result.data : null;
    return (
        <Page
            title={t('accounts.staffTitle')}
            subtitle={t('accounts.staffSub')}
            actions={f.editing === null && <Button icon="fa-solid fa-plus" onClick={() => { setCreds(null); f.open(null); }}>{t('accounts.newStaff')}</Button>}
        >
            {creds && <Credentials creds={creds} onClose={() => setCreds(null)} />}

            {f.editing !== null && (
                <Card title={isNew ? t('accounts.newStaff') : t('accounts.editStaff', { name: staffLabel(f.editing) })}>
                    <form onSubmit={save} noValidate>
                        <div className="dc-grid dc-grid-3">
                            <Field label={t('accounts.fullName')} required name="full_name" value={f.form.full_name} onChange={f.set('full_name')} error={f.errors.full_name} autoFocus />
                            <Field label={t('accounts.email')} name="email" type="email" value={f.form.email} onChange={f.set('email')} error={f.errors.email} />
                            <Field label={t('accounts.phone')} name="phone" type="tel" value={f.form.phone} onChange={f.set('phone')} />
                            {isNew ? (
                                <Field label={t('accounts.loginName')} required name="admin_name" value={f.form.admin_name} onChange={f.set('admin_name')}
                                    error={f.errors.admin_name} hint={t('accounts.loginHint')} autoComplete="off" />
                            ) : (
                                <Field label={t('accounts.loginFixed')} name="admin_name" value={f.editing.admin_name} readOnly disabled />
                            )}
                            <Field label={t('accounts.role')} name="role" as="select" value={f.form.role} onChange={f.set('role')} disabled={isMe}
                                error={f.errors.role} hint={isMe ? t('accounts.roleSelfHint') : t('accounts.roleHint')} className="dc-span-2"
                                options={[{ value: 'full', label: t('accounts.roleFull') }, { value: 'ops', label: t('accounts.roleOps') }]} />
                        </div>
                        {isNew && <p className="dc-small dc-muted"><i className="fa-solid fa-key" style={{ marginRight: 6 }} />{t('accounts.tempNote')}</p>}
                        <div className="dc-actions end" style={{ marginTop: 12 }}>
                            <Button variant="ghost" onClick={() => f.setEditing(null)}>{t('common.cancel')}</Button>
                            <Button type="submit" busy={f.saving} icon="fa-solid fa-check">{isNew ? t('accounts.create') : t('accounts.save')}</Button>
                        </div>
                    </form>
                </Card>
            )}

            <Card tight>
                <Toolbar search={list.search} setSearch={list.setSearch} status={list.status} setStatus={list.setStatus} placeholder={t('accounts.searchStaff')} />
                <div style={{ marginTop: 12 }}>
                    {list.error && <div className="dc-alert dc-tone-red" style={{ margin: 16 }}>{list.error}</div>}
                    {!rows && !list.error && <Spinner />}
                    {rows && rows.length === 0 && (
                        <EmptyState icon="fa-solid fa-user-tie" title={list.filtered ? t('accounts.noMatch') : t('accounts.noStaff')}>
                            {list.filtered ? t('accounts.noMatchHint') : null}
                        </EmptyState>
                    )}
                    {rows && rows.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="dc-table">
                                <thead>
                                    <tr>
                                        <th>{t('accounts.colName')}</th>
                                        <th>{t('accounts.colRole')}</th>
                                        <th>{t('accounts.colContact')}</th>
                                        <th>{t('accounts.colLastSignIn')}</th>
                                        <th>{t('accounts.colStatus')}</th>
                                        <th aria-label={t('accounts.moreActions')} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const mine = Number(r.admin_id) === Number(me);
                                        return (
                                            <tr key={r.admin_id} className="clickable" onClick={() => { setCreds(null); f.open(r, pickStaff); }} style={r.active ? undefined : { opacity: 0.65 }}>
                                                <td className="dc-td-head" data-label={t('accounts.colName')}>
                                                    <div className="dc-strong">{staffLabel(r)} {mine && <Badge tone="blue" plain>{t('accounts.you')}</Badge>}</div>
                                                    <div className="dc-small dc-muted dc-mono">{r.admin_name}</div>
                                                </td>
                                                <td data-label={t('accounts.colRole')}>
                                                    {r.role === 'ops' ? <Badge tone="gray">{t('accounts.roleOps')}</Badge> : <Badge tone="teal">{t('accounts.roleFull')}</Badge>}
                                                </td>
                                                <td data-label={t('accounts.colContact')}>
                                                    <div>{r.email || <span className="dc-muted">—</span>}</div>
                                                    {r.phone && <div className="dc-small dc-muted">{r.phone}</div>}
                                                </td>
                                                <td data-label={t('accounts.colLastSignIn')}><LastSignIn row={r} /></td>
                                                <td data-label={t('accounts.colStatus')}><StatusBadge row={r} /></td>
                                                <td data-label="" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    <RowActions row={r} canToggle={!mine} onEdit={(row) => { setCreds(null); f.open(row, pickStaff); }} onReset={actions.reset} onToggle={actions.toggle} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Card>
        </Page>
    );
}
