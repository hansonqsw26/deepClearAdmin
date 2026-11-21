/** Customs shipments list: search, stage chips, paging. Rows open the shipment page. */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, EmptyState, Page, Pager, Spinner, formatDate, useDebounced } from '../../ui/components';
import { customsApi, IS_ADMIN } from './customs.api';
import { StageBadge, CbsaBadge } from './CustomsBits';
import { TRANSPORT_ICONS, useCustomsOptions } from './customsMeta';

const FILTERS = [
    { key: '', label: 'All' },
    { key: 'open', label: 'Open', stage: 'submitted,in_review,awaiting_client,release_requested,cbsa_exam,released,accounted' },
    { key: 'attention', label: 'Needs attention', attention: true },
    { key: 'review', label: 'Broker review', stage: 'submitted,in_review' },
    { key: 'cbsa', label: 'With CBSA', stage: 'release_requested,cbsa_exam' },
    { key: 'released', label: 'Released', stage: 'released,accounted' },
    { key: 'closed', label: 'Closed', stage: 'invoiced,completed,cancelled' },
];

export default function CustomsTicketsList() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const options = useCustomsOptions();
    const [search, setSearch] = useState(params.get('q') || '');
    const [filter, setFilter] = useState(params.get('f') || '');
    const [page, setPage] = useState(Number(params.get('page')) || 1);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const q = useDebounced(search, 300);
    const limit = 15;

    useEffect(() => {
        const f = FILTERS.find((x) => x.key === filter) || FILTERS[0];
        const next = {};
        if (q) next.q = q;
        if (filter) next.f = filter;
        if (page > 1) next.page = String(page);
        setParams(next, { replace: true });

        let alive = true;
        setResult(null);
        setError('');
        customsApi
            .list({ page, limit, search: q || undefined, stage: f.stage, attention: f.attention })
            .then((r) => alive && setResult(r))
            .catch((e) => alive && setError(e.message));
        return () => {
            alive = false;
        };
    }, [q, filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

    const open = (row) => navigate(`/customs-ticket-details?main_id=${row.main_id}`);
    const stageLabel = (row) => row.stage_label || (options && (options.stages.find((s) => s.key === row.stage) || {}).label);

    return (
        <Page
            title={IS_ADMIN ? 'Customs files' : 'My customs shipments'}
            subtitle={IS_ADMIN ? 'Every customs brokerage file, newest first.' : 'Track each shipment from documents to CBSA release.'}
            actions={<Button icon="fa-solid fa-plus" onClick={() => navigate('/create-customs-ticket')}>{IS_ADMIN ? 'New customs file' : 'New shipment'}</Button>}
        >
            <Card tight>
                <div className="dc-toolbar">
                    <div className="dc-search">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            className="dc-input"
                            placeholder={`Search reference, container, B/L, cargo control no.${IS_ADMIN ? ', client' : ''}`}
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>
                <div className="dc-chips">
                    {FILTERS.map((f) => (
                        <button key={f.key} type="button" className={`dc-chip ${filter === f.key ? 'active' : ''}`} onClick={() => { setFilter(f.key); setPage(1); }}>
                            {f.attention && <i className="fa-solid fa-triangle-exclamation" />}
                            {f.label}
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: 12 }}>
                    {error && <div className="dc-alert dc-tone-red" style={{ margin: 16 }}>{error}</div>}
                    {!result && !error && <Spinner />}
                    {result && result.data.length === 0 && (
                        <EmptyState
                            icon="fa-solid fa-ship"
                            title={q || filter ? 'No shipments match' : 'No customs shipments yet'}
                            action={!q && !filter && <Button icon="fa-solid fa-plus" onClick={() => navigate('/create-customs-ticket')}>{IS_ADMIN ? 'New customs file' : 'Submit your first shipment'}</Button>}
                        >
                            {q || filter ? 'Try another search or filter.' : 'Submit your shipment details and documents and we will take it from there.'}
                        </EmptyState>
                    )}
                    {result && result.data.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="dc-table">
                                <thead>
                                    <tr>
                                        <th>Reference</th>
                                        {IS_ADMIN && <th>Client</th>}
                                        <th>Containers</th>
                                        <th>B/L · Cargo control</th>
                                        <th>ETA</th>
                                        <th>Stage</th>
                                        <th>CBSA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.data.map((row) => (
                                        <tr key={row.main_id} className="clickable" onClick={() => open(row)}>
                                            <td className="dc-td-head" data-label="Reference">
                                                <div className="dc-strong">
                                                    {row.transport_mode && <i className={`${TRANSPORT_ICONS[row.transport_mode]} dc-muted`} style={{ marginRight: 8 }} />}
                                                    {row.reference_number}
                                                </div>
                                                <div className="dc-small dc-muted">{formatDate(row.create_date)}</div>
                                            </td>
                                            {IS_ADMIN && <td data-label="Client">{row.client_name}</td>}
                                            <td data-label="Containers">
                                                <span className="dc-mono">{row.container_number || '—'}</span>
                                                {row.container_count > 1 && <span className="dc-small dc-muted"> +{row.container_count - 1} more</span>}
                                            </td>
                                            <td data-label="B/L · CCN">
                                                <div className="dc-mono">{row.bill_of_lading || '—'}</div>
                                                {row.cargo_control_number && <div className="dc-small dc-muted dc-mono">{row.cargo_control_number}</div>}
                                            </td>
                                            <td data-label="ETA">{formatDate(row.eta)}</td>
                                            <td data-label="Stage"><StageBadge stage={row.stage} label={stageLabel(row)} /></td>
                                            <td data-label="CBSA"><CbsaBadge code={row.cb_status} label={row.cb_status_label} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {result && result.total > 0 && <Pager page={page} limit={limit} total={result.total} onPage={setPage} />}
            </Card>
        </Page>
    );
}
