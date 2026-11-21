/** Small customs-specific pieces: stage/CBSA badges and the progress stepper. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/components';
import { cbsaName, stageDesc, stageName } from '../../i18n';
import { STAGE_TONE, STAGE_ICON, cbsaTone } from './customsMeta';
import { IS_ADMIN } from './customs.api';

/** `label` is the API's English name, used only when the stage key is unknown. */
export function StageBadge({ stage, label }) {
    useTranslation();
    return <Badge tone={STAGE_TONE[stage] || 'gray'}>{stageName(stage, label)}</Badge>;
}

export function CbsaBadge({ code, label }) {
    const { t } = useTranslation();
    if (code === null || code === undefined || Number(code) === 0) return <Badge tone="gray" plain>{t('cbsa.notReported')}</Badge>;
    return <Badge tone={cbsaTone(code)} title={t('cbsa.codeTitle', { code })}>{cbsaName(code, label)}</Badge>;
}

/**
 * Progress along the normal path. Side stages (action needed, CBSA exam) show
 * as a warning on the step they detour from; cancelled shows on its own.
 */
export function StageStepper({ stage, stages, mainPath, children }) {
    const { t } = useTranslation();
    if (!stages) return null;
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
    const anchor = { awaiting_client: 'in_review', cbsa_exam: 'release_requested' }[stage] || stage;
    const currentIndex = mainPath.indexOf(anchor);
    const side = stage === 'awaiting_client' || stage === 'cbsa_exam';
    const current = byKey[stage] || {};
    const label = (key) => stageName(key, (byKey[key] || {}).label);

    return (
        <div>
            <div className="dc-stepper" aria-label={t('progress')}>
                {mainPath.map((key, i) => {
                    const done = currentIndex > i || (stage === 'completed' && key === 'completed');
                    const isCurrent = i === currentIndex && stage !== 'completed';
                    return (
                        <div key={key} className={`dc-step ${done ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isCurrent && side ? 'warn' : ''}`}>
                            <div className="dc-step-dot">{done ? <i className="fa-solid fa-check" /> : i + 1}</div>
                            <div className="dc-step-label">{isCurrent && side ? label(stage) : label(key)}</div>
                        </div>
                    );
                })}
            </div>
            <div className={`dc-callout dc-tone-${STAGE_TONE[stage] || 'gray'}`}>
                <i className={STAGE_ICON[stage] || 'fa-solid fa-circle-info'} />
                <div>
                    <b>{label(stage)}</b>
                    {(IS_ADMIN && t(`stageAdmin.${stage}`, { defaultValue: '' })) || stageDesc(stage, current.description)}
                    {children}
                </div>
            </div>
        </div>
    );
}
