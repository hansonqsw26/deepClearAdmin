/**
 * Display helpers for customs tickets: colours for stages and CBSA codes,
 * the options loaded once from the API (stages, document types, ...), and
 * a client-side container-number check that mirrors the API.
 */
import { useEffect, useState } from 'react';
import { customsApi } from './customs.api';
import { stageName, t } from '../../i18n';

export const STAGE_TONE = {
    submitted: 'blue',
    in_review: 'violet',
    awaiting_client: 'amber',
    release_requested: 'teal',
    cbsa_exam: 'red',
    released: 'green',
    accounted: 'green',
    invoiced: 'gray',
    completed: 'gray',
    cancelled: 'gray',
};

export const STAGE_ICON = {
    submitted: 'fa-solid fa-inbox',
    in_review: 'fa-solid fa-magnifying-glass',
    awaiting_client: 'fa-solid fa-triangle-exclamation',
    release_requested: 'fa-solid fa-paper-plane',
    cbsa_exam: 'fa-solid fa-shield',
    released: 'fa-solid fa-circle-check',
    accounted: 'fa-solid fa-file-invoice',
    invoiced: 'fa-solid fa-receipt',
    completed: 'fa-solid fa-box-archive',
    cancelled: 'fa-solid fa-ban',
};

const RELEASED = [4, 6, 7, 23];
const ATTENTION = [2, 5, 8, 14, 24];
const ACCEPTED = [1, 9, 34];

export function cbsaTone(code) {
    const n = Number(code);
    if (RELEASED.includes(n)) return 'green';
    if (ATTENTION.includes(n)) return 'red';
    if (ACCEPTED.includes(n)) return 'teal';
    return 'gray';
}

/* Getters, so the labels follow the current language wherever they are read. */
export const CAD_STATUS = {
    get 0() { return t('cad.0'); },
    get 1() { return t('cad.1'); },
    get 2() { return t('cad.2'); },
};

export const TRANSPORT_LABELS = {
    get marine() { return t('transport.marine'); },
    get air() { return t('transport.air'); },
    get rail() { return t('transport.rail'); },
    get highway() { return t('transport.highway'); },
};
export const TRANSPORT_ICONS = { marine: 'fa-solid fa-ship', air: 'fa-solid fa-plane', rail: 'fa-solid fa-train', highway: 'fa-solid fa-truck' };

/** Common origin countries first, then the rest is free text (2-letter code). */
export const COUNTRIES = [
    ['CN', 'China'], ['US', 'United States'], ['MX', 'Mexico'], ['VN', 'Vietnam'], ['IN', 'India'], ['JP', 'Japan'],
    ['KR', 'South Korea'], ['TW', 'Taiwan'], ['TH', 'Thailand'], ['MY', 'Malaysia'], ['ID', 'Indonesia'], ['BD', 'Bangladesh'],
    ['PK', 'Pakistan'], ['TR', 'Türkiye'], ['DE', 'Germany'], ['IT', 'Italy'], ['FR', 'France'], ['ES', 'Spain'],
    ['GB', 'United Kingdom'], ['NL', 'Netherlands'], ['BE', 'Belgium'], ['PL', 'Poland'], ['PT', 'Portugal'],
    ['BR', 'Brazil'], ['CL', 'Chile'], ['PE', 'Peru'], ['CO', 'Colombia'], ['AU', 'Australia'], ['NZ', 'New Zealand'],
    ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['IL', 'Israel'], ['EG', 'Egypt'], ['ZA', 'South Africa'],
    ['PH', 'Philippines'], ['SG', 'Singapore'], ['HK', 'Hong Kong'], ['KH', 'Cambodia'], ['LK', 'Sri Lanka'],
];
export const countryName = (code) => t(`country.${code}`, { defaultValue: (COUNTRIES.find(([c]) => c === code) || [code, code])[1] });

export const CURRENCIES = ['USD', 'CAD', 'EUR', 'CNY', 'GBP', 'JPY', 'MXN', 'INR', 'KRW', 'VND', 'AUD', 'HKD'];

/** Mirrors the API: returns { error } for a bad format, { warning } for a bad ISO 6346 check digit. */
export function checkContainer(raw) {
    const v = String(raw || '').toUpperCase().replace(/[\s-]/g, '');
    if (!v) return {};
    if (!/^[A-Z]{4}\d{7}$/.test(v)) return { error: t('container.format') };
    if (!/^[A-Z]{3}[UJZ]/.test(v)) return { warning: t('container.fourth') };
    const letter = (ch) => {
        let n = 10;
        for (let c = 65; c < ch.charCodeAt(0); c += 1) {
            n += 1;
            if (n % 11 === 0) n += 1;
        }
        return n;
    };
    let sum = 0;
    for (let i = 0; i < 10; i += 1) sum += (i < 4 ? letter(v[i]) : Number(v[i])) * (2 ** i);
    return (sum % 11) % 10 === Number(v[10]) ? {} : { warning: t('container.checkDigit') };
}

let optionsPromise = null;
/** Stages, document types, sizes... loaded once per page load. */
export function useCustomsOptions() {
    const [options, setOptions] = useState(null);
    useEffect(() => {
        let alive = true;
        optionsPromise = optionsPromise || customsApi.options().catch((e) => {
            optionsPromise = null;
            throw e;
        });
        optionsPromise.then((o) => alive && setOptions(o)).catch(() => {});
        return () => {
            alive = false;
        };
    }, []);
    return options;
}

export const stageLabel = (options, key) => {
    const s = options && options.stages.find((x) => x.key === key);
    return stageName(key, s && s.label);
};
