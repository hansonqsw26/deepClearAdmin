/**
 * Home page with live numbers from POST /<role>/dashboard.
 * Admin: workload across all clients. Client: their own shipments.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, Page, Spinner, StatTile, formatDate, timeAgo } from '../../ui/components';
import { customsApi, IS_ADMIN } from '../customsTickets/customs.api';
import { StageBadge } from '../customsTickets/CustomsBits';
import { STAGE_TONE } from '../customsTickets/customsMeta';
import { getSession } from '../../api/session';

const PIPELINE = [
    ['submitted', 'Documents submitted'],
    ['in_review', 'Broker review'],
    ['awaiting_client', 'Action needed'],
    ['release_requested', 'Release requested'],
    ['cbsa_exam', 'CBSA exam / hold'],
    ['released', 'Released'],
    ['accounted', 'CAD accounted'],
];

const PIPELINE_FILTER = {
    submitted: 'review', in_review: 'review', awaiting_client: 'attention', release_requested: 'cbsa',
    cbsa_exam: 'attention', released: 'released', accounted: 'released',
};

export default function Dashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const session = getSession() || {};

    useEffect(() => {
        customsApi.dashboard().then(setData).catch((e) => setError(e.message));
    }, []);

    const go = (path) => () => navigate(path);
    const hello = session.email ? `Welcome back, ${session.email}` : 'Welcome back';

    return (
        <Page
            title={hello}
            subtitle={IS_ADMIN ? 'What needs your attention today.' : 'Where your shipments stand right now.'}
            actions={<Button icon="fa-solid fa-plus" onClick={go('/create-customs-ticket')}>{IS_ADMIN ? 'New customs file' : 'New shipment'}</Button>}
        >
            {error && <div className="dc-alert dc-tone-red">{error}</div>}
            {!data && !error && <Spinner />}
            {data && (
                <>
                    <div className="dc-grid dc-grid-4" style={{ marginBottom: 20 }}>
                        <StatTile icon="fa-solid fa-ship" tone="teal" value={data.customs.open} label="Open customs files" onClick={go('/customs-tickets-list?f=open')} />
                        <StatTile icon="fa-solid fa-triangle-exclamation" tone={data.customs.needs_attention ? 'amber' : 'gray'} value={data.customs.needs_attention}
                            label={IS_ADMIN ? 'Need attention' : 'Need your action'} onClick={go('/customs-tickets-list?f=attention')} />
                        <StatTile icon="fa-solid fa-shield" tone="blue" value={data.customs.with_cbsa} label="With CBSA now" onClick={go('/customs-tickets-list?f=cbsa')} />
                        <StatTile icon="fa-solid fa-calendar-day" tone="violet" value={data.customs.containers_arriving_7d} label="Containers arriving in 7 days" />
                    </div>

                    <div className="dc-layout-main">
                        <div>
                            <Card title={IS_ADMIN ? 'Needs attention' : 'Waiting on you'} sub="Action needed from the client, or a CBSA exam / hold." tight>
                                {data.attention.length === 0 ? (
                                    <EmptyState icon="fa-regular fa-circle-check" title="All clear">Nothing is blocked right now.</EmptyState>
                                ) : (
                                    <ul className="dc-list-plain">
                                        {data.attention.map((t) => (
                                            <li key={t.main_id} className="clickable" onClick={go(`/customs-ticket-details?main_id=${t.main_id}`)}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="dc-strong">{t.reference_number}</div>
                                                    {IS_ADMIN && <div className="dc-small dc-muted">{t.client_name}</div>}
                                                </div>
                                                <StageBadge stage={t.stage === 'awaiting_client' ? 'awaiting_client' : 'cbsa_exam'} label={t.attention_label} />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <Card title="Customs pipeline" sub="Open files by stage." tight>
                                <ul className="dc-list-plain">
                                    {PIPELINE.map(([key, label]) => {
                                        const n = data.customs.stages[key] || 0;
                                        const max = Math.max(1, ...PIPELINE.map(([k]) => data.customs.stages[k] || 0));
                                        return (
                                            <li key={key} className="clickable" onClick={go(`/customs-tickets-list?f=${PIPELINE_FILTER[key]}`)}>
                                                <span style={{ flex: '0 0 170px' }} className="dc-small">{label}</span>
                                                <div className="dc-progress" style={{ flex: 1 }}>
                                                    <div style={{ width: `${(n / max) * 100}%`, background: `var(--dc-${{ teal: 'primary', gray: 'muted' }[STAGE_TONE[key]] || STAGE_TONE[key]})` }} />
                                                </div>
                                                <b style={{ width: 28, textAlign: 'right' }}>{n}</b>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Card>

                            <Card title="Recent shipments" tight actions={<Button variant="ghost" size="sm" onClick={go('/customs-tickets-list')}>View all</Button>}>
                                {data.recent_tickets.length === 0 ? (
                                    <EmptyState icon="fa-solid fa-ship" title="No shipments yet"
                                        action={<Button icon="fa-solid fa-plus" onClick={go('/create-customs-ticket')}>{IS_ADMIN ? 'New customs file' : 'Submit a shipment'}</Button>} />
                                ) : (
                                    <ul className="dc-list-plain">
                                        {data.recent_tickets.map((t) => (
                                            <li key={t.main_id} className="clickable" onClick={go(`/customs-ticket-details?main_id=${t.main_id}`)}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="dc-strong">{t.reference_number}</div>
                                                    <div className="dc-small dc-muted dc-truncate">
                                                        {IS_ADMIN && `${t.client_name} · `}{t.container_numbers || 'No container yet'} · {formatDate(t.create_date)}
                                                    </div>
                                                </div>
                                                <StageBadge stage={t.stage} label={t.stage_label} />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>

                        <div>
                            <Card title="Latest updates" tight>
                                {data.recent_events.length === 0 ? (
                                    <EmptyState icon="fa-regular fa-bell" title="No updates yet" />
                                ) : (
                                    <ul className="dc-list-plain">
                                        {data.recent_events.map((e) => (
                                            <li key={e.event_id} className="clickable" onClick={go(`/customs-ticket-details?main_id=${e.main_id}`)} style={{ alignItems: 'flex-start' }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="dc-small dc-muted">{e.reference_number} · {timeAgo(e.created_at)}</div>
                                                    <div style={{ fontSize: 14 }}>{e.event_type === 'stage' ? `Stage: ${e.stage_label}` : e.message}</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <Card title="Other services" tight>
                                <ul className="dc-list-plain">
                                    <li className="clickable" onClick={go('/quote-list')}>
                                        <span><i className="fa-solid fa-calculator dc-muted" /> Quotes waiting for a price</span><b>{data.quotes.pending}</b>
                                    </li>
                                    <li className="clickable" onClick={go('/quote-list')}>
                                        <span><i className="fa-solid fa-tag dc-muted" /> Quotes priced</span><b>{data.quotes.priced}</b>
                                    </li>
                                    <li className="clickable" onClick={go('/tickets-list')}>
                                        <span><i className="fa-solid fa-truck-fast dc-muted" /> Trucks pending pickup</span><b>{data.trucking.pending_pickup}</b>
                                    </li>
                                    <li className="clickable" onClick={go('/tickets-list')}>
                                        <span><i className="fa-solid fa-route dc-muted" /> Trucks in transit</span><b>{data.trucking.in_transit}</b>
                                    </li>
                                </ul>
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </Page>
    );
}
