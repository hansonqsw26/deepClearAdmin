/**
 * New customs shipment, short form. Only what opens the file is asked for:
 * how it ships, the importer, the B/L (or CCN) and the container numbers.
 * Documents are optional here: drop them all at once and each gets a type.
 * Routing details sit behind "More details"; everything else (shipper, goods,
 * value, POA, transaction number) is collected on the shipment page when the
 * work needs it. The filing itself is done in Candata.
 * Admins pick the client and may also enter the transaction number.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { docName } from '../../i18n';
import { Badge, Button, Card, DropZone, Field, Page, useToast } from '../../ui/components';
import { customsApi, importersApi, IS_ADMIN } from './customs.api';
import { PoaBadge, canManageAccounts, poaNeedsAction } from './Importers';
import { COUNTRIES, TRANSPORT_ICONS, TRANSPORT_LABELS, checkContainer, countryName, useCustomsOptions } from './customsMeta';

const ISO_MODES = ['marine', 'rail'];
const CORE_DOCS = ['commercial invoice', 'packing list', 'bill of lading'];

const INITIAL = {
    transport_mode: 'marine', bill_of_lading: '', cargo_control_number: '', carrier_name: '', vessel_name: '',
    voyage_number: '', port_of_entry: '', origin_country: '', consignee_name: '', consignee_address: '', importer_bn: '',
    goods_description: '',
};

/** Document type from a file name; unknown files take the first core document still missing. */
const GUESS = [
    [/invoice|\binv\b|\bci\b|发票/i, 'commercial invoice'],
    [/packing|\bpl\b|装箱/i, 'packing list'],
    [/arrival|\ban\b|到货/i, 'arrival notice'],
    [/lading|\bb ?l\b|\bmbl\b|\bhbl\b|waybill|\bawb\b|提单/i, 'bill of lading'],
    [/origin|\bcoo\b|\bco\b|原产地/i, 'certificate of origin'],
    [/permit|cfia|licen[cs]e|许可/i, 'permit'],
];
export function guessDocType(name, taken = []) {
    const plain = String(name).replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.()[\]/]+/g, ' ');
    const hit = GUESS.find(([re]) => re.test(plain));
    if (hit) return hit[1];
    return CORE_DOCS.find((k) => !taken.includes(k)) || 'other';
}

/**
 * Container numbers pasted from a B/L or arrival notice: one per line, or with
 * spaces / commas between, "MSCU 123456-6" style included. Returns unique numbers
 * and the bits that are not container numbers.
 */
export function parseContainers(text) {
    const upper = String(text || '').toUpperCase();
    const re = /[A-Z]{4}\s?\d{6}\s?-?\s?\d/g;
    const numbers = [];
    for (const m of upper.match(re) || []) {
        const n = m.replace(/[\s-]/g, '');
        if (!numbers.includes(n)) numbers.push(n);
    }
    const bad = upper.replace(re, ' ').split(/[\s,;/]+/).filter(Boolean);
    return { numbers, bad };
}

