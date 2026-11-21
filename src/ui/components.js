/**
 * DeepClear UI kit (shared by the admin and client portals; keep both copies identical).
 * Small, dependency-free building blocks styled by ./dc-ui.css.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { locale, t as tr } from '../i18n';
import './dc-ui.css';

export function Page({ title, subtitle, back, actions, children }) {
    return (
        <div className="dc-page">
            <div className="dc-page-head">
                <div>
                    {back && (
                        <button type="button" className="dc-back" onClick={back.onClick}>
                            <i className="fa-solid fa-arrow-left" /> {back.label}
                        </button>
                    )}
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div className="dc-actions">{actions}</div>}
            </div>
            {children}
        </div>
    );
}

export function Card({ title, sub, actions, children, tight, className = '', id }) {
    return (
        <section className={`dc-card ${className}`} id={id}>
            {(title || actions) && (
                <div className="dc-card-head">
                    <div>
                        {title && <h3>{title}</h3>}
                        {sub && <div className="dc-sub">{sub}</div>}
                    </div>
                    {actions && <div className="dc-actions">{actions}</div>}
                </div>
            )}
            <div className={`dc-card-body ${tight ? 'tight' : ''}`}>{children}</div>
        </section>
    );
}

export function Button({ variant = 'primary', size, block, icon, busy, children, className = '', ...rest }) {
    return (
        <button
            type="button"
            className={`dc-btn dc-btn-${variant} ${size === 'sm' ? 'dc-btn-sm' : ''} ${block ? 'dc-btn-block' : ''} ${className}`}
            disabled={busy || rest.disabled}
            {...rest}
        >
            {busy ? <span className="dc-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : icon && <i className={icon} />}
            {children}
        </button>
    );
}

/** Label + control + hint/error. Pass the control as children, or use the `input` shortcut props. */
export function Field({ label, required, hint, error, warning, className = '', children, ...input }) {
    const id = input.id || input.name;
    let control = children;
    if (!control) {
        const { as, options, upper, ...props } = input;
        const cls = `dc-input ${upper ? 'dc-input-upper' : ''}`;
        if (as === 'select') {
            control = (
                <select id={id} className={cls} {...props}>
                    {options.map((o) => (
                        <option key={String(o.value)} value={o.value}>{o.label}</option>
                    ))}
                </select>
            );
        } else if (as === 'textarea') {
            control = <textarea id={id} className={cls} {...props} />;
        } else {
            control = <input id={id} className={cls} {...props} />;
        }
    }
    return (
        <div className={`dc-field ${error ? 'has-error' : ''} ${className}`}>
            {label && (
                <label htmlFor={id}>
                    {label}
                    {required && <span className="req">*</span>}
                </label>
            )}
            {control}
            {error ? <span className="dc-error">{error}</span> : warning ? <span className="dc-warn">{warning}</span> : hint && <span className="dc-hint">{hint}</span>}
        </div>
    );
}

export function Badge({ tone = 'gray', plain, children, title }) {
    return <span className={`dc-badge dc-tone-${tone} ${plain ? 'plain' : ''}`} title={title}>{children}</span>;
}

export function Spinner() {
    return <div className="dc-loading"><span className="dc-spinner" /></div>;
}

export function EmptyState({ icon = 'fa-regular fa-folder-open', title, children, action }) {
    return (
        <div className="dc-empty">
            <i className={icon} />
            {title && <b>{title}</b>}
            {children && <div>{children}</div>}
            {action && <div style={{ marginTop: 14 }}>{action}</div>}
        </div>
    );
}

