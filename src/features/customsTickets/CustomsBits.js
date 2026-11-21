/** Small customs-specific pieces: stage/CBSA badges and the progress stepper. */
import React from 'react';
import { Badge } from '../../ui/components';
import { STAGE_TONE, STAGE_ICON, cbsaTone } from './customsMeta';

export function StageBadge({ stage, label }) {
    return <Badge tone={STAGE_TONE[stage] || 'gray'}>{label || stage}</Badge>;
}

export function CbsaBadge({ code, label }) {
    if (code === null || code === undefined || Number(code) === 0) return <Badge tone="gray" plain>Not reported yet</Badge>;
    return <Badge tone={cbsaTone(code)} title={`CBSA code ${code}`}>{label || `Code ${code}`}</Badge>;
}

/**
 * Progress along the normal path. Side stages (action needed, CBSA exam) show
 * as a warning on the step they detour from; cancelled shows on its own.
 */
export function StageStepper({ stage, stages, mainPath }) {
    if (!stages) return null;
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
    const anchor = { awaiting_client: 'in_review', cbsa_exam: 'release_requested' }[stage] || stage;
    const currentIndex = mainPath.indexOf(anchor);
    const side = stage === 'awaiting_client' || stage === 'cbsa_exam';
    const current = byKey[stage] || {};

    return (
        <div>
            <div className="dc-stepper" aria-label="Shipment progress">
                {mainPath.map((key, i) => {
                    const done = currentIndex > i || (stage === 'completed' && key === 'completed');
                    const isCurrent = i === currentIndex && stage !== 'completed';
                    return (
                        <div key={key} className={`dc-step ${done ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isCurrent && side ? 'warn' : ''}`}>
                            <div className="dc-step-dot">{done ? <i className="fa-solid fa-check" /> : i + 1}</div>
                            <div className="dc-step-label">{isCurrent && side ? current.label : byKey[key].label}</div>
                        </div>
                    );
                })}
            </div>
            <div className={`dc-callout dc-tone-${STAGE_TONE[stage] || 'gray'}`}>
                <i className={STAGE_ICON[stage] || 'fa-solid fa-circle-info'} />
                <div>
                    <b>{current.label}</b>
                    {current.description}
                </div>
            </div>
        </div>
    );
}
