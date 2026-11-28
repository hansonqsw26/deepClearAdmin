/**
 * Staff only: AI document reading and the missing-document check.
 *
 * ReadPanel     what the AI read from one document, next to what the file has now.
 *               The broker ticks values and applies them; nothing is saved before that.
 * CheckCard     what is missing or does not match, and a draft request to the client
 *               (English or Chinese) that the broker edits and sends.
 *
 * The AI runs on the API server only (see the API README), so this works the same
 * for staff and clients in China.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { docName, isZh } from '../../i18n';
import { Badge, Button, Card, Field, display, timeAgo, useToast } from '../../ui/components';
import { call, customsApi } from './customs.api';

/** Document types worth reading, and the file types the AI can open. */
export const READABLE_TYPES = ['commercial invoice', 'packing list', 'bill of lading', 'arrival notice', 'certificate of origin', 'other'];
const READABLE_FILE = /\.(pdf|png|jpe?g)$/i;
export const canRead = (docKey, file) => READABLE_TYPES.includes(docKey) && READABLE_FILE.test(file.file_name || file.file_link || '');

export const aiApi = {
    read: (mainId, fileId, force = false) => call('/readCbDocument', { main_id: mainId, file_id: fileId, force }),
    check: (mainId, readMissing) => call('/checkCbDocuments', { main_id: mainId, read_missing: readMissing }),
};

/** Same label keys as the shipment card (field.*). */
const FIELD_LABEL = {
    transport_mode: 'transport',
    bill_of_lading: 'blOrAwb',
    house_bill: 'houseBill',
    cargo_control_number: 'ccnShort',
    carrier_name: 'carrier',
    vessel_name: 'vesselOrFlight',
    voyage_number: 'voyage',
    port_of_loading: 'pol',
    port_of_entry: 'poeShort',
    origin_country: 'origin',
    shipper_name: 'shipper',
    shipper_address: 'shipperAddress',
    consignee_name: 'consigneeShort',
    consignee_address: 'consigneeAddress',
    goods_description: 'goodsShort',
    package_count: 'packages',
    gross_weight_kg: 'grossWeight',
    invoice_value: 'invoiceValue',
    invoice_currency: 'currency',
    incoterm: 'incotermShort',
};

const STATUS_TONE = { new: 'blue', same: 'gray', different: 'amber' };
const CONF_TONE = { high: 'green', medium: 'amber', low: 'red' };
const SEVERITY_STYLE = {
    missing: { tone: 'red', icon: 'fa-solid fa-circle-exclamation' },
    problem: { tone: 'amber', icon: 'fa-solid fa-triangle-exclamation' },
    check: { tone: 'blue', icon: 'fa-solid fa-magnifying-glass' },
};

const row = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--dc-line, #eee)' };

/* ------------------------------------------------------------- read panel */

/**
 * `result` is the readCbDocument answer. Pre-ticked: values that are new on the file
 * and that the AI is sure of. Values that differ from the file are never pre-ticked.
 */
