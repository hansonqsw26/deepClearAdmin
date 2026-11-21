/**
 * Sign-in page, shared by the admin and client portals (keep both copies identical).
 * APP_ROLE decides the wording (i18n keys login.admin.* / login.client.*); the login itself is store/actions/AuthActions.loginAction.
 */
import React, { useEffect, useRef, useState } from 'react';
import { connect, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { stageName } from '../../i18n';
import LanguageSwitch from '../../i18n/LanguageSwitch';
import { loadingToggleAction, loginAction, loginFailedAction } from '../../store/actions/AuthActions';
import { APP_ROLE } from '../../config/env';
import logo from '../../images/logo-full-white.png';
import './login.css';

const IS_ADMIN = APP_ROLE === 'admin';
const ROLE = IS_ADMIN ? 'admin' : 'client';

const POINT_ICONS = IS_ADMIN
    ? ['fa-solid fa-ship', 'fa-solid fa-shield', 'fa-solid fa-chart-column']
    : ['fa-solid fa-file-arrow-up', 'fa-solid fa-shield', 'fa-solid fa-bell'];

/** Demo card steps: stage keys and their state. */
const DEMO_STEPS = [
    ['submitted', 'done'],
    ['in_review', 'done'],
    ['release_requested', 'done'],
    ['released', 'current'],
];

function Login({ errorMessage, showLoading }) {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [errors, setErrors] = useState({});
    const userRef = useRef(null);
    const passRef = useRef(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const year = new Date().getFullYear();

    useEffect(() => {
        // Clear an old error from a previous visit.
        dispatch(loginFailedAction(''));
        // Focus the first field on desktop; on phones it would pop the keyboard over the page.
        const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        if (userRef.current && !touch) userRef.current.focus();
    }, [dispatch]);

    const rawError = errorMessage && (typeof errorMessage === 'string' ? errorMessage : errorMessage.message || errorMessage.error);
    const serverError = rawError && /invalid credentials/i.test(rawError)
        ? t('login.badCredentials')
        : rawError && /turned off/i.test(rawError)
            ? t('login.accountOff')
            : rawError;

    function onSubmit(e) {
        e.preventDefault();
        const next = {};
        if (!username.trim()) next.username = t('login.enterUsername');
        if (!password) next.password = t('login.enterPassword');
        setErrors(next);
        if (next.username) return userRef.current && userRef.current.focus();
        if (next.password) return passRef.current && passRef.current.focus();
        dispatch(loadingToggleAction(true));
        dispatch(loginAction(username.trim(), password, navigate));
    }

    const onKey = (e) => setCapsLock(Boolean(e.getModifierState && e.getModifierState('CapsLock')));

    return (
        <div className="dl-page">
            <aside className="dl-hero">
                <svg className="dl-hero-art" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    <defs>
                        <pattern id="dl-dots" width="22" height="22" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1.3" fill="rgba(255,255,255,.10)" />
                        </pattern>
                    </defs>
                    <rect width="600" height="800" fill="url(#dl-dots)" />
                    <path d="M-40 620 C 120 520, 260 700, 420 560 S 640 420, 700 470" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2" strokeDasharray="6 8" />
                    <path d="M-40 680 C 160 600, 300 760, 460 640 S 660 520, 700 560" fill="none" stroke="rgba(214,178,74,.35)" strokeWidth="2" />
                    <circle cx="520" cy="120" r="160" fill="rgba(43,179,167,.18)" />
                    <circle cx="80" cy="760" r="200" fill="rgba(255,255,255,.04)" />
                </svg>

                <div className="dl-hero-inner">
                    <div className="dl-brand">
                        <span className="dl-brand-mark"><i className="fa-solid fa-ship" /></span>
                        <span>DeepClear</span>
                        <span className="dl-pill">{t(IS_ADMIN ? 'login.portalAdmin' : 'login.portalClient')}</span>
                    </div>

                    <div className="dl-hero-copy">
                        <h1>{t(`login.${ROLE}.headline`)}</h1>
                        <p>{t(`login.${ROLE}.lead`)}</p>
                        <ul className="dl-points">
                            {POINT_ICONS.map((icon, i) => (
                                <li key={icon}><span><i className={icon} /></span>{t(`login.${ROLE}.point${i + 1}`)}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="dl-demo" aria-hidden="true">
                        <div className="dl-demo-head">
                            <div>
                                <div className="dl-demo-ref">CB-24117 · 2 × 40HC</div>
                                <div className="dl-demo-sub">{t('login.demoRoute')}</div>
                            </div>
                            <span className="dl-demo-badge"><i className="fa-solid fa-circle-check" /> {t('login.demoReleased')}</span>
                        </div>
                        <ol className="dl-demo-steps">
                            {DEMO_STEPS.map(([key, state]) => (
                                <li key={key} className={state}><i />{stageName(key)}</li>
                            ))}
                        </ol>
                    </div>

                    <div className="dl-hero-foot">© {year} DeepClear Inc · Think Deep, Solve Clear</div>
                </div>
            </aside>

            <main className="dl-main">
                <LanguageSwitch className="dl-lang" />
                <div className="dl-card">
                    <img src={logo} alt="DeepClear" className="dl-logo" />
                    <div className="dl-title">
                        <h2>{t('login.welcome')}</h2>
                        <p>{t(`login.${ROLE}.signIn`)}</p>
                    </div>

                    {serverError && (
                        <div className="dl-alert" role="alert">
                            <i className="fa-solid fa-circle-exclamation" />
                            <span>{serverError}</span>
                        </div>
                    )}

                    <form onSubmit={onSubmit} noValidate>
                        <div className={`dl-field ${errors.username ? 'invalid' : ''}`}>
                            <label htmlFor="dl-username">{t(`login.${ROLE}.userLabel`)}</label>
                            <div className="dl-input">
                                <i className="fa-regular fa-user" />
                                <input
                                    id="dl-username"
                                    ref={userRef}
                                    name="username"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    spellCheck="false"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        if (errors.username) setErrors({ ...errors, username: '' });
                                    }}
                                    placeholder={t('login.userPlaceholder')}
                                    aria-invalid={Boolean(errors.username)}
                                    aria-describedby={errors.username ? 'dl-username-err' : undefined}
                                />
                            </div>
                            {errors.username && <span className="dl-err" id="dl-username-err">{errors.username}</span>}
                        </div>

                        <div className={`dl-field ${errors.password ? 'invalid' : ''}`}>
                            <label htmlFor="dl-password">{t('login.password')}</label>
                            <div className="dl-input">
                                <i className="fa-solid fa-lock" />
                                <input
                                    id="dl-password"
                                    ref={passRef}
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (errors.password) setErrors({ ...errors, password: '' });
                                    }}
                                    onKeyUp={onKey}
                                    onKeyDown={onKey}
                                    placeholder={t('login.passPlaceholder')}
                                    aria-invalid={Boolean(errors.password)}
                                    aria-describedby={errors.password ? 'dl-password-err' : undefined}
                                />
                                <button type="button" className="dl-eye" onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')} aria-pressed={showPassword}>
                                    <i className={showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'} />
                                </button>
                            </div>
                            {errors.password && <span className="dl-err" id="dl-password-err">{errors.password}</span>}
                            {!errors.password && capsLock && <span className="dl-warn"><i className="fa-solid fa-arrow-up" /> {t('login.capsLock')}</span>}
                        </div>

                        <button type="submit" className="dl-submit" disabled={showLoading}>
                            {showLoading ? <span className="dl-spinner" aria-hidden="true" /> : null}
                            {showLoading ? t('login.signingIn') : t('login.signIn')}
                            {!showLoading && <i className="fa-solid fa-arrow-right" />}
                        </button>
                    </form>

                    <p className="dl-help">{t(`login.${ROLE}.help`)}</p>

                    {!IS_ADMIN && (
                        <Link to="/cbsa-checking" className="dl-secondary">
                            <span className="dl-secondary-icon"><i className="fa-solid fa-magnifying-glass" /></span>
                            <span>
                                <b>{t('login.checkTitle')}</b>
                                <small>{t('login.checkSub')}</small>
                            </span>
                            <i className="fa-solid fa-chevron-right" />
                        </Link>
                    )}

                    <div className="dl-secure"><i className="fa-solid fa-lock" /> {t('login.secure')}</div>
                </div>
            </main>
        </div>
    );
}

const mapStateToProps = (state) => ({
    errorMessage: state.auth.errorMessage,
    showLoading: state.auth.showLoading,
});

export default connect(mapStateToProps)(Login);
