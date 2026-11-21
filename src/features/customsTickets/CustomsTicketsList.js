/** Customs shipments list: search, stage chips, paging. Rows open the shipment page. */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState, Page, Pager, Spinner, formatDate, useDebounced } from '../../ui/components';
import { customsApi, IS_ADMIN } from './customs.api';
import { StageBadge, CbsaBadge } from './CustomsBits';
import { TRANSPORT_ICONS } from './customsMeta';

const FILTERS = [
    { key: '' },
    { key: 'open', stage: 'submitted,in_review,awaiting_client,release_requested,cbsa_exam,released,accounted' },
    { key: 'attention', attention: true },
    { key: 'review', stage: 'submitted,in_review' },
    { key: 'cbsa', stage: 'release_requested,cbsa_exam' },
    { key: 'released', stage: 'released,accounted' },
    { key: 'closed', stage: 'invoiced,completed,cancelled' },
];

export default function CustomsTicketsList() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
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
    const newLabel = IS_ADMIN ? t('common.newFile') : t('common.newShipment');

    return (
        <Page
            title={IS_ADMIN ? t('list.titleAdmin') : t('list.titleClient')}
            subtitle={IS_ADMIN ? t('list.subAdmin') : t('list.subClient')}
            actions={<Button icon="fa-solid fa-plus" onClick={() => navigate('/create-customs-ticket')}>{newLabel}</Button>}
        >
            <Card tight>
                <div className="dc-toolbar">
                    <div className="dc-search">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            className="dc-input"
                            placeholder={IS_ADMIN ? t('list.searchAdmin') : t('list.search')}
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>
                <div className="dc-chips">
                    {FILTERS.map((f) => (
                        <button key={f.key} type="button" className={`dc-chip ${filter === f.key ? 'active' : ''}`} onClick={() => { setFilter(f.key); setPage(1); }}>
                            {f.attention && <i className="fa-solid fa-triangle-exclamation" />}
                            {t(`list.filter.${f.key || 'all'}`)}
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: 12 }}>
                    {error && <div className="dc-alert dc-tone-red" style={{ margin: 16 }}>{error}</div>}
                    {!result && !error && <Spinner />}
                    {result && result.data.length === 0 && (
                        <EmptyState
                            icon="fa-solid fa-ship"
                            title={q || filter ? t('list.noMatch') : t('list.noneYet')}
                            action={!q && !filter && <Button icon="fa-solid fa-plus" onClick={() => navigate('/create-customs-ticket')}>{IS_ADMIN ? t('common.newFile') : t('list.submitFirst')}</Button>}
                        >
                            {q || filter ? t('list.noMatchHint') : t('list.noneYetHint')}
                        </EmptyState>
                    )}
                    {result && result.data.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="dc-table">
                                <thead>
                                    <tr>
                                        <th>{t('list.col.reference')}</th>
                                        {IS_ADMIN && <th>{t('list.col.client')}</th>}
                                        <th>{t('list.col.containers')}</th>
                                        <th>{t('list.col.blccn')}</th>
                                        <th>{t('list.col.eta')}</th>
                                        <th>{t('list.col.stage')}</th>
                                        <th>{t('list.col.cbsa')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.data.map((row) => (
                                        <tr key={row.main_id} className="clickable" onClick={() => open(row)}>
                                            <td className="dc-td-head" data-label={t('list.col.reference')}>
                                                <div className="dc-strong">
                                                    {row.transport_mode && <i className={`${TRANSPORT_ICONS[row.transport_mode]} dc-muted`} style={{ marginRight: 8 }} />}
                                                    {row.reference_number}
                                                </div>
                                                <div className="dc-small dc-muted">{formatDate(row.create_date)}</div>
                                            </td>
                                            {IS_ADMIN && <td data-label={t('list.col.client')}>{row.company_name || row.client_name}</td>}
                                            <td data-label={t('list.col.containers')}>
                                                <span className="dc-mono">{row.container_number || '—'}</span>
                                                {row.container_count > 1 && <span className="dc-small dc-muted"> {t('list.more', { count: row.container_count - 1 })}</span>}
                                            </td>
                                            <td data-label={t('list.col.blccnShort')}>
                                                <div className="dc-mono">{row.bill_of_lading || '—'}</div>
                                                {row.cargo_control_number && <div className="dc-small dc-muted dc-mono">{row.cargo_control_number}</div>}
                                            </td>
                                            <td data-label={t('list.col.eta')}>{formatDate(row.eta)}</td>
                                            <td data-label={t('list.col.stage')}>
                                                <StageBadge stage={row.stage} label={row.stage_label} />
                                                {row.client_replied && <div style={{ marginTop: 4 }}><Badge tone="violet" plain><i className="fa-regular fa-comment-dots" /> {t('details.clientReplied')}</Badge></div>}
                                            </td>
                                            <td data-label={t('list.col.cbsa')}><CbsaBadge code={row.cb_status} label={row.cb_status_label} /></td>
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
