/**
 * Sign-in page, shared by the admin and client portals (keep both copies identical).
 * APP_ROLE decides the wording; the login itself is store/actions/AuthActions.loginAction.
 */
import React, { useEffect, useRef, useState } from 'react';
import { connect, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { loadingToggleAction, loginAction, loginFailedAction } from '../../store/actions/AuthActions';
import { APP_ROLE } from '../../config/env';
import logo from '../../images/logo-full-white.png';
import './login.css';

const IS_ADMIN = APP_ROLE === 'admin';

const COPY = IS_ADMIN
    ? {
        portal: 'Admin portal',
        headline: 'Your customs brokerage desk, in one place.',
        lead: 'Every client file, document and CBSA status, with what needs attention first.',
        points: [
            ['fa-solid fa-ship', 'Customs files from intake to CAD accounting'],
            ['fa-solid fa-shield', 'Live CBSA status from Candata, updated automatically'],
            ['fa-solid fa-chart-column', 'Ticket summary per client, with overdue highlights'],
        ],
        userLabel: 'Staff username',
        help: 'Forgot your password? Ask a DeepClear administrator to reset it.',
    }
    : {
        portal: 'Client portal',
        headline: 'Clear your shipments into Canada, without the paperwork chase.',
        lead: 'Send your documents once, then follow every step until CBSA releases your cargo.',
        points: [
            ['fa-solid fa-file-arrow-up', 'Submit shipments and documents online'],
            ['fa-solid fa-shield', 'Live CBSA status, from release request to release'],
            ['fa-solid fa-bell', 'See right away when your broker needs something'],
        ],
        userLabel: 'Username',
        help: 'Forgot your password? Contact your DeepClear broker and we will reset it.',
    };

const DEMO_STEPS = [
    ['Documents submitted', 'done'],
    ['Broker review', 'done'],
    ['Release requested (PARS/RMD)', 'done'],
    ['Released by CBSA', 'current'],
];

function Login({ errorMessage, showLoading }) {
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
        ? "That username and password don't match. Check them and try again."
        : rawError;

    function onSubmit(e) {
        e.preventDefault();
        const next = {};
        if (!username.trim()) next.username = 'Enter your username.';
        if (!password) next.password = 'Enter your password.';
        setErrors(next);
        if (next.username) return userRef.current && userRef.current.focus();
        if (next.password) return passRef.current && passRef.current.focus();
        dispatch(loadingToggleAction(true));
        dispatch(loginAction(username.trim(), password, navigate));
    }

    const onKey = (e) => setCapsLock(Boolean(e.getModifierState && e.getModifierState('CapsLock')));

    return (
        <div className="dl-page">
            <aside className="dl-hero" aria-hidden="false">
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
                        <span className="dl-pill">{COPY.portal}</span>
                    </div>

                    <div className="dl-hero-copy">
                        <h1>{COPY.headline}</h1>
                        <p>{COPY.lead}</p>
                        <ul className="dl-points">
                            {COPY.points.map(([icon, text]) => (
                                <li key={text}><span><i className={icon} /></span>{text}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="dl-demo" aria-hidden="true">
                        <div className="dl-demo-head">
                            <div>
                                <div className="dl-demo-ref">CB-24117 · 2 × 40HC</div>
                                <div className="dl-demo-sub">Shanghai → Vancouver</div>
                            </div>
                            <span className="dl-demo-badge"><i className="fa-solid fa-circle-check" /> Released</span>
                        </div>
                        <ol className="dl-demo-steps">
                            {DEMO_STEPS.map(([label, state]) => (
                                <li key={label} className={state}><i />{label}</li>
                            ))}
                        </ol>
                    </div>

                    <div className="dl-hero-foot">© {year} DeepClear Inc · Think Deep, Solve Clear</div>
                </div>
            </aside>

            <main className="dl-main">
                <div className="dl-card">
                    <img src={logo} alt="DeepClear" className="dl-logo" />
                    <div className="dl-title">
                        <h2>Welcome back</h2>
                        <p>Sign in to the DeepClear {COPY.portal.toLowerCase()}.</p>
                    </div>

                    {serverError && (
                        <div className="dl-alert" role="alert">
                            <i className="fa-solid fa-circle-exclamation" />
                            <span>{serverError}</span>
                        </div>
                    )}

                    <form onSubmit={onSubmit} noValidate>
                        <div className={`dl-field ${errors.username ? 'invalid' : ''}`}>
                            <label htmlFor="dl-username">{COPY.userLabel}</label>
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
                                    placeholder="e.g. contoso"
                                    aria-invalid={Boolean(errors.username)}
                                    aria-describedby={errors.username ? 'dl-username-err' : undefined}
                                />
                            </div>
                            {errors.username && <span className="dl-err" id="dl-username-err">{errors.username}</span>}
                        </div>

                        <div className={`dl-field ${errors.password ? 'invalid' : ''}`}>
                            <label htmlFor="dl-password">Password</label>
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
                                    placeholder="Your password"
                                    aria-invalid={Boolean(errors.password)}
                                    aria-describedby={errors.password ? 'dl-password-err' : undefined}
                                />
                                <button type="button" className="dl-eye" onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                                    <i className={showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'} />
                                </button>
                            </div>
                            {errors.password && <span className="dl-err" id="dl-password-err">{errors.password}</span>}
                            {!errors.password && capsLock && <span className="dl-warn"><i className="fa-solid fa-arrow-up" /> Caps Lock is on</span>}
                        </div>

                        <button type="submit" className="dl-submit" disabled={showLoading}>
                            {showLoading ? <span className="dl-spinner" aria-hidden="true" /> : null}
                            {showLoading ? 'Signing in…' : 'Sign in'}
                            {!showLoading && <i className="fa-solid fa-arrow-right" />}
                        </button>
                    </form>

                    <p className="dl-help">{COPY.help}</p>

                    {!IS_ADMIN && (
                        <Link to="/cbsa-checking" className="dl-secondary">
                            <span className="dl-secondary-icon"><i className="fa-solid fa-magnifying-glass" /></span>
                            <span>
                                <b>Check a CBSA status</b>
                                <small>Look up a transaction or cargo control number without signing in.</small>
                            </span>
                            <i className="fa-solid fa-chevron-right" />
                        </Link>
                    )}

                    <div className="dl-secure"><i className="fa-solid fa-lock" /> Encrypted connection. Never share your password.</div>
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
