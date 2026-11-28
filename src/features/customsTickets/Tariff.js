/**
 * Staff only: tariff classification (HS codes) of a customs file.
 *
 * The AI reads the commercial invoice and proposes, for each line, up to three
 * Canadian classification numbers with the duty rate, a confidence and its
 * reasoning (English and Chinese). The broker picks or types the code and rate
 * for every line and confirms; nothing is saved before that. Lines the AI is
 * unsure of start with no code picked, so they cannot be confirmed by accident.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { docName, isZh, locale } from '../../i18n';
import { Badge, Button, Card, Field, Spinner, display, timeAgo, useToast } from '../../ui/components';
import { call } from './customs.api';

export const tariffApi = {
    get: (mainId) => call('/getCbTariff', { main_id: mainId }),
    suggest: (mainId, fileId, force = false) => call('/suggestCbTariff', { main_id: mainId, file_id: fileId, force }),
    save: (mainId, lines, suggestionId) => call('/saveCbTariff', { main_id: mainId, lines, suggestion_id: suggestionId || undefined }),
};

/** Official schedule, for checking rates (the AI's can be out of date). */
const TARIFF_URL = 'https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/menu-eng.html';
const CONF_TONE = { high: 'green', medium: 'amber', low: 'red' };
const SOURCE_TONE = { ai: 'teal', ai_changed: 'amber', manual: 'gray' };
const FALLBACK_TREATMENTS = ['MFN', 'GPT', 'LDCT', 'UST', 'MXT', 'CPTPT', 'CEUT', 'UKT', 'KRT', 'OTHER'];

const lang = (b) => (b ? (isZh() ? b.zh || b.en : b.en) : '');
const money = (v, currency) => (v === null || v === undefined || v === '' ? '—'
    : `${Number(v).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`);
const rateText = (r, free = 'Free') => (r === null || r === undefined || r === '' ? '—' : Number(r) === 0 ? free : `${Number(r)}%`);
const box = { border: '1px solid var(--dc-line)', borderRadius: 10, padding: 12, marginBottom: 12 };

/** One editable line from an AI line: the top pick is filled in unless the AI is unsure. */
function fromSuggestion(l, currency) {
    const top = l.suggestions.find((s) => !s.problem);
    const usable = top && top.confidence !== 'low';
    return {
        description: l.description,
        quantity: l.quantity ?? '',
        unit: l.unit || '',
        value: l.value ?? '',
        currency: currency || '',
        origin_country: l.origin_country || '',
        choice: usable ? l.suggestions.indexOf(top) : null, // index into suggestions, 'own', or null
        hs_code: usable ? top.hs_code : '',
        treatment: usable ? top.treatment : 'MFN',
        duty_rate: usable && top.duty_rate !== null ? String(top.duty_rate) : '',
        ai_hs_code: top ? top.hs_code : '',
        ai_confidence: top ? top.confidence : '',
        ai: l, // suggestions, other measures and questions, for display
    };
}

const fromConfirmed = (l) => ({
    description: l.description,
    quantity: l.quantity ?? '',
    unit: l.unit || '',
    value: l.value ?? '',
    currency: l.currency || '',
    origin_country: l.origin_country || '',
    choice: 'own',
    hs_code: l.hs_code,
    treatment: l.treatment || 'MFN',
    duty_rate: l.duty_rate === null || l.duty_rate === undefined ? '' : String(l.duty_rate),
    ai_hs_code: l.ai_hs_code || '',
    ai_confidence: l.ai_confidence || '',
    ai: null,
});

const blankLine = (currency) => ({ ...fromConfirmed({ description: '', hs_code: '', currency }), choice: 'own' });

