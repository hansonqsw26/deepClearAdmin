/**
 * Change your own password. Shared by both portals.
 *
 *   forced: shown full screen right after signing in with a temporary password
 *           (new account or a reset by staff); nothing else opens until it is done.
 *   normal: the "Change password" page from the profile menu.
 */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, Page, useToast } from '../../ui/components';
import LanguageSwitch from '../../i18n/LanguageSwitch';
import { call } from '../customsTickets/customs.api';
import { getSession, saveSession } from '../../api/session';
import { Logout, loginConfirmedAction } from '../../store/actions/AuthActions';

const MIN = 8;

function PasswordForm({ forced, onDone }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [form, setForm] = useState({ current: '', next: '', confirm: '' });
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    async function submit(e) {
        e.preventDefault();
        const errs = {};
        if (!form.current) errs.current = t('password.wrong');
        if (form.next.length < MIN) errs.next = t('password.tooShort');
        else if (form.next === form.current) errs.next = t('password.same');
        if (!errs.next && form.next !== form.confirm) errs.confirm = t('password.mismatch');
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setBusy(true);
        try {
            await call('/changePassword', { current_password: form.current, new_password: form.next });
            toast.success(t('password.saved'));
            setForm({ current: '', next: '', confirm: '' });
            onDone();
        } catch (err) {
            const f = err.fields || {};
            setErrors({
                current: f.current_password ? t('password.wrong') : undefined,
                next: f.new_password === 'too_short' ? t('password.tooShort') : f.new_password === 'same' ? t('password.same') : undefined,
            });
            if (!f.current_password && !f.new_password) toast.error(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} noValidate>
            <p className="dc-small dc-muted" style={{ marginTop: 0 }}>{forced ? t('password.forcedLead') : t('password.lead')}</p>
            <div className="dc-grid" style={{ gridTemplateColumns: '1fr', maxWidth: 420 }}>
                <Field label={forced ? t('password.currentTemp') : t('password.current')} name="current_password" type="password"
                    autoComplete="current-password" value={form.current} onChange={set('current')} error={errors.current} />
                <Field label={t('password.next')} name="new_password" type="password" autoComplete="new-password"
                    value={form.next} onChange={set('next')} error={errors.next} hint={t('password.tooShort')} />
                <Field label={t('password.confirm')} name="confirm_password" type="password" autoComplete="new-password"
                    value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
            </div>
            <div className="dc-actions" style={{ marginTop: 16 }}>
                <Button type="submit" busy={busy} icon="fa-solid fa-lock">{t('password.save')}</Button>
            </div>
        </form>
    );
}

/** Profile menu page. */
export default function SetPassword() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    return (
        <Page title={t('password.title')}>
            <Card>
                <PasswordForm onDone={() => navigate('/dashboard')} />
            </Card>
        </Page>
    );
}

/** Full-screen step after signing in with a temporary password. */
export function ForcedPasswordChange() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const auth = useSelector((s) => s.auth && s.auth.auth);

    const done = () => {
        const session = { ...(getSession() || auth), mustChangePassword: false };
        saveSession(session);
        dispatch(loginConfirmedAction(session));
        navigate('/dashboard');
    };

    return (
        <div className="dc-forced-pw">
            <div className="dc-forced-pw-top">
                <span className="dc-forced-pw-brand"><i className="fa-solid fa-ship" /> DeepClear</span>
                <LanguageSwitch />
            </div>
            <Card title={t('password.forcedTitle')} className="dc-forced-pw-card">
                <PasswordForm forced onDone={done} />
                <button type="button" className="dc-link" style={{ marginTop: 18, display: "inline-flex", gap: 6, alignItems: "center" }} onClick={() => dispatch(Logout(navigate))}>
                    <i className="fa-solid fa-arrow-right-from-bracket" /> {t('nav.logout', { defaultValue: 'Sign out' })}
                </button>
            </Card>
        </div>
    );
}