export default function CreateCustomsTicket() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const toast = useToast();
    const options = useCustomsOptions();
    const [clients, setClients] = useState([]);
    const [clientId, setClientId] = useState('');
    const [shipment, setShipment] = useState(INITIAL);
    const [containerText, setContainerText] = useState('');
    const [unit, setUnit] = useState(''); // air / truck: ULD or trailer number
    const [eta, setEta] = useState('');
    const [destination, setDestination] = useState('');
    const [txn, setTxn] = useState(''); // admin: one customs entry for every container
    const [note, setNote] = useState('');
    const [files, setFiles] = useState([]); // [{ file, type }]
    const [more, setMore] = useState(false);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState('');
    const [importers, setImporters] = useState(null); // null = not loaded
    const [importerId, setImporterId] = useState('');

    const mode = shipment.transport_mode;
    const iso = ISO_MODES.includes(mode);
    const parsed = parseContainers(containerText);

    useEffect(() => {
        if (!IS_ADMIN) return;
        customsApi.clients().then((r) => setClients(r.data || [])).catch((e) => toast.error(e.message));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // The importers on file for this client; the default one is picked and filled in.
    const fillFrom = (imp) => setShipment((s) => ({
        ...s,
        consignee_name: imp ? imp.legal_name : '',
        consignee_address: imp ? imp.address || '' : '',
        importer_bn: imp ? imp.importer_bn : '',
    }));
    useEffect(() => {
        setImporters(null);
        setImporterId('');
        if (IS_ADMIN && !clientId) return;
        importersApi.list(IS_ADMIN ? Number(clientId) : undefined).then((r) => {
            const list = r.data || [];
            setImporters(list);
            const first = list.find((i) => i.is_default) || list[0];
            if (first) { setImporterId(String(first.importer_id)); fillFrom(first); } else if (IS_ADMIN) fillFrom(null);
        }).catch(() => setImporters([]));
    }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const importer = (importers || []).find((i) => String(i.importer_id) === importerId) || null;
    const pickImporter = (e) => {
        const id = e.target.value;
        setImporterId(id);
        setErrors((x) => ({ ...x, importer_id: undefined, importer_bn: undefined, consignee_name: undefined }));
        fillFrom((importers || []).find((i) => String(i.importer_id) === id) || null);
    };

    // Clients with no importer profile yet: start from the company details saved on their account.
    useEffect(() => {
        const acc = !IS_ADMIN && options && options.account;
        if (!acc || !importers || importers.length) return;
        setShipment((s) => ({
            ...s,
            consignee_name: s.consignee_name || acc.company_name || '',
            consignee_address: s.consignee_address || acc.address || '',
            importer_bn: s.importer_bn || acc.importer_bn || '',
        }));
    }, [options, importers]);

    const set = (field) => (e) => {
        const value = e.target.value;
        setShipment((s) => ({ ...s, [field]: value }));
        // The B/L and CCN are either-or, so typing one clears the error on the other.
        setErrors((x) => ({ ...x, [field]: undefined, ...(field === 'cargo_control_number' ? { bill_of_lading: undefined } : {}) }));
    };

    const addFiles = (list) => setFiles((current) => {
        const next = [...current];
        for (const file of list) next.push({ file, type: guessDocType(file.name, next.map((f) => f.type)) });
        return next;
    });
    const docTypes = options ? options.document_types.filter((d) => d.requirement !== 'broker') : [];
    const missingCore = CORE_DOCS.filter((k) => !files.some((f) => f.type === k));

    function validate() {
        const e = {};
        if (IS_ADMIN && !clientId) e.client_id = t('create.err.client');
        if (!shipment.bill_of_lading.trim() && !shipment.cargo_control_number.trim()) e.bill_of_lading = mode === 'air' ? t('create.err.awbOrCcn') : t('create.err.blOrCcn');
        if (shipment.importer_bn && !/^\d{9}RM\d{4}$/i.test(shipment.importer_bn.replace(/\s/g, ''))) e.importer_bn = t('create.err.bn');
        if (shipment.cargo_control_number && !/^[A-Z0-9]{4}[A-Z0-9-]{1,21}$/i.test(shipment.cargo_control_number.trim())) e.cargo_control_number = t('create.err.ccn');
        if (iso) {
            if (parsed.bad.length) e.containers = t('create.err.notContainers', { list: parsed.bad.slice(0, 3).join(', ') });
            else if (!parsed.numbers.length) e.containers = t('create.err.containers');
            else {
                const wrong = parsed.numbers.find((n) => checkContainer(n).error);
                if (wrong) e.containers = `${wrong}: ${checkContainer(wrong).error}`;
            }
        }
        if (IS_ADMIN && txn && !/^\d{14}$/.test(txn.replace(/\s/g, ''))) e.transaction_number = t('create.err.txn');
        if (e.transaction_number) setMore(true);
        setErrors(e);
        return e;
    }

    async function submit(ev) {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) {
            toast.error(t('create.fixFields'));
            setTimeout(() => {
                const first = document.querySelector('.dc-field.has-error');
                if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            return;
        }
        setSaving(true);
        try {
            setProgress(t('create.creating'));
            const numbers = iso ? parsed.numbers : [unit.trim()];
            const body = {
                note: note || undefined,
                shipment: { ...shipment, importer_id: importers && importers.length ? (importerId ? Number(importerId) : null) : undefined },
                containers: numbers.map((n) => ({
                    container_number: n,
                    eta: eta ? eta.replace('T', ' ') : undefined,
                    destination: destination || undefined,
                    ...(IS_ADMIN && txn ? { transaction_number: txn } : {}),
                })),
            };
            if (IS_ADMIN) body.client_id = Number(clientId);
            const created = await customsApi.create(body);

            let failed = 0;
            for (let i = 0; i < files.length; i += 1) {
                setProgress(t('create.uploading', { n: i + 1, total: files.length }));
                try {
                    await customsApi.upload(created.cb_id, files[i].type, files[i].file);
                } catch (err) {
                    failed += 1;
                }
            }
            if (failed) toast.error(t('create.uploadFailed', { count: failed }));
            toast.success(t('create.submitted', { ref: created.reference_number }));
            navigate(`/customs-ticket-details?main_id=${created.main_id}`, { replace: true });
        } catch (err) {
            const fieldErrors = { ...(err.fields || {}) };
            // Container errors come back per container (containers.0.container_number): show them on the box.
            const bad = Object.keys(fieldErrors).find((k) => k.startsWith('containers.'));
            if (bad) fieldErrors.containers = fieldErrors[bad];
            setErrors(fieldErrors);
            toast.error(err.message);
        } finally {
            setSaving(false);
            setProgress('');
        }
    }

    const err = (k) => errors[k];
    const modes = (options && options.transport_modes) || ['marine', 'air', 'rail', 'highway'];
    const blLabel = mode === 'air' ? t('field.awb') : t('field.bl');

    return (
        <Page
            title={IS_ADMIN ? t('create.titleAdmin') : t('create.titleClient')}
            subtitle={t('create.subtitleQuick')}
            back={{ label: t('create.back'), onClick: () => navigate('/customs-tickets-list') }}
        >
            <form onSubmit={submit} noValidate>
                <div className="dc-layout-main">
                    <div>
                        <Card title={t('create.basics')} sub={t('create.basicsSub')}>
                            {IS_ADMIN && (
                                <div style={{ marginBottom: 16 }}>
                                    <Field label={t('field.client')} required name="client_id" as="select" value={clientId} error={err('client_id')}
                                        onChange={(e) => { setClientId(e.target.value); setErrors((x) => ({ ...x, client_id: undefined })); }}
                                        options={[{ value: '', label: t('field.chooseClient') }, ...clients.map((c) => ({ value: c.client_id, label: c.company_name ? `${c.company_name} (${c.client_name})` : c.client_name }))]} />
                                </div>
                            )}

                            <div className="dc-field" style={{ marginBottom: 16 }}>
                                <label>{t('field.howShipped')}</label>
                                <div className="dc-chips" style={{ padding: 0 }}>
                                    {modes.map((m) => (
                                        <button key={m} type="button" className={`dc-chip ${mode === m ? 'active' : ''}`}
                                            onClick={() => { setShipment((s) => ({ ...s, transport_mode: m })); setErrors((x) => ({ ...x, containers: undefined })); }}>
                                            <i className={TRANSPORT_ICONS[m]} /> {TRANSPORT_LABELS[m]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {importers && importers.length > 0 ? (
                                <div style={{ marginBottom: 16 }}>
                                    <Field label={t('create.importer')} required name="importer_id" as="select" value={importerId} onChange={pickImporter} error={err('importer_id')}
                                        options={[...importers.map((i) => ({ value: String(i.importer_id), label: `${i.legal_name} · ${i.importer_bn}` })), { value: '', label: t('create.importerOther') }]} />
                                    {importer && (
                                        <div className="dc-importer-pick">
                                            <div>
                                                <div className="dc-strong">{importer.legal_name}</div>
                                                <div className="dc-small dc-mono">{importer.importer_bn}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}><PoaBadge importer={importer} /></div>
                                        </div>
                                    )}
                                    {importer && poaNeedsAction(importer.poa_state) && (
                                        <div className="dc-alert dc-tone-amber" style={{ marginTop: 8 }}>
                                            <i className="fa-solid fa-file-signature" />{' '}
                                            {IS_ADMIN ? t(`create.poaStaff.${importer.poa_state}`) : t(`create.poaLater.${importer.poa_state}`)}{' '}
                                            {!IS_ADMIN && <Link className="dc-strong" style={{ textDecoration: 'underline' }} to="/importers">{t('create.poaOpenImporters')}</Link>}
                                            {canManageAccounts() && <Link className="dc-strong" style={{ textDecoration: 'underline' }} to={`/client-accounts?client=${clientId}`}>{t('create.poaOpenClient')}</Link>}
                                        </div>
                                    )}
                                </div>
                            ) : null}
                            {importers && (!importers.length || !importer) && (
                                <div className="dc-grid dc-grid-2" style={{ marginBottom: 16 }}>
                                    <Field label={t('create.importerName')} name="consignee_name" value={shipment.consignee_name} onChange={set('consignee_name')} error={err('consignee_name')} />
                                    <Field label={t('field.importerBn')} name="importer_bn" upper value={shipment.importer_bn} onChange={set('importer_bn')}
                                        error={err('importer_bn')} placeholder="123456789RM0001" hint={t('create.bnLater')} />
                                </div>
                            )}

                            <div className="dc-grid dc-grid-2">
                                <Field label={blLabel} name="bill_of_lading" upper value={shipment.bill_of_lading} onChange={set('bill_of_lading')}
                                    error={err('bill_of_lading')} placeholder={t('field.blPlaceholder')} hint={t('create.blHint')} />
                                <Field label={t('field.ccn')} name="cargo_control_number" upper value={shipment.cargo_control_number}
                                    onChange={set('cargo_control_number')} error={err('cargo_control_number')} hint={t('create.ccnLater')} />
                                {iso ? (
                                    <Field label={t('create.containerNumbers')} required name="containers" className="dc-span-2" error={err('containers')}
                                        hint={t('create.containerNumbersHint')}>
                                        <textarea id="containers" name="containers" className="dc-input dc-input-upper dc-mono" rows={2} value={containerText}
                                            placeholder="MSCU1234566  TGHU7654321"
                                            onChange={(e) => { setContainerText(e.target.value); setErrors((x) => ({ ...x, containers: undefined })); }} />
                                    </Field>
                                ) : (
                                    <Field label={mode === 'air' ? t('field.uld') : t('create.trailer')} name="unit" upper value={unit}
                                        onChange={(e) => setUnit(e.target.value)} hint={t('create.unitOptional')} />
                                )}
                            </div>
                            {iso && parsed.numbers.length > 0 && (
                                <div className="dc-chips" style={{ padding: '8px 0 0' }} data-testid="container-chips">
                                    {parsed.numbers.map((n) => {
                                        const check = checkContainer(n);
                                        return (
                                            <Badge key={n} tone={check.error ? 'red' : check.warning ? 'amber' : 'teal'} title={check.error || check.warning}>
                                                <span className="dc-mono">{n}</span>
                                            </Badge>
                                        );
                                    })}
                                    <span className="dc-small dc-muted" style={{ alignSelf: 'center' }}>{t('create.containersFound', { count: parsed.numbers.length })}</span>
                                </div>
                            )}
                        </Card>

                        <Card title={t('create.moreDetails')} sub={t('create.moreDetailsSub')}
                            actions={<Button variant="secondary" size="sm" icon={more ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'} onClick={() => setMore((m) => !m)}>
                                {more ? t('create.hideMore') : t('create.showMore')}
                            </Button>}>
                            {more ? (
                                <div className="dc-grid dc-grid-2">
                                    <Field label={t('field.carrier')} name="carrier_name" value={shipment.carrier_name} onChange={set('carrier_name')} placeholder={t('field.carrierPlaceholder')} />
                                    <Field label={mode === 'air' ? t('field.flight') : t('field.vessel')} name="vessel_name" value={shipment.vessel_name} onChange={set('vessel_name')} />
                                    <Field label={t('field.voyage')} name="voyage_number" value={shipment.voyage_number} onChange={set('voyage_number')} />
                                    <Field label={t('field.poe')} name="port_of_entry" value={shipment.port_of_entry} onChange={set('port_of_entry')} placeholder={t('field.poePlaceholder')} />
                                    <Field label={t('field.eta')} name="eta" type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} />
                                    <Field label={t('field.destination')} name="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t('field.destinationPlaceholder')} />
                                    <Field label={t('field.origin')} name="origin_country" as="select" value={shipment.origin_country} onChange={set('origin_country')}
                                        options={[{ value: '', label: t('common.notSure') }, ...COUNTRIES.map(([c]) => ({ value: c, label: `${countryName(c)} (${c})` }))]} />
                                    {IS_ADMIN && (
                                        <Field label={t('field.transactionNumber')} name="transaction_number" value={txn} inputMode="numeric"
                                            onChange={(e) => setTxn(e.target.value)} error={err('transaction_number')} hint={t('field.transactionHintAll')} />
                                    )}
                                    <Field label={t('field.goods')} name="goods_description" as="textarea" rows={2} className="dc-span-2"
                                        value={shipment.goods_description} onChange={set('goods_description')} placeholder={t('field.goodsPlaceholder')} />
                                </div>
                            ) : (
                                <div className="dc-small dc-muted">{t('create.moreDetailsHint')}</div>
                            )}
                        </Card>
                    </div>

                    <div>
                        <Card title={t('create.documents')} sub={t('create.docsQuickSub')}>
                            {files.map((f, i) => (
                                <div key={`${f.file.name}${i}`} className="dc-doc-file" style={{ marginBottom: 8, alignItems: 'center', gap: 8 }}>
                                    <i className="fa-regular fa-file-lines dc-muted" />
                                    <span className="dc-truncate" style={{ color: 'var(--dc-ink)', flex: '1 1 auto' }}>{f.file.name}</span>
                                    <select className="dc-input" aria-label={t('create.docType')} style={{ width: 'auto', maxWidth: 170, padding: '4px 8px', height: 'auto' }}
                                        value={f.type} onChange={(e) => setFiles((x) => x.map((y, j) => (j === i ? { ...y, type: e.target.value } : y)))}>
                                        {docTypes.map((d) => <option key={d.key} value={d.key}>{docName(d.key)}</option>)}
                                    </select>
                                    <button type="button" className="dc-link" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>{t('common.removeLink')}</button>
                                </div>
                            ))}
                            <DropZone label={files.length ? t('create.dropMore') : t('create.dropAll')} onFiles={addFiles} />
                            <div className="dc-chips" style={{ padding: '10px 0 0' }}>
                                {CORE_DOCS.map((k) => (
                                    <Badge key={k} tone={missingCore.includes(k) ? 'gray' : 'green'} plain>
                                        <i className={missingCore.includes(k) ? 'fa-regular fa-circle' : 'fa-solid fa-check'} /> {docName(k)}
                                    </Badge>
                                ))}
                            </div>
                        </Card>

                        <Card title={t('create.notes')}>
                            <Field name="note" as="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('create.notesPlaceholder')} />
                        </Card>

                        <Card>
                            {!IS_ADMIN && (
                                <ol className="dc-small" style={{ margin: '0 0 14px', paddingLeft: 18, lineHeight: 1.6 }}>
                                    <li>{t('create.next1')}</li>
                                    <li>{t('create.next2')}</li>
                                    <li>{t('create.next3')}</li>
                                </ol>
                            )}
                            <Button type="submit" block busy={saving} icon="fa-solid fa-paper-plane">{saving ? progress : IS_ADMIN ? t('create.submitAdmin') : t('create.submit')}</Button>
                            <div className="dc-small dc-muted" style={{ marginTop: 10, textAlign: 'center' }}>
                                {IS_ADMIN ? t('create.adminLater') : t('create.editUntil')}
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </Page>
    );
}
