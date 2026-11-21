/**
 * New customs shipment: shipment & routing, parties, goods, containers and
 * documents in one page. Documents upload right after the ticket is created.
 * Admins pick the client and may also enter broker fields (transaction number).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { docName } from '../../i18n';
import { Button, Card, DropZone, Field, Page, useToast } from '../../ui/components';
import { customsApi, IS_ADMIN } from './customs.api';
import { COUNTRIES, CURRENCIES, TRANSPORT_ICONS, TRANSPORT_LABELS, checkContainer, countryName, useCustomsOptions } from './customsMeta';

const EMPTY_CONTAINER = { container_number: '', size_type: '40HC', seal_number: '', transaction_number: '' };
const ISO_MODES = ['marine', 'rail'];

const INITIAL = {
    transport_mode: 'marine', bill_of_lading: '', house_bill: '', cargo_control_number: '', carrier_name: '', vessel_name: '',
    voyage_number: '', port_of_loading: '', port_of_entry: '', origin_country: '', shipper_name: '', shipper_address: '',
    consignee_name: '', consignee_address: '', importer_bn: '', goods_description: '', package_count: '', gross_weight_kg: '',
    invoice_value: '', invoice_currency: 'USD', incoterm: '',
};

export default function CreateCustomsTicket() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const toast = useToast();
    const options = useCustomsOptions();
    const [clients, setClients] = useState([]);
    const [clientId, setClientId] = useState('');
    const [shipment, setShipment] = useState(INITIAL);
    const [eta, setEta] = useState('');
    const [destination, setDestination] = useState('');
    const [note, setNote] = useState('');
    const [containers, setContainers] = useState([{ ...EMPTY_CONTAINER }]);
    const [files, setFiles] = useState({}); // file_type -> File[]
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState('');

    const iso = ISO_MODES.includes(shipment.transport_mode);

    useEffect(() => {
        if (!IS_ADMIN) return;
        customsApi.clients().then((r) => setClients(r.data || [])).catch((e) => toast.error(e.message));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const set = (field) => (e) => {
        const value = e.target.value;
        setShipment((s) => ({ ...s, [field]: value }));
        setErrors((x) => ({ ...x, [field]: undefined }));
    };
    const setContainer = (i, field, value) => {
        setContainers((list) => list.map((c, j) => (j === i ? { ...c, [field]: value } : c)));
        setErrors((x) => ({ ...x, [`containers.${i}.${field}`]: undefined }));
    };

    const docTypes = useMemo(() => (options ? options.document_types.filter((d) => d.requirement !== 'broker') : []), [options]);
    const missingRequired = docTypes.filter((d) => d.requirement === 'required' && !(files[d.key] || []).length);

    function validate() {
        const e = {};
        if (IS_ADMIN && !clientId) e.client_id = t('create.err.client');
        if (!shipment.bill_of_lading.trim()) e.bill_of_lading = shipment.transport_mode === 'air' ? t('create.err.awb') : t('create.err.bl');
        if (!shipment.origin_country) e.origin_country = t('create.err.origin');
        if (!shipment.shipper_name.trim()) e.shipper_name = t('create.err.shipper');
        if (!shipment.consignee_name.trim()) e.consignee_name = t('create.err.consignee');
        if (!shipment.goods_description.trim()) e.goods_description = t('create.err.goods');
        if (shipment.importer_bn && !/^\d{9}RM\d{4}$/i.test(shipment.importer_bn.replace(/\s/g, ''))) e.importer_bn = t('create.err.bn');
        if (shipment.cargo_control_number && !/^[A-Z0-9]{4}[A-Z0-9-]{1,21}$/i.test(shipment.cargo_control_number.trim())) e.cargo_control_number = t('create.err.ccn');
        const seen = new Set();
        containers.forEach((c, i) => {
            const n = c.container_number.toUpperCase().replace(/[\s-]/g, '');
            if (iso) {
                if (!n) e[`containers.${i}.container_number`] = t('create.err.container');
                else if (checkContainer(n).error) e[`containers.${i}.container_number`] = checkContainer(n).error;
            }
            if (n && seen.has(n)) e[`containers.${i}.container_number`] = t('create.err.twice');
            if (n) seen.add(n);
            if (c.transaction_number && !/^\d{14}$/.test(c.transaction_number.replace(/\s/g, ''))) e[`containers.${i}.transaction_number`] = t('create.err.txn');
        });
        setErrors(e);
        return e;
    }

    async function submit(ev) {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) {
            toast.error(t('create.fixFields'));
            const first = document.querySelector('.dc-field.has-error');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setSaving(true);
        try {
            setProgress(t('create.creating'));
            const body = {
                note: note || undefined,
                shipment,
                containers: containers.map((c) => ({
                    container_number: c.container_number,
                    size_type: iso ? c.size_type : undefined,
                    seal_number: c.seal_number,
                    eta: eta ? eta.replace('T', ' ') : undefined,
                    destination: destination || undefined,
                    ...(IS_ADMIN && c.transaction_number ? { transaction_number: c.transaction_number } : {}),
                })),
            };
            if (IS_ADMIN) body.client_id = Number(clientId);
            const created = await customsApi.create(body);

            const uploads = Object.entries(files).flatMap(([type, list]) => list.map((f) => [type, f]));
            let failed = 0;
            for (let i = 0; i < uploads.length; i += 1) {
                setProgress(t('create.uploading', { n: i + 1, total: uploads.length }));
                try {
                    await customsApi.upload(created.cb_id, uploads[i][0], uploads[i][1]);
                } catch (err) {
                    failed += 1;
                }
            }
            if (failed) toast.error(t('create.uploadFailed', { count: failed }));
            toast.success(t('create.submitted', { ref: created.reference_number }));
            navigate(`/customs-ticket-details?main_id=${created.main_id}`, { replace: true });
        } catch (err) {
            const fieldErrors = err.fields || {};
            const mapped = {};
            for (const [k, v] of Object.entries(fieldErrors)) mapped[k] = v;
            setErrors(mapped);
            toast.error(err.message);
        } finally {
            setSaving(false);
            setProgress('');
        }
    }

    const err = (k) => errors[k];
    const modes = (options && options.transport_modes) || ['marine', 'air', 'rail', 'highway'];

    return (
        <Page
            title={IS_ADMIN ? t('create.titleAdmin') : t('create.titleClient')}
            subtitle={t('create.subtitle')}
            back={{ label: t('create.back'), onClick: () => navigate('/customs-tickets-list') }}
        >
            <form onSubmit={submit} noValidate>
                <div className="dc-layout-main">
                    <div>
                        {IS_ADMIN && (
                            <Card title={t('create.clientCard')}>
                                <Field label={t('field.client')} required name="client_id" as="select" value={clientId} error={err('client_id')}
                                    onChange={(e) => { setClientId(e.target.value); setErrors((x) => ({ ...x, client_id: undefined })); }}
                                    options={[{ value: '', label: t('field.chooseClient') }, ...clients.map((c) => ({ value: c.client_id, label: c.client_name }))]} />
                            </Card>
                        )}

                        <Card title={t('create.routing')} sub={t('create.routingSub')}>
                            <div className="dc-field" style={{ marginBottom: 16 }}>
                                <label>{t('field.howShipped')}</label>
                                <div className="dc-chips" style={{ padding: 0 }}>
                                    {modes.map((m) => (
                                        <button key={m} type="button" className={`dc-chip ${shipment.transport_mode === m ? 'active' : ''}`}
                                            onClick={() => setShipment((s) => ({ ...s, transport_mode: m }))}>
                                            <i className={TRANSPORT_ICONS[m]} /> {TRANSPORT_LABELS[m]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="dc-grid dc-grid-2">
                                <Field label={shipment.transport_mode === 'air' ? t('field.awb') : t('field.bl')} required name="bill_of_lading" upper
                                    value={shipment.bill_of_lading} onChange={set('bill_of_lading')} error={err('bill_of_lading')} placeholder={t('field.blPlaceholder')} />
                                <Field label={t('field.houseBill')} name="house_bill" upper value={shipment.house_bill} onChange={set('house_bill')} hint={t('field.houseBillHint')} />
                                <Field label={t('field.ccn')} name="cargo_control_number" upper value={shipment.cargo_control_number}
                                    onChange={set('cargo_control_number')} error={err('cargo_control_number')} hint={t('field.ccnHint')} />
                                <Field label={t('field.carrier')} name="carrier_name" value={shipment.carrier_name} onChange={set('carrier_name')} placeholder={t('field.carrierPlaceholder')} />
                                <Field label={shipment.transport_mode === 'air' ? t('field.flight') : t('field.vessel')} name="vessel_name" value={shipment.vessel_name} onChange={set('vessel_name')} />
                                <Field label={t('field.voyage')} name="voyage_number" value={shipment.voyage_number} onChange={set('voyage_number')} />
                                <Field label={t('field.pol')} name="port_of_loading" value={shipment.port_of_loading} onChange={set('port_of_loading')} placeholder={t('field.polPlaceholder')} />
                                <Field label={t('field.poe')} name="port_of_entry" value={shipment.port_of_entry} onChange={set('port_of_entry')} placeholder={t('field.poePlaceholder')} />
                                <Field label={t('field.origin')} required name="origin_country" as="select" value={shipment.origin_country} onChange={set('origin_country')}
                                    error={err('origin_country')} options={[{ value: '', label: t('common.choose') }, ...COUNTRIES.map(([c]) => ({ value: c, label: `${countryName(c)} (${c})` }))]} />
                                <Field label={t('field.eta')} name="eta" type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} />
                                <Field label={t('field.destination')} name="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t('field.destinationPlaceholder')} className="dc-span-2" />
                            </div>
                        </Card>

                        <Card title={t('create.parties')}>
                            <div className="dc-grid dc-grid-2">
                                <Field label={t('field.shipper')} required name="shipper_name" value={shipment.shipper_name} onChange={set('shipper_name')} error={err('shipper_name')} />
                                <Field label={t('field.consignee')} required name="consignee_name" value={shipment.consignee_name} onChange={set('consignee_name')} error={err('consignee_name')} />
                                <Field label={t('field.shipperAddress')} name="shipper_address" as="textarea" rows={2} value={shipment.shipper_address} onChange={set('shipper_address')} />
                                <Field label={t('field.consigneeAddress')} name="consignee_address" as="textarea" rows={2} value={shipment.consignee_address} onChange={set('consignee_address')} />
                                <Field label={t('field.importerBn')} name="importer_bn" upper value={shipment.importer_bn} onChange={set('importer_bn')}
                                    error={err('importer_bn')} placeholder="123456789RM0001" hint={t('field.importerBnHint')} />
                            </div>
                        </Card>

                        <Card title={t('create.goods')}>
                            <div className="dc-grid dc-grid-3">
                                <Field label={t('field.goods')} required name="goods_description" as="textarea" rows={2} className="dc-span-all"
                                    value={shipment.goods_description} onChange={set('goods_description')} error={err('goods_description')} placeholder={t('field.goodsPlaceholder')} />
                                <Field label={t('field.packages')} name="package_count" type="number" min="0" value={shipment.package_count} onChange={set('package_count')} />
                                <Field label={t('field.grossWeight')} name="gross_weight_kg" type="number" min="0" step="0.01" value={shipment.gross_weight_kg} onChange={set('gross_weight_kg')} />
                                <Field label={t('field.incoterm')} name="incoterm" as="select" value={shipment.incoterm} onChange={set('incoterm')}
                                    options={[{ value: '', label: t('common.notSure') }, ...((options && options.incoterms) || []).map((i) => ({ value: i, label: i }))]} />
                                <Field label={t('field.invoiceValue')} name="invoice_value" type="number" min="0" step="0.01" value={shipment.invoice_value} onChange={set('invoice_value')} />
                                <Field label={t('field.currency')} name="invoice_currency" as="select" value={shipment.invoice_currency} onChange={set('invoice_currency')}
                                    options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                            </div>
                        </Card>

                        <Card title={iso ? t('create.containers') : t('create.units')} sub={iso ? t('create.containersSub') : t('create.unitsSub')}
                            actions={<Button variant="secondary" size="sm" icon="fa-solid fa-plus" onClick={() => setContainers((l) => [...l, { ...EMPTY_CONTAINER }])}>{iso ? t('create.addContainer') : t('create.addUnit')}</Button>}>
                            {containers.map((c, i) => {
                                const check = iso ? checkContainer(c.container_number) : {};
                                return (
                                    <div className="dc-row-card" key={i}>
                                        <div className="dc-row-card-head">
                                            <span>{iso ? t('create.containerN', { n: i + 1 }) : t('create.unitN', { n: i + 1 })}</span>
                                            {containers.length > 1 && (
                                                <Button variant="ghost" size="sm" icon="fa-regular fa-trash-can" onClick={() => setContainers((l) => l.filter((_, j) => j !== i))}>{t('common.remove')}</Button>
                                            )}
                                        </div>
                                        <div className={`dc-grid ${IS_ADMIN ? 'dc-grid-4' : 'dc-grid-3'}`}>
                                            <Field label={iso ? t('field.containerNumber') : t('field.uld')} required={iso} upper name={`container_${i}`}
                                                value={c.container_number} onChange={(e) => setContainer(i, 'container_number', e.target.value)}
                                                error={err(`containers.${i}.container_number`)} warning={check.warning} placeholder={iso ? 'MSCU1234566' : ''} />
                                            {iso && (
                                                <Field label={t('field.sizeType')} name={`size_${i}`} as="select" value={c.size_type} onChange={(e) => setContainer(i, 'size_type', e.target.value)}
                                                    options={((options && options.container_sizes) || ['20GP', '40GP', '40HC']).map((s) => ({ value: s, label: s }))} />
                                            )}
                                            <Field label={t('field.seal')} name={`seal_${i}`} value={c.seal_number} onChange={(e) => setContainer(i, 'seal_number', e.target.value)} />
                                            {IS_ADMIN && (
                                                <Field label={t('field.transactionNumber')} name={`txn_${i}`} value={c.transaction_number} inputMode="numeric"
                                                    onChange={(e) => setContainer(i, 'transaction_number', e.target.value)} error={err(`containers.${i}.transaction_number`)}
                                                    hint={t('field.transactionHint')} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </Card>
                    </div>

                    <div>
                        <Card title={t('create.documents')} sub={t('create.documentsSub')}>
                            {!options && <div className="dc-muted">{t('common.loading')}</div>}
                            {docTypes.map((d) => (
                                <div key={d.key} style={{ marginBottom: 16 }}>
                                    <div className="dc-actions" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span className="dc-strong" style={{ fontSize: 14 }}>
                                            {docName(d.key)}
                                            {d.requirement === 'required' && <span style={{ color: 'var(--dc-red)' }}> *</span>}
                                        </span>
                                        {d.requirement === 'recommended' && <span className="dc-small dc-muted">{t('common.recommended')}</span>}
                                    </div>
                                    {(files[d.key] || []).map((f, i) => (
                                        <div key={`${f.name}${i}`} className="dc-doc-file" style={{ marginBottom: 6 }}>
                                            <i className="fa-regular fa-file-lines dc-muted" />
                                            <span className="dc-truncate" style={{ color: 'var(--dc-ink)' }}>{f.name}</span>
                                            <button type="button" className="dc-link" onClick={() => setFiles((x) => ({ ...x, [d.key]: x[d.key].filter((_, j) => j !== i) }))}>{t('common.removeLink')}</button>
                                        </div>
                                    ))}
                                    {d.requirement === 'required' ? (
                                        <DropZone label={t('create.dropOne')} onFiles={(list) => setFiles((x) => ({ ...x, [d.key]: [...(x[d.key] || []), ...list] }))} />
                                    ) : (
                                        <DropZone compact label={t('common.attach')} onFiles={(list) => setFiles((x) => ({ ...x, [d.key]: [...(x[d.key] || []), ...list] }))} />
                                    )}
                                </div>
                            ))}
                        </Card>

                        <Card title={t('create.notes')}>
                            <Field name="note" as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('create.notesPlaceholder')} />
                        </Card>

                        <Card>
                            {missingRequired.length > 0 && (
                                <div className="dc-alert dc-tone-amber">
                                    <i className="fa-solid fa-circle-info" /> {t('create.missing', { list: missingRequired.map((d) => docName(d.key)).join(t('common.listSep')) })}
                                </div>
                            )}
                            <Button type="submit" block busy={saving} icon="fa-solid fa-paper-plane">{saving ? progress : t('create.submit')}</Button>
                            <div className="dc-small dc-muted" style={{ marginTop: 10, textAlign: 'center' }}>
                                {t('create.editUntil')}
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </Page>
    );
}
