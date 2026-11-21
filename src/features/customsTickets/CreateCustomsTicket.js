/**
 * New customs shipment: shipment & routing, parties, goods, containers and
 * documents in one page. Documents upload right after the ticket is created.
 * Admins pick the client and may also enter broker fields (transaction number).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DropZone, Field, Page, useToast } from '../../ui/components';
import { customsApi, IS_ADMIN } from './customs.api';
import { COUNTRIES, CURRENCIES, TRANSPORT_ICONS, TRANSPORT_LABELS, checkContainer, useCustomsOptions } from './customsMeta';

const EMPTY_CONTAINER = { container_number: '', size_type: '40HC', seal_number: '', transaction_number: '' };
const ISO_MODES = ['marine', 'rail'];

const INITIAL = {
    transport_mode: 'marine', bill_of_lading: '', house_bill: '', cargo_control_number: '', carrier_name: '', vessel_name: '',
    voyage_number: '', port_of_loading: '', port_of_entry: '', origin_country: '', shipper_name: '', shipper_address: '',
    consignee_name: '', consignee_address: '', importer_bn: '', goods_description: '', package_count: '', gross_weight_kg: '',
    invoice_value: '', invoice_currency: 'USD', incoterm: '',
};

export default function CreateCustomsTicket() {
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
        if (IS_ADMIN && !clientId) e.client_id = 'Choose the client.';
        if (!shipment.bill_of_lading.trim()) e.bill_of_lading = shipment.transport_mode === 'air' ? 'Air waybill number is required.' : 'Bill of lading is required.';
        if (!shipment.origin_country) e.origin_country = 'Choose the country of origin.';
        if (!shipment.shipper_name.trim()) e.shipper_name = 'Who is shipping the goods?';
        if (!shipment.consignee_name.trim()) e.consignee_name = 'Who receives the goods in Canada?';
        if (!shipment.goods_description.trim()) e.goods_description = 'Describe the goods in a few words.';
        if (shipment.importer_bn && !/^\d{9}RM\d{4}$/i.test(shipment.importer_bn.replace(/\s/g, ''))) e.importer_bn = 'Format 123456789RM0001.';
        if (shipment.cargo_control_number && !/^[A-Z0-9]{4}[A-Z0-9-]{1,21}$/i.test(shipment.cargo_control_number.trim())) e.cargo_control_number = 'Carrier code (4 characters) followed by the number.';
        const seen = new Set();
        containers.forEach((c, i) => {
            const n = c.container_number.toUpperCase().replace(/[\s-]/g, '');
            if (iso) {
                if (!n) e[`containers.${i}.container_number`] = 'Container number is required.';
                else if (checkContainer(n).error) e[`containers.${i}.container_number`] = checkContainer(n).error;
            }
            if (n && seen.has(n)) e[`containers.${i}.container_number`] = 'Listed twice.';
            if (n) seen.add(n);
            if (c.transaction_number && !/^\d{14}$/.test(c.transaction_number.replace(/\s/g, ''))) e[`containers.${i}.transaction_number`] = '14 digits.';
        });
        setErrors(e);
        return e;
    }

    async function submit(ev) {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) {
            toast.error('Please fix the highlighted fields.');
            const first = document.querySelector('.dc-field.has-error');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        setSaving(true);
        try {
            setProgress('Creating shipment…');
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
                setProgress(`Uploading documents ${i + 1} of ${uploads.length}…`);
                try {
                    await customsApi.upload(created.cb_id, uploads[i][0], uploads[i][1]);
                } catch (err) {
                    failed += 1;
                }
            }
            if (failed) toast.error(`${failed} document(s) did not upload. You can add them on the shipment page.`);
            toast.success(`Shipment ${created.reference_number} submitted.`);
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
            title={IS_ADMIN ? 'New customs file' : 'New shipment'}
            subtitle="Fill in what you know now. Anything missing can be added later from the shipment page."
            back={{ label: 'Back to shipments', onClick: () => navigate('/customs-tickets-list') }}
        >
            <form onSubmit={submit} noValidate>
                <div className="dc-layout-main">
                    <div>
                        {IS_ADMIN && (
                            <Card title="Client">
                                <Field label="Client" required name="client_id" as="select" value={clientId} error={err('client_id')}
                                    onChange={(e) => { setClientId(e.target.value); setErrors((x) => ({ ...x, client_id: undefined })); }}
                                    options={[{ value: '', label: 'Choose a client…' }, ...clients.map((c) => ({ value: c.client_id, label: c.client_name }))]} />
                            </Card>
                        )}

                        <Card title="Shipment and routing" sub="From the bill of lading or arrival notice.">
                            <div className="dc-field" style={{ marginBottom: 16 }}>
                                <label>How is it shipped?</label>
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
                                <Field label={shipment.transport_mode === 'air' ? 'Air waybill (AWB)' : 'Bill of lading (B/L)'} required name="bill_of_lading" upper
                                    value={shipment.bill_of_lading} onChange={set('bill_of_lading')} error={err('bill_of_lading')} placeholder="e.g. MEDU1234567" />
                                <Field label="House bill" name="house_bill" upper value={shipment.house_bill} onChange={set('house_bill')} hint="If a forwarder issued one." />
                                <Field label="Cargo control number (CCN)" name="cargo_control_number" upper value={shipment.cargo_control_number}
                                    onChange={set('cargo_control_number')} error={err('cargo_control_number')} hint="On the arrival notice. We can find it if you don't have it yet." />
                                <Field label="Carrier" name="carrier_name" value={shipment.carrier_name} onChange={set('carrier_name')} placeholder="e.g. MSC, Maersk, Air Canada Cargo" />
                                <Field label={shipment.transport_mode === 'air' ? 'Flight' : 'Vessel'} name="vessel_name" value={shipment.vessel_name} onChange={set('vessel_name')} />
                                <Field label="Voyage" name="voyage_number" value={shipment.voyage_number} onChange={set('voyage_number')} />
                                <Field label="Port of loading" name="port_of_loading" value={shipment.port_of_loading} onChange={set('port_of_loading')} placeholder="e.g. Shanghai" />
                                <Field label="Port of entry in Canada" name="port_of_entry" value={shipment.port_of_entry} onChange={set('port_of_entry')} placeholder="e.g. Vancouver, Montreal, Toronto" />
                                <Field label="Country of origin" required name="origin_country" as="select" value={shipment.origin_country} onChange={set('origin_country')}
                                    error={err('origin_country')} options={[{ value: '', label: 'Choose…' }, ...COUNTRIES.map(([c, n]) => ({ value: c, label: `${n} (${c})` }))]} />
                                <Field label="Estimated arrival (ETA)" name="eta" type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} />
                                <Field label="Final destination" name="destination" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Mississauga, ON" className="dc-span-2" />
                            </div>
                        </Card>

                        <Card title="Shipper and consignee">
                            <div className="dc-grid dc-grid-2">
                                <Field label="Shipper / exporter" required name="shipper_name" value={shipment.shipper_name} onChange={set('shipper_name')} error={err('shipper_name')} />
                                <Field label="Consignee / importer in Canada" required name="consignee_name" value={shipment.consignee_name} onChange={set('consignee_name')} error={err('consignee_name')} />
                                <Field label="Shipper address" name="shipper_address" as="textarea" rows={2} value={shipment.shipper_address} onChange={set('shipper_address')} />
                                <Field label="Consignee address" name="consignee_address" as="textarea" rows={2} value={shipment.consignee_address} onChange={set('consignee_address')} />
                                <Field label="Importer business number (BN/RM)" name="importer_bn" upper value={shipment.importer_bn} onChange={set('importer_bn')}
                                    error={err('importer_bn')} placeholder="123456789RM0001" hint="Your CRA import/export account." />
                            </div>
                        </Card>

                        <Card title="Goods">
                            <div className="dc-grid dc-grid-3">
                                <Field label="Description of goods" required name="goods_description" as="textarea" rows={2} className="dc-span-all"
                                    value={shipment.goods_description} onChange={set('goods_description')} error={err('goods_description')} placeholder="e.g. Stainless steel hand tools" />
                                <Field label="Packages" name="package_count" type="number" min="0" value={shipment.package_count} onChange={set('package_count')} />
                                <Field label="Gross weight (kg)" name="gross_weight_kg" type="number" min="0" step="0.01" value={shipment.gross_weight_kg} onChange={set('gross_weight_kg')} />
                                <Field label="Terms of sale (Incoterm)" name="incoterm" as="select" value={shipment.incoterm} onChange={set('incoterm')}
                                    options={[{ value: '', label: 'Not sure' }, ...((options && options.incoterms) || []).map((i) => ({ value: i, label: i }))]} />
                                <Field label="Invoice value" name="invoice_value" type="number" min="0" step="0.01" value={shipment.invoice_value} onChange={set('invoice_value')} />
                                <Field label="Currency" name="invoice_currency" as="select" value={shipment.invoice_currency} onChange={set('invoice_currency')}
                                    options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                            </div>
                        </Card>

                        <Card title={iso ? 'Containers' : 'Units'} sub={iso ? 'One line per container on the bill of lading.' : 'Optional: ULD or trailer numbers.'}
                            actions={<Button variant="secondary" size="sm" icon="fa-solid fa-plus" onClick={() => setContainers((l) => [...l, { ...EMPTY_CONTAINER }])}>Add {iso ? 'container' : 'unit'}</Button>}>
                            {containers.map((c, i) => {
                                const check = iso ? checkContainer(c.container_number) : {};
                                return (
                                    <div className="dc-row-card" key={i}>
                                        <div className="dc-row-card-head">
                                            <span>{iso ? 'Container' : 'Unit'} {i + 1}</span>
                                            {containers.length > 1 && (
                                                <Button variant="ghost" size="sm" icon="fa-regular fa-trash-can" onClick={() => setContainers((l) => l.filter((_, j) => j !== i))}>Remove</Button>
                                            )}
                                        </div>
                                        <div className={`dc-grid ${IS_ADMIN ? 'dc-grid-4' : 'dc-grid-3'}`}>
                                            <Field label={iso ? 'Container number' : 'ULD / trailer number'} required={iso} upper name={`container_${i}`}
                                                value={c.container_number} onChange={(e) => setContainer(i, 'container_number', e.target.value)}
                                                error={err(`containers.${i}.container_number`)} warning={check.warning} placeholder={iso ? 'MSCU1234566' : ''} />
                                            {iso && (
                                                <Field label="Size / type" name={`size_${i}`} as="select" value={c.size_type} onChange={(e) => setContainer(i, 'size_type', e.target.value)}
                                                    options={((options && options.container_sizes) || ['20GP', '40GP', '40HC']).map((s) => ({ value: s, label: s }))} />
                                            )}
                                            <Field label="Seal number" name={`seal_${i}`} value={c.seal_number} onChange={(e) => setContainer(i, 'seal_number', e.target.value)} />
                                            {IS_ADMIN && (
                                                <Field label="Transaction number" name={`txn_${i}`} value={c.transaction_number} inputMode="numeric"
                                                    onChange={(e) => setContainer(i, 'transaction_number', e.target.value)} error={err(`containers.${i}.transaction_number`)}
                                                    hint="14 digits. CBSA status is tracked from this." />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </Card>
                    </div>

                    <div>
                        <Card title="Documents" sub="Attach what you have. You can add more later.">
                            {!options && <div className="dc-muted">Loading…</div>}
                            {docTypes.map((d) => (
                                <div key={d.key} style={{ marginBottom: 16 }}>
                                    <div className="dc-actions" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span className="dc-strong" style={{ fontSize: 14 }}>
                                            {d.label}
                                            {d.requirement === 'required' && <span style={{ color: 'var(--dc-red)' }}> *</span>}
                                        </span>
                                        {d.requirement === 'recommended' && <span className="dc-small dc-muted">Recommended</span>}
                                    </div>
                                    {(files[d.key] || []).map((f, i) => (
                                        <div key={`${f.name}${i}`} className="dc-doc-file" style={{ marginBottom: 6 }}>
                                            <i className="fa-regular fa-file-lines dc-muted" />
                                            <span className="dc-truncate" style={{ color: 'var(--dc-ink)' }}>{f.name}</span>
                                            <button type="button" className="dc-link" onClick={() => setFiles((x) => ({ ...x, [d.key]: x[d.key].filter((_, j) => j !== i) }))}>remove</button>
                                        </div>
                                    ))}
                                    {d.requirement === 'required' ? (
                                        <DropZone label="Drop file or click" onFiles={(list) => setFiles((x) => ({ ...x, [d.key]: [...(x[d.key] || []), ...list] }))} />
                                    ) : (
                                        <DropZone compact label="Attach" onFiles={(list) => setFiles((x) => ({ ...x, [d.key]: [...(x[d.key] || []), ...list] }))} />
                                    )}
                                </div>
                            ))}
                        </Card>

                        <Card title="Notes for the broker">
                            <Field name="note" as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know: deadlines, permits, special handling…" />
                        </Card>

                        <Card>
                            {missingRequired.length > 0 && (
                                <div className="dc-alert dc-tone-amber">
                                    <i className="fa-solid fa-circle-info" /> Still missing: {missingRequired.map((d) => d.label.toLowerCase()).join(', ')}. You can submit now and upload them later.
                                </div>
                            )}
                            <Button type="submit" block busy={saving} icon="fa-solid fa-paper-plane">{saving ? progress : 'Submit shipment'}</Button>
                            <div className="dc-small dc-muted" style={{ marginTop: 10, textAlign: 'center' }}>
                                You can edit details until we request release from CBSA.
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </Page>
    );
}
