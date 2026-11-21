import { SESSION_STORAGE_KEY } from '../config/env';

/**
 * The logged-in user, as saved by the login action:
 * { email, localId, department, idToken, expiresIn }
 */
export function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY));
    } catch (e) {
        return null;
    }
}

export function saveSession(session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getToken() {
    const session = getSession();
    return session && session.idToken ? session.idToken : null;
}

/** Seconds-since-epoch expiry inside a JWT, or null if it cannot be read. */
function tokenExpiry(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp === 'number' ? payload.exp : null;
    } catch (e) {
        return null;
    }
}

/** The stored session if it has a token that has not expired yet, otherwise null. */
export function getValidSession() {
    const session = getSession();
    if (!session || !session.idToken) return null;
    const exp = tokenExpiry(session.idToken);
    return exp && exp * 1000 < Date.now() ? null : session;
}

/** Id of the logged-in admin/client (the API also takes it from the token). */
export function getUserId() {
    const session = getSession();
    return session ? session.localId : null;
}