export function ReadPanel({ result, ticket, onApplied, onClose, onReread, busy }) {
    const { t } = useTranslation();
    const toast = useToast();
    const fields = result.comparison.fields;
    const newContainers = result.iso ? result.comparison.containers.filter((c) => !c.on_file) : [];
    const initial = useMemo(() => Object.fromEntries([
        ...fields.map((f) => [f.field, f.suggest && f.status === 'new' && f.confidence === 'high']),
        ...newContainers.map((c) => [`c:${c.container_number}`, !c.check_digit_problem]),
    ]), [result]); // eslint-disable-line react-hooks/exhaustive-deps
    const [picked, setPicked] = useState(initial);
    const [saving, setSaving] = useState(false);
    useEffect(() => setPicked(initial), [initial]);

    const count = Object.values(picked).filter(Boolean).length;
    const toggle = (key) => setPicked((p) => ({ ...p, [key]: !p[key] }));
    const label = (field) => t(`field.${FIELD_LABEL[field] || field}`, { defaultValue: field });

    const apply = async () => {
        setSaving(true);
        try {
            const shipment = {};
            fields.forEach((f) => { if (picked[f.field]) shipment[f.field] = f.found; });
            if (Object.keys(shipment).length) await customsApi.update(ticket.main_id, { shipment });
            const added = [];
            for (const c of newContainers) {
                if (!picked[`c:${c.container_number}`]) continue;
                // eslint-disable-next-line no-await-in-loop
                await customsApi.addContainer(ticket.main_id, { container_number: c.container_number, size_type: c.size_type || undefined, seal_number: c.seal_number || undefined });
                added.push(c.container_number);
            }
            const list = [...Object.keys(shipment).map(label), ...added].join(', ');
            await customsApi.comment(ticket.main_id, t('ai.appliedNote', { name: result.file.file_name, list }), true).catch(() => {});
            toast.success(t('ai.applied', { count }));
            onApplied();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const read = result.read;
    return (
        <Card id="dc-ai-read" title={t('ai.panelTitle', { name: result.file.file_name || docName(result.file.file_type) })}
            sub={<>{t('ai.panelSub')} {result.cached && <span className="dc-muted">· {t('ai.cachedAt', { when: timeAgo(result.read_at) })}</span>}</>}
            actions={<Button size="sm" variant="secondary" onClick={onClose}>{t('ai.close')}</Button>}>
            <div data-testid="ai-read-panel">
                {!result.type_matches && (
                    <div className="dc-alert dc-tone-amber" style={{ marginBottom: 10 }}>
                        <i className="fa-solid fa-triangle-exclamation" />{' '}
                        {t('ai.looksLike', { uploaded: docName(result.file.file_type).toLowerCase(), found: docName(read.document_type).toLowerCase() })}
                    </div>
                )}
                {fields.length === 0 && newContainers.length === 0 && <p className="dc-muted">{t('ai.nothingFound')}</p>}
                {fields.map((f) => (
                    <label key={f.field} style={{ ...row, cursor: f.status === 'same' ? 'default' : 'pointer' }}>
                        <input type="checkbox" checked={Boolean(picked[f.field])} disabled={f.status === 'same' || Boolean(f.problem)}
                            onChange={() => toggle(f.field)} style={{ marginTop: 4 }} aria-label={label(f.field)} />
                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                            <div className="dc-small dc-muted dc-strong">
                                {label(f.field)}{' '}
                                <Badge tone={STATUS_TONE[f.status]} plain>{t(`ai.status.${f.status}`)}</Badge>{' '}
                                {f.status !== 'same' && <Badge tone={CONF_TONE[f.confidence]} plain>{t(`ai.confidence.${f.confidence}`)}</Badge>}
                            </div>
                            <div style={{ fontSize: 14, overflowWrap: 'anywhere' }}><b>{display(f.found)}</b></div>
                            {f.status === 'different' && <div className="dc-small dc-muted" style={{ overflowWrap: 'anywhere' }}>{t('ai.colNow')}: {display(f.current)}</div>}
                            {f.problem && <div className="dc-small" style={{ color: 'var(--dc-red)' }}>{t('ai.problem', { problem: f.problem })}</div>}
                        </div>
                    </label>
                ))}
                {result.iso && result.comparison.containers.length > 0 && (
                    <>
                        <div className="dc-small dc-muted dc-strong" style={{ margin: '14px 0 4px' }}>{t('ai.containers')}</div>
                        {result.comparison.containers.map((c) => (
                            <label key={c.container_number} style={{ ...row, cursor: c.on_file ? 'default' : 'pointer' }}>
                                <input type="checkbox" checked={c.on_file || Boolean(picked[`c:${c.container_number}`])} disabled={c.on_file}
                                    onChange={() => toggle(`c:${c.container_number}`)} style={{ marginTop: 4 }} aria-label={c.container_number} />
                                <div style={{ flex: '1 1 auto' }}>
                                    <b>{c.container_number}</b> {c.size_type && <span className="dc-muted">{c.size_type}</span>}
                                    {c.seal_number && <span className="dc-muted"> · {c.seal_number}</span>}{' '}
                                    {c.on_file ? <Badge tone="gray" plain>{t('ai.onFile')}</Badge> : <Badge tone="blue" plain>{t('ai.addContainer')}</Badge>}
                                    {c.check_digit_problem && <div className="dc-small" style={{ color: 'var(--dc-amber)' }}>{t('ai.checkDigit')}</div>}
                                </div>
                            </label>
                        ))}
                    </>
                )}
                {read.issues.length > 0 && (
                    <div className="dc-alert dc-tone-blue" style={{ marginTop: 12 }}>
                        <div className="dc-strong" style={{ marginBottom: 4 }}><i className="fa-solid fa-magnifying-glass" /> {t('ai.issues')}</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {read.issues.map((s) => {
                                const text = typeof s === 'string' ? s : (isZh() ? s.zh || s.en : s.en);
                                return <li key={text}>{text}</li>;
                            })}
                        </ul>
                    </div>
                )}
                <div className="dc-actions" style={{ marginTop: 14 }}>
                    <Button icon="fa-solid fa-check" busy={saving} disabled={!count} onClick={apply}>{t('ai.apply', { count })}</Button>
                    <Button variant="secondary" icon="fa-solid fa-rotate" busy={busy} onClick={onReread}>{t('ai.readAgain')}</Button>
                </div>
            </div>
        </Card>
    );
}

/* ------------------------------------------------------------- check card */

const ASK_STAGES = ['submitted', 'in_review'];

export function CheckCard({ ticket, aiEnabled, refreshKey, onSent }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [lang, setLang] = useState('en');
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    const run = async () => {
        setBusy(true);
        try {
            const r = await aiApi.check(ticket.main_id, aiEnabled);
            setResult(r);
            const l = r.preferred_lang || (isZh() ? 'zh' : 'en');
            setLang(l);
            setText(r.draft ? r.draft[l] : '');
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };
    // A finished check goes stale when documents or fields change.
    useEffect(() => { setResult(null); }, [refreshKey]);

    const switchLang = (l) => {
        setLang(l);
        if (result && result.draft) setText(result.draft[l]);
    };

    const send = async () => {
        setSending(true);
        try {
            if (ASK_STAGES.includes(ticket.stage)) await customsApi.setStage(ticket.main_id, 'awaiting_client', text);
            else await customsApi.comment(ticket.main_id, text, false);
            toast.success(t('ai.sent'));
            onSent();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSending(false);
        }
    };

    const issues = result ? result.issues : [];
    return (
        <Card id="dc-ai-check" title={t('ai.checkTitle')} sub={t('ai.checkSub')}>
            <div data-testid="ai-check-card">
                {!result && (
                    <>
                        <Button block icon="fa-solid fa-list-check" busy={busy} onClick={run}>{t('ai.checkRun')}</Button>
                        {busy && aiEnabled && <div className="dc-small dc-muted" style={{ marginTop: 6 }}>{t('ai.checkRunning')}</div>}
                        {!aiEnabled && <div className="dc-small dc-muted" style={{ marginTop: 6 }}>{t('ai.off')}</div>}
                    </>
                )}
                {result && (
                    <>
                        {issues.length === 0 && <div className="dc-alert dc-tone-green"><i className="fa-solid fa-circle-check" /> {t('ai.allGood')}</div>}
                        {issues.map((i) => {
                            const s = SEVERITY_STYLE[i.severity] || SEVERITY_STYLE.check;
                            return (
                                <div key={i.key} style={row}>
                                    <i className={s.icon} style={{ color: `var(--dc-${s.tone})`, marginTop: 3 }} />
                                    <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: 14 }}>
                                        {isZh() ? i.zh : i.en}
                                        <div className="dc-small dc-muted">
                                            {t(`ai.severity.${i.severity}`)} · {t(`ai.who.${i.who}`)}{i.ai ? ' · AI' : ''}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {result.unread.length > 0 && (
                            <div className="dc-small dc-muted" style={{ marginTop: 8 }}>
                                {t('ai.unread', { list: result.unread.map((f) => f.file_name || docName(f.file_type)).join(', ') })}
                                {!result.ai_enabled && <> {t('ai.off')}</>}
                            </div>
                        )}
                        {result.read_errors.length > 0 && (
                            <div className="dc-small" style={{ marginTop: 6, color: 'var(--dc-red)' }}>
                                {t('ai.readErrors', { list: result.read_errors.map((e) => `${e.file_name}: ${e.error}`).join('; ') })}
                            </div>
                        )}
                        {result.draft && (
                            <div style={{ marginTop: 14 }}>
                                <div className="dc-strong" style={{ marginBottom: 2 }}>{t('ai.draftTitle')}</div>
                                <div className="dc-small dc-muted" style={{ marginBottom: 8 }}>
                                    {t('ai.draftSub', { lang: result.preferred_lang === 'zh' ? t('ai.langZh') : t('ai.langEn') })}
                                </div>
                                <div className="dc-chips" style={{ padding: 0, marginBottom: 8 }}>
                                    {['en', 'zh'].map((l) => (
                                        <button key={l} type="button" className={`dc-chip ${lang === l ? 'active' : ''}`} onClick={() => switchLang(l)} aria-pressed={lang === l}>
                                            {l === 'zh' ? t('ai.langZh') : t('ai.langEn')}
                                        </button>
                                    ))}
                                </div>
                                <Field name="ai_draft" as="textarea" rows={9} value={text} onChange={(e) => setText(e.target.value)} label="" />
                                <Button block icon="fa-regular fa-paper-plane" busy={sending} disabled={!text.trim()} onClick={send} style={{ marginTop: 8 }}>
                                    {ASK_STAGES.includes(ticket.stage) ? t('ai.sendAsk') : t('ai.sendMessage')}
                                </Button>
                            </div>
                        )}
                        <Button variant="secondary" size="sm" icon="fa-solid fa-rotate" busy={busy} onClick={run} style={{ marginTop: 10 }}>{t('ai.checkAgain')}</Button>
                    </>
                )}
            </div>
        </Card>
    );
}
