/**
 * Every call to the DeepClear API goes through this file.
 *
 *  - apiFetch(path, init)  drop-in replacement for fetch(): same Response object,
 *                          but prefixes API_BASE_URL and adds the login token.
 *  - api                   axios instance with the same behaviour.
 *
 * When the API answers 401 (token missing, expired or invalid) the session is
 * cleared and the user is sent back to the login page.
 */
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { clearSession, getToken } from './session';

export function apiUrl(path) {
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function handleUnauthorized() {
    clearSession();
    if (!['/', '/login'].includes(window.location.pathname)) {
        window.location.assign('/login');
    }
}

export async function apiFetch(path, init = {}) {
    const headers = new Headers(init.headers || {});
    const token = getToken();
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(apiUrl(path), { ...init, headers });
    if (response.status === 401 && token) handleUnauthorized();
    return response;
}

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        // eslint-disable-next-line no-param-reassign
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401 && getToken()) handleUnauthorized();
        return Promise.reject(error);
    },
);