export function StatTile({ icon, tone = 'teal', value, label, onClick }) {
    return (
        <div className={`dc-card dc-stat ${onClick ? 'link' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} style={{ marginBottom: 0 }}>
            <div className={`dc-stat-icon dc-tone-${tone}`}><i className={icon} /></div>
            <div>
                <div className="dc-stat-value">{value}</div>
                <div className="dc-stat-label">{label}</div>
            </div>
        </div>
    );
}

export function Pager({ page, limit, total, onPage }) {
    const { t } = useTranslation();
    const pages = Math.max(1, Math.ceil(total / limit));
    const from = total ? (page - 1) * limit + 1 : 0;
    const to = Math.min(total, page * limit);
    return (
        <div className="dc-pager">
            <span>{total ? t('ui.pagerRange', { from, to, total }) : t('ui.pagerNone')}</span>
            <div className="dc-actions">
                <Button variant="secondary" size="sm" icon="fa-solid fa-chevron-left" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('ui.previous')}</Button>
                <span>{t('ui.pagerPage', { page, pages })}</span>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
                    {t('ui.next')} <i className="fa-solid fa-chevron-right" />
                </Button>
            </div>
        </div>
    );
}

export const ACCEPTED_FILES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';
const MAX_BYTES = 25 * 1024 * 1024;

/** Click or drag files here. Calls onFiles(File[]) with files that pass the type/size check. */
export function DropZone({ onFiles, multiple = true, compact, label: labelProp, disabled }) {
    const { t } = useTranslation();
    const label = labelProp || t('ui.dropLabel');
    const inputRef = useRef(null);
    const [over, setOver] = useState(false);
    const toast = useToast();

    const accept = (list) => {
        const ok = [];
        for (const f of Array.from(list || [])) {
            const ext = f.name.split('.').pop().toLowerCase();
            if (!ACCEPTED_FILES.split(',').includes(`.${ext}`)) toast.error(t('ui.dropBadType', { name: f.name }));
            else if (f.size > MAX_BYTES) toast.error(t('ui.dropTooBig', { name: f.name }));
            else ok.push(f);
        }
        if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
    };

    if (compact) {
        return (
            <>
                <Button variant="secondary" size="sm" icon="fa-solid fa-arrow-up-from-bracket" disabled={disabled} onClick={() => inputRef.current.click()}>{label}</Button>
                <input ref={inputRef} type="file" hidden multiple={multiple} accept={ACCEPTED_FILES}
                    onChange={(e) => { accept(e.target.files); e.target.value = ''; }} />
            </>
        );
    }
    return (
        <div
            className={`dc-drop ${over ? 'over' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => !disabled && inputRef.current.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) accept(e.dataTransfer.files); }}
        >
            <i className="fa-solid fa-cloud-arrow-up" />
            {label}
            <small>{t('ui.dropTypes')}</small>
            <input ref={inputRef} type="file" hidden multiple={multiple} accept={ACCEPTED_FILES}
                onChange={(e) => { accept(e.target.files); e.target.value = ''; }} />
        </div>
    );
}

export function Tabs({ tabs, active, onChange }) {
    return (
        <div className="dc-tabs" role="tablist">
            {tabs.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={active === t.key}
                    className={`dc-tab ${active === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
                    {t.label}{t.count !== undefined && <span className="n">{t.count}</span>}
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ toasts */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);
    const push = useCallback((text, kind = 'ok') => {
        const id = Math.random().toString(36).slice(2);
        setItems((list) => [...list, { id, text, kind }]);
        setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
    }, []);
    const api = React.useMemo(() => ({ success: (t) => push(t, 'ok'), error: (t) => push(t, 'error') }), [push]);
    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="dc-toast-wrap" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`dc-toast ${t.kind === 'error' ? 'error' : ''}`}>
                        <i className={t.kind === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check'} />
                        {t.text}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

const fallbackToast = { success: (t) => console.info(t), error: (t) => console.error(t) }; // eslint-disable-line no-console
export function useToast() {
    return useContext(ToastContext) || fallbackToast;
}

/* ----------------------------------------------------------------- helpers */

/** Debounce a changing value (for search boxes). */
export function useDebounced(value, ms = 300) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

export function formatDate(value, withTime = false) {
    if (!value) return '—';
    const d = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return String(value);
    const opts = { year: 'numeric', month: 'short', day: 'numeric' };
    if (withTime) Object.assign(opts, { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleString(locale(), opts);
}

export function timeAgo(value) {
    if (!value) return '';
    const d = new Date(String(value).replace(' ', 'T'));
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (Number.isNaN(s)) return '';
    if (s < 60) return tr('time.justNow');
    if (s < 3600) return tr('time.minAgo', { n: Math.floor(s / 60) });
    if (s < 86400) return tr('time.hAgo', { n: Math.floor(s / 3600) });
    if (s < 86400 * 7) return tr('time.dAgo', { n: Math.floor(s / 86400) });
    return formatDate(value);
}

export const display = (v) => (v === null || v === undefined || v === '' ? '—' : v);