export function TariffCard({ ticket, shipment, refreshKey, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [fileId, setFileId] = useState('');
    const [draft, setDraft] = useState(null); // { lines, suggestion_id } while editing
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        tariffApi.get(ticket.main_id).then((d) => {
            setData(d);
            setError('');
            setFileId((f) => f || (d.invoices[0] ? String(d.invoices[0].file_id) : ''));
        }).catch((e) => setError(e.message));
    }, [ticket.main_id]);
    useEffect(() => { load(); }, [load, refreshKey]);

    const currencyOf = (s) => (s && s.result && s.result.currency) || shipment.invoice_currency || '';

    const review = (suggestion) => {
        const cur = currencyOf(suggestion);
        setErrors({});
        setDraft({ lines: suggestion.result.lines.map((l) => fromSuggestion(l, cur)), suggestion_id: suggestion.suggestion_id, suggestion });
    };

    const suggest = async (force = false) => {
        setBusy(true);
        try {
            const r = await tariffApi.suggest(ticket.main_id, Number(fileId) || undefined, force);
            setData((d) => ({ ...d, suggestion: r.suggestion }));
            if (!r.suggestion.result.lines.length) toast.error(t('tariff.noLines'));
            else review(r.suggestion);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    const editConfirmed = () => {
        setErrors({});
        setDraft({ lines: data.lines.map(fromConfirmed), suggestion_id: data.lines[0] && data.lines[0].suggestion_id, suggestion: null });
    };

    const setLine = (i, patch) => setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
    const choose = (i, idx) => {
        const l = draft.lines[i];
        if (idx === 'own') return setLine(i, { choice: 'own' });
        const s = l.ai.suggestions[idx];
        return setLine(i, { choice: idx, hs_code: s.hs_code, treatment: s.treatment, duty_rate: s.duty_rate === null ? '' : String(s.duty_rate) });
    };
    const removeLine = (i) => setDraft((d) => ({ ...d, lines: d.lines.filter((_, j) => j !== i) }));
    const addLine = () => setDraft((d) => ({ ...d, lines: [...d.lines, blankLine(currencyOf(d.suggestion))] }));

    const undecided = draft ? draft.lines.filter((l) => !String(l.hs_code).trim()).length : 0;

    const save = async () => {
        setSaving(true);
        try {
            const lines = draft.lines.map((l) => ({
                description: l.description, quantity: l.quantity, unit: l.unit, value: l.value, currency: l.currency,
                origin_country: l.origin_country, hs_code: l.hs_code, treatment: l.treatment, duty_rate: l.duty_rate,
                ai_hs_code: l.ai_hs_code, ai_confidence: l.ai_confidence,
            }));
            const r = await tariffApi.save(ticket.main_id, lines, draft.suggestion_id);
            setData((d) => ({ ...d, lines: r.lines, estimate: r.estimate }));
            setDraft(null);
            toast.success(t('tariff.saved', { count: r.lines.length }));
            onSaved();
        } catch (e) {
            setErrors(e.fields || {});
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (error) return <Card id="dc-tariff" title={t('tariff.title')}><div className="dc-alert dc-tone-red">{error}</div></Card>;
    if (!data) return <Card id="dc-tariff" title={t('tariff.title')}><Spinner /></Card>;

    const { lines, suggestion, invoices } = data;
    const treatments = data.treatments || FALLBACK_TREATMENTS;
    const currency = (lines[0] && lines[0].currency) || shipment.invoice_currency || '';

    return (
        <Card id="dc-tariff" title={t('tariff.title')} sub={t('tariff.sub')}
            actions={!draft && lines.length > 0 && <Button size="sm" variant="secondary" icon="fa-solid fa-pen" onClick={editConfirmed}>{t('tariff.edit')}</Button>}>
            <div data-testid="tariff-card">
                {/* ---------------------------------------------- confirmed lines */}
                {!draft && lines.length > 0 && (
                    <>
                        <div style={{ overflowX: 'auto', margin: '0 -16px' }}>
                            <table className="dc-table">
                                <thead>
                                    <tr>
                                        <th>{t('tariff.colGoods')}</th>
                                        <th>{t('tariff.colCode')}</th>
                                        <th>{t('tariff.colRate')}</th>
                                        <th>{t('tariff.colValue')}</th>
                                        <th>{t('tariff.colDuty')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((l) => (
                                        <tr key={l.line_id || l.line_no}>
                                            <td className="dc-td-head" data-label={t('tariff.colGoods')}>
                                                <div style={{ overflowWrap: 'anywhere' }}>{l.line_no}. {l.description}</div>
                                                {l.quantity !== null && <div className="dc-small dc-muted">{l.quantity} {l.unit || ''}</div>}
                                            </td>
                                            <td data-label={t('tariff.colCode')}>
                                                <span className="dc-mono dc-strong">{l.hs_code}</span>{' '}
                                                <Badge tone={SOURCE_TONE[l.source] || 'gray'} plain>{t(`tariff.source.${l.source}`, { defaultValue: l.source })}</Badge>
                                                {l.source === 'ai_changed' && l.ai_hs_code && <div className="dc-small dc-muted">{t('tariff.aiHad', { code: l.ai_hs_code })}</div>}
                                            </td>
                                            <td data-label={t('tariff.colRate')}>{rateText(l.duty_rate, t('tariff.free'))} <span className="dc-small dc-muted">{l.treatment}</span></td>
                                            <td data-label={t('tariff.colValue')}>{money(l.value, l.currency)}</td>
                                            <td data-label={t('tariff.colDuty')}>{l.value !== null && l.duty_rate !== null ? money((l.value * l.duty_rate) / 100, l.currency) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="dc-small" style={{ marginTop: 10 }}>
                            <b>{t('tariff.estimate', { duty: money(data.estimate.duty, currency), value: money(data.estimate.value, currency) })}</b>
                            {!data.estimate.complete && <span className="dc-muted"> {t('tariff.estimatePartial')}</span>}
                            <div className="dc-muted">{t('tariff.estimateNote')}</div>
                        </div>
                        <div className="dc-small dc-muted" style={{ marginTop: 6 }}>
                            {t('tariff.confirmedBy', { who: display(lines[0].confirmed_by), when: timeAgo(lines[0].confirmed_at) })}
                        </div>
                    </>
                )}

                {/* ---------------------------------------------- start */}
                {!draft && (
                    <div style={{ marginTop: lines.length ? 14 : 0 }}>
                        {invoices.length === 0 && lines.length === 0 && <p className="dc-muted" style={{ marginTop: 0 }}>{t('tariff.noInvoice')}</p>}
                        {!data.ai_enabled && <p className="dc-small dc-muted" style={{ marginTop: 0 }}>{t('tariff.off')}</p>}
                        {data.ai_enabled && invoices.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                {invoices.length > 1 && (
                                    <Field label={t('tariff.fromFile')} name="tariff_file" as="select" value={fileId} onChange={(e) => setFileId(e.target.value)}
                                        options={invoices.map((f) => ({ value: String(f.file_id), label: `${f.file_name || docName(f.file_type)} (${docName(f.file_type)})` }))}
                                        className="" style={{ flex: '1 1 220px' }} />
                                )}
                                <Button icon="fa-solid fa-wand-magic-sparkles" busy={busy} variant={lines.length ? 'secondary' : 'primary'}
                                    onClick={() => suggest(Boolean(suggestion && String(suggestion.file_id) === String(fileId)))} data-testid="tariff-suggest">
                                    {lines.length || (suggestion && String(suggestion.file_id) === String(fileId)) ? t('tariff.suggestAgain') : t('tariff.suggest')}
                                </Button>
                                {suggestion && !lines.length && String(suggestion.file_id) === String(fileId) && (
                                    <Button variant="secondary" icon="fa-solid fa-list-check" onClick={() => review(suggestion)}>{t('tariff.review')}</Button>
                                )}
                            </div>
                        )}
                        {busy && <div className="dc-small dc-muted" style={{ marginTop: 6 }}>{t('tariff.running')}</div>}
                        {lines.length === 0 && (
                            <Button variant="ghost" size="sm" icon="fa-solid fa-keyboard" style={{ marginTop: 8 }}
                                onClick={() => { setErrors({}); setDraft({ lines: [blankLine(shipment.invoice_currency || '')], suggestion_id: null, suggestion: null }); }}>
                                {t('tariff.byHand')}
                            </Button>
                        )}
                    </div>
                )}

                {/* ---------------------------------------------- editor */}
                {draft && (
                    <div data-testid="tariff-editor">
                        <div className="dc-alert dc-tone-blue" style={{ marginBottom: 12 }}>
                            <i className="fa-solid fa-circle-info" />{' '}
                            {draft.suggestion ? t('tariff.reviewHelp') : t('tariff.editHelp')}{' '}
                            <a href={TARIFF_URL} target="_blank" rel="noreferrer">{t('tariff.checkSchedule')}</a>
                        </div>
                        {draft.suggestion && (
                            <div className="dc-small dc-muted" style={{ marginBottom: 10 }}>
                                {t('tariff.suggestedFrom', { name: (draft.suggestion.file && draft.suggestion.file.file_name) || docName('commercial invoice'), when: timeAgo(draft.suggestion.created_at) })}
                            </div>
                        )}
                        {draft.suggestion && draft.suggestion.result.notes.length > 0 && (
                            <div className="dc-alert dc-tone-amber" style={{ marginBottom: 12 }}>
                                <ul style={{ margin: 0, paddingLeft: 18 }}>{draft.suggestion.result.notes.map((n) => <li key={n.en}>{lang(n)}</li>)}</ul>
                            </div>
                        )}

                        {draft.lines.map((l, i) => {
                            const err = (f) => errors[`${i}.${f}`];
                            return (
                                // eslint-disable-next-line react/no-array-index-key
                                <div key={i} style={box} data-testid={`tariff-line-${i}`}>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                        <span className="dc-strong" style={{ marginTop: 8 }}>{i + 1}.</span>
                                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                            <Field label={t('tariff.description')} name={`tl_desc_${i}`} value={l.description} error={err('description')}
                                                onChange={(e) => setLine(i, { description: e.target.value })} />
                                        </div>
                                        <button type="button" className="dc-link" style={{ color: 'var(--dc-red)', marginTop: 30 }} onClick={() => removeLine(i)} aria-label={t('tariff.removeLine')}>
                                            <i className="fa-regular fa-trash-can" />
                                        </button>
                                    </div>
                                    <div className="dc-small dc-muted" style={{ margin: '-4px 0 8px 20px' }}>
                                        {[l.quantity !== '' && `${l.quantity} ${l.unit}`.trim(), l.value !== '' && money(l.value, l.currency), l.origin_country && t('tariff.origin', { c: l.origin_country })].filter(Boolean).join(' · ')}
                                    </div>

                                    {l.ai && l.ai.suggestions.length > 0 && (
                                        <div role="radiogroup" aria-label={t('tariff.suggestions')} style={{ marginLeft: 20 }}>
                                            {l.ai.suggestions.map((s, idx) => (
                                                <label key={s.hs_code + idx} style={{ display: 'flex', gap: 8, padding: '8px 0', borderTop: '1px solid var(--dc-line)', cursor: s.problem ? 'default' : 'pointer', margin: 0 }}>
                                                    <input type="radio" name={`tl_choice_${i}`} checked={l.choice === idx} disabled={Boolean(s.problem)} onChange={() => choose(i, idx)} style={{ marginTop: 4 }} />
                                                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                                        <div>
                                                            <span className="dc-mono dc-strong">{s.hs_code}</span>{' '}
                                                            <Badge tone={CONF_TONE[s.confidence]} plain>{t(`tariff.confidence.${s.confidence}`)}</Badge>{' '}
                                                            <span className="dc-small">{rateText(s.duty_rate, t('tariff.free')) !== '—' ? rateText(s.duty_rate, t('tariff.free')) : s.duty_rate_text} {s.treatment}</span>
                                                            {idx === 0 && <span className="dc-small dc-muted"> · {t('tariff.best')}</span>}
                                                        </div>
                                                        {s.tariff_description && <div className="dc-small" style={{ overflowWrap: 'anywhere' }}>{s.tariff_description}</div>}
                                                        {lang(s.reasoning) && <div className="dc-small dc-muted" style={{ overflowWrap: 'anywhere' }}>{lang(s.reasoning)}</div>}
                                                        {s.problem && <div className="dc-small" style={{ color: 'var(--dc-red)' }}>{s.problem}</div>}
                                                    </div>
                                                </label>
                                            ))}
                                            <label style={{ display: 'flex', gap: 8, padding: '8px 0', borderTop: '1px solid var(--dc-line)', cursor: 'pointer', margin: 0 }}>
                                                <input type="radio" name={`tl_choice_${i}`} checked={l.choice === 'own'} onChange={() => choose(i, 'own')} />
                                                <span className="dc-small">{t('tariff.ownCode')}</span>
                                            </label>
                                        </div>
                                    )}
                                    {l.ai && l.choice === null && (
                                        <div className="dc-small" style={{ color: 'var(--dc-amber)', margin: '4px 0 0 20px' }}>
                                            <i className="fa-solid fa-triangle-exclamation" /> {t('tariff.unsure')}
                                        </div>
                                    )}

                                    {(l.choice !== null || !l.ai) && (
                                        <div className="dc-grid dc-grid-3" style={{ marginTop: 10, marginLeft: 20 }}>
                                            <Field label={t('tariff.code')} name={`tl_code_${i}`} value={l.hs_code} error={err('hs_code')} placeholder="9401.71.00.00" inputMode="numeric"
                                                onChange={(e) => setLine(i, { hs_code: e.target.value, choice: 'own' })} />
                                            <Field label={t('tariff.treatment')} name={`tl_treat_${i}`} as="select" value={l.treatment} error={err('treatment')}
                                                options={treatments.map((x) => ({ value: x, label: x }))} onChange={(e) => setLine(i, { treatment: e.target.value })} />
                                            <Field label={t('tariff.rate')} name={`tl_rate_${i}`} value={l.duty_rate} error={err('duty_rate')} inputMode="decimal" hint={t('tariff.rateHint')}
                                                onChange={(e) => setLine(i, { duty_rate: e.target.value })} />
                                        </div>
                                    )}
                                    {!l.ai && (
                                        <div className="dc-grid dc-grid-3" style={{ marginLeft: 20 }}>
                                            <Field label={t('tariff.quantity')} name={`tl_qty_${i}`} value={l.quantity} error={err('quantity')} inputMode="decimal" onChange={(e) => setLine(i, { quantity: e.target.value })} />
                                            <Field label={t('tariff.value')} name={`tl_val_${i}`} value={l.value} error={err('value')} inputMode="decimal" onChange={(e) => setLine(i, { value: e.target.value })} />
                                            <Field label={t('tariff.currency')} name={`tl_cur_${i}`} value={l.currency} error={err('currency')} upper maxLength={3} onChange={(e) => setLine(i, { currency: e.target.value.toUpperCase() })} />
                                        </div>
                                    )}

                                    {l.ai && l.ai.other_measures.length > 0 && (
                                        <div className="dc-alert dc-tone-amber dc-small" style={{ margin: '10px 0 0 20px' }}>
                                            <div className="dc-strong">{t('tariff.otherMeasures')}</div>
                                            <ul style={{ margin: 0, paddingLeft: 18 }}>{l.ai.other_measures.map((m) => <li key={m.en}>{lang(m)}</li>)}</ul>
                                        </div>
                                    )}
                                    {l.ai && l.ai.questions.length > 0 && (
                                        <div className="dc-alert dc-tone-blue dc-small" style={{ margin: '10px 0 0 20px' }}>
                                            <div className="dc-strong">{t('tariff.askClient')}</div>
                                            <ul style={{ margin: 0, paddingLeft: 18 }}>{l.ai.questions.map((q) => <li key={q.en}>{lang(q)}</li>)}</ul>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <Button variant="ghost" size="sm" icon="fa-solid fa-plus" onClick={addLine}>{t('tariff.addLine')}</Button>
                        {undecided > 0 && <div className="dc-small" style={{ color: 'var(--dc-amber)', marginTop: 8 }}>{t('tariff.undecided', { count: undecided })}</div>}
                        <div className="dc-actions end" style={{ marginTop: 12 }}>
                            <Button variant="ghost" onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
                            <Button icon="fa-solid fa-check" busy={saving} disabled={undecided > 0 || draft.lines.length === 0} onClick={save} data-testid="tariff-confirm">
                                {t('tariff.confirm', { count: draft.lines.length })}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

/** One line for the customs-entry panel: how far the classification is. */
export function TariffStatus({ count, onOpen }) {
    const { t } = useTranslation();
    if (count === null || count === undefined) return null;
    return (
        <div className={`dc-small ${count ? '' : 'dc-alert dc-tone-amber'}`} style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} data-testid="tariff-status">
            <i className={count ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'} style={{ color: count ? 'var(--dc-green)' : undefined }} />
            <span>{count ? t('tariff.statusDone', { count }) : t('tariff.statusNone')}</span>
            <button type="button" className="dc-link" onClick={onOpen}>{t('tariff.statusOpen')}</button>
        </div>
    );
}
