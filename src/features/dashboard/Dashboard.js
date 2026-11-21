/**
 * Home page with live numbers from POST /<role>/dashboard.
 * Admin: workload across all clients. Client: their own shipments.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, EmptyState, Page, Spinner, StatTile, formatDate, timeAgo } from '../../ui/components';
import { cbsaName, eventText, stageName } from '../../i18n';
import { customsApi, IS_ADMIN } from '../customsTickets/customs.api';
import { StageBadge } from '../customsTickets/CustomsBits';
import { STAGE_TONE } from '../customsTickets/customsMeta';
import { getSession } from '../../api/session';

const PIPELINE = ['submitted', 'in_review', 'awaiting_client', 'release_requested', 'cbsa_exam', 'released', 'accounted'];

const PIPELINE_FILTER = {
    submitted: 'review', in_review: 'review', awaiting_client: 'attention', release_requested: 'cbsa',
    cbsa_exam: 'attention', released: 'released', accounted: 'released',
};

export default function Dashboard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const session = getSession() || {};

    useEffect(() => {
        customsApi.dashboard().then(setData).catch((e) => setError(e.message));
    }, []);

    const go = (path) => () => navigate(path);
    const hello = (session.name || session.email) ? t('dash.hello', { email: session.name || session.email }) : t('dash.helloPlain');
    const newLabel = IS_ADMIN ? t('common.newFile') : t('common.newShipment');

    return (
        <Page
            title={hello}
            subtitle={IS_ADMIN ? t('dash.subAdmin') : t('dash.subClient')}
            actions={(
                <>
                    <Button variant="secondary" icon="fa-solid fa-chart-column" onClick={go('/ticket-summary')}>{t('dash.summary')}</Button>
                    <Button icon="fa-solid fa-plus" onClick={go('/create-customs-ticket')}>{newLabel}</Button>
                </>
            )}
        >
            {error && <div className="dc-alert dc-tone-red">{error}</div>}
            {!data && !error && <Spinner />}
            {data && (
                <>
                    <div className="dc-grid dc-grid-4" style={{ marginBottom: 20 }}>
                        <StatTile icon="fa-solid fa-ship" tone="teal" value={data.customs.open} label={t('dash.statOpen')} onClick={go('/customs-tickets-list?f=open')} />
                        <StatTile icon="fa-solid fa-triangle-exclamation" tone={data.customs.needs_attention ? 'amber' : 'gray'} value={data.customs.needs_attention}
                            label={IS_ADMIN ? t('dash.statAttentionAdmin') : t('dash.statAttentionClient')} onClick={go('/customs-tickets-list?f=attention')} />
                        <StatTile icon="fa-solid fa-shield" tone="blue" value={data.customs.with_cbsa} label={t('dash.statCbsa')} onClick={go('/customs-tickets-list?f=cbsa')} />
                        <StatTile icon="fa-solid fa-calendar-day" tone="violet" value={data.customs.containers_arriving_7d} label={t('dash.statArriving')} />
                    </div>

                    <div className="dc-layout-main">
                        <div>
                            <Card title={IS_ADMIN ? t('dash.attentionAdmin') : t('dash.attentionClient')} sub={t('dash.attentionSub')} tight>
                                {data.attention.length === 0 ? (
                                    <EmptyState icon="fa-regular fa-circle-check" title={t('dash.allClear')}>{t('dash.allClearText')}</EmptyState>
                                ) : (
                                    <ul className="dc-list-plain">
                                        {data.attention.map((row) => (
                                            <li key={row.main_id} className="clickable" onClick={go(`/customs-ticket-details?main_id=${row.main_id}`)}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="dc-strong">{row.reference_number}</div>
                                                    {IS_ADMIN && <div className="dc-small dc-muted">{row.company_name || row.client_name}</div>}
                                                </div>
                                                {row.client_replied ? (
                                                    <Badge tone="violet"><i className="fa-regular fa-comment-dots" /> {t('details.clientReplied')}</Badge>
                                                ) : (
                                                    <Badge tone={STAGE_TONE[row.stage === 'awaiting_client' ? 'awaiting_client' : 'cbsa_exam']}>
                                                        {row.attention_status != null ? cbsaName(row.attention_status, row.attention_label) : stageName(row.stage, row.attention_label)}
                                                    </Badge>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <Card title={t('dash.pipeline')} sub={t('dash.pipelineSub')} tight>
                                <ul className="dc-list-plain">
                                    {PIPELINE.map((key) => {
                                        const n = data.customs.stages[key] || 0;
                                        const max = Math.max(1, ...PIPELINE.map((k) => data.customs.stages[k] || 0));
                                        return (
                                            <li key={key} className="clickable" onClick={go(`/customs-tickets-list?f=${PIPELINE_FILTER[key]}`)}>
                                                <span style={{ flex: '0 0 170px' }} className="dc-small">{t(`dash.short.${key}`)}</span>
                                                <div className="dc-progress" style={{ flex: 1 }}>
                                                    <div style={{ width: `${(n / max) * 100}%`, background: `var(--dc-${{ teal: 'primary', gray: 'muted' }[STAGE_TONE[key]] || STAGE_TONE[key]})` }} />
                                                </div>
                                                <b style={{ width: 28, textAlign: 'right' }}>{n}</b>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Card>

                            <Card title={t('dash.recent')} tight actions={<Button variant="ghost" size="sm" onClick={go('/customs-tickets-list')}>{t('common.viewAll')}</Button>}>
                                {data.recent_tickets.length === 0 ? (
                                    <EmptyState icon="fa-solid fa-ship" title={t('dash.noShipments')}
                                        action={<Button icon="fa-solid fa-plus" onClick={go('/create-customs-ticket')}>{IS_ADMIN ? t('common.newFile') : t('dash.submitShipment')}</Button>} />
                                ) : (
                                    <ul className="dc-list-plain">
                                        {data.recent_tickets.map((row) => (
                                            <li key={row.main_id} className="clickable" onClick={go(`/customs-ticket-details?main_id=${row.main_id}`)}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="dc-strong">{row.reference_number}</div>
                                                    <div className="dc-small dc-muted dc-truncate">
                                                        {IS_ADMIN && `${row.company_name || row.client_name} · `}{row.container_numbers || t('dash.noContainer')} · {formatDate(row.create_date)}
                                                    </div>
                                                </div>
                                                <StageBadge stage={row.stage} label={row.stage_label} />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>

                        <div>
                            <Card title={t('dash.updates')} tight>
                                {data.recent_events.length === 0 ? (
                                    <EmptyState icon="fa-regular fa-bell" title={t('dash.noUpdates')} />
                                ) : (
                                    <ul className="dc-list-plain">
                                        {data.recent_events.map((e) => (
                                            <li key={e.event_id} className="clickable" onClick={go(`/customs-ticket-details?main_id=${e.main_id}`)} style={{ alignItems: 'flex-start' }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="dc-small dc-muted">{e.reference_number} · {timeAgo(e.created_at)}</div>
                                                    <div style={{ fontSize: 14 }}>{e.event_type === 'stage' ? t('dash.stageUpdate', { stage: stageName(e.stage, e.stage_label) }) : eventText(e.message)}</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <Card title={t('dash.other')} tight>
                                <ul className="dc-list-plain">
                                    <li className="clickable" onClick={go('/quote-list')}>
                                        <span><i className="fa-solid fa-calculator dc-muted" /> {t('dash.quotesPending')}</span><b>{data.quotes.pending}</b>
                                    </li>
                                    <li className="clickable" onClick={go('/quote-list')}>
                                        <span><i className="fa-solid fa-tag dc-muted" /> {t('dash.quotesPriced')}</span><b>{data.quotes.priced}</b>
                                    </li>
                                    <li className="clickable" onClick={go('/tickets-list')}>
                                        <span><i className="fa-solid fa-truck-fast dc-muted" /> {t('dash.trucksPending')}</span><b>{data.trucking.pending_pickup}</b>
                                    </li>
                                    <li className="clickable" onClick={go('/tickets-list')}>
                                        <span><i className="fa-solid fa-route dc-muted" /> {t('dash.trucksTransit')}</span><b>{data.trucking.in_transit}</b>
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
