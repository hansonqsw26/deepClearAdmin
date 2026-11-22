/**
 * Language library for both portals: English and Simplified Chinese.
 * The choice is kept in localStorage ('dc-lang'); the first visit follows the browser.
 * Shared by the admin and client portals; keep both copies identical.
 *
 * Text that comes from the API (stage names, document types, CBSA statuses,
 * timeline messages) is translated here by key, with the API's English as the fallback.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import zh from './zh';

export const LANGUAGES = ['en', 'zh'];
const STORE_KEY = 'dc-lang';

function initialLanguage() {
    try {
        const saved = window.localStorage.getItem(STORE_KEY);
        if (LANGUAGES.includes(saved)) return saved;
    } catch (e) {
        // storage blocked: fall through to the browser language
    }
    const browser = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    return browser.some((l) => /^zh\b/i.test(l || '')) ? 'zh' : 'en';
}

function applyToDocument(lng) {
    if (typeof document !== 'undefined') document.documentElement.lang = lng === 'zh' ? 'zh-CN' : 'en';
}

i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, zh: { translation: zh } },
    lng: initialLanguage(),
    fallbackLng: 'en',
    supportedLngs: LANGUAGES,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
    react: { useSuspense: false },
});
applyToDocument(i18n.language);

i18n.on('languageChanged', (lng) => {
    applyToDocument(lng);
    try {
        window.localStorage.setItem(STORE_KEY, lng);
    } catch (e) {
        // not saved; the choice still applies until the page is closed
    }
});

export const t = (...args) => i18n.t(...args);
export const isZh = () => i18n.language === 'zh';
/** Locale for dates and numbers. */
export const locale = () => (isZh() ? 'zh-CN' : 'en-CA');
export const setLanguage = (lng) => i18n.changeLanguage(lng);

/* -------------------------------------------- vocabulary that comes from the API */

export const stageName = (key, fallback) => (key ? t(`stage.${key}.label`, { defaultValue: fallback || key }) : fallback || '');
export const stageDesc = (key, fallback) => t(`stage.${key}.desc`, { defaultValue: fallback || '' });
export const cbsaName = (code, fallback) => t(`cbsa.status.${Number(code)}`, { defaultValue: fallback || t('cbsa.code', { code }) });
export const transportName = (key) => (key ? t(`transport.${key}`, { defaultValue: key }) : '');

/** English label -> document key, for API text that carries only the label. */
const DOC_KEY_BY_LABEL = Object.fromEntries(Object.entries(en.doc).map(([key, d]) => [d.label.toLowerCase(), key]));
const docKey = (keyOrLabel) => {
    const s = String(keyOrLabel || '');
    return en.doc[s] ? s : DOC_KEY_BY_LABEL[s.toLowerCase()];
};
export const docName = (keyOrLabel) => {
    const key = docKey(keyOrLabel);
    return key ? t(`doc.${key}.label`) : String(keyOrLabel || '');
};
export const docHint = (key, fallback) => t(`doc.${key}.hint`, { defaultValue: fallback || '' });

/** English CBSA status text (as the API writes it) -> code. */
const CBSA_CODE_BY_LABEL = Object.fromEntries(Object.entries(en.cbsa.status).map(([code, label]) => [label.toLowerCase(), code]));
const cbsaFromLabel = (label) => {
    const code = CBSA_CODE_BY_LABEL[String(label).toLowerCase()];
    return code !== undefined ? t(`cbsa.status.${code}`) : label;
};

/**
 * Timeline and update messages are stored in English by the API. Known ones are
 * translated; anything else (comments, broker notes) is shown as written.
 */
const EVENT_PATTERNS = [
    [/^Shipment submitted\.$/, () => t('event.submitted')],
    [/^File opened by DeepClear\.$/, () => t('event.opened')],
    [/^Client approved the draft entry \(CAD\)\.$/, () => t('event.cadApproved')],
    [/^Client updated the shipment details\.$/, () => t('event.clientUpdated')],
    [/^Container ?(\S*) added\.$/, (m) => t('event.containerAdded', { n: m[1] })],
    [/^Container ?(\S*) removed\.$/, (m) => t('event.containerRemoved', { n: m[1] })],
    [/^CBSA status: (.+?)( \([A-Z0-9, ]+\))?$/, (m) => t('event.cbsaStatus', { status: cbsaFromLabel(m[1]), which: m[2] || '' })],
    [/^Updated automatically from CBSA status "(.+)"\.$/, (m) => t('event.autoStage', { status: cbsaFromLabel(m[1]) })],
    [/^Customs entry (\d{14}) set(?: for (.+))?\.$/, (m) => t('event.entrySet', { txn: m[1], which: m[2] ? t('event.entryFor', { list: m[2] }) : '' })],
    [/^Customs entry removed(?: from (.+))?\.$/, (m) => t('event.entryRemoved', { which: m[1] ? t('event.entryFrom', { list: m[1] }) : '' })],
    [/^(Vessel|Port|Rail) ETA for (\S+): (\S+ \S+) \((.+)\)\.$/, (m) => t('event.etaUpdate', { kind: t(`event.etaKind.${m[1]}`), n: m[2], when: m[3], source: m[4] })],
    [/^(.+?) uploaded: (.+)$/s, (m) => (docKey(m[1]) ? t('event.docUploaded', { doc: docName(m[1]), name: m[2] }) : null)],
];
export function eventText(message) {
    if (!message || !isZh()) return message;
    for (const [re, fn] of EVENT_PATTERNS) {
        const m = re.exec(message);
        if (m) return fn(m) || message;
    }
    return message;
}

export default i18n;
