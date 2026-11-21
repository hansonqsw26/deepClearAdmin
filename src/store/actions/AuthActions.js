import { api } from '../../api/http';
import { clearSession, saveSession } from '../../api/session';

export const LOGIN_CONFIRMED_ACTION = '[login action] confirmed login';
export const LOGIN_FAILED_ACTION = '[login action] failed login';
export const LOADING_TOGGLE_ACTION = '[Loading action] toggle loading';
export const LOGOUT_ACTION = '[Logout action] logout action';
export const NAVTOGGLE = 'NAVTOGGLE';

export function Logout(navigate) {
    return (dispatch) => {
        clearSession();
        dispatch({ type: LOGOUT_ACTION });
        navigate('/login');
    };
}

/** POST /api/admin/login, then keep the returned token for every later API call. */
export function loginAction(admin_name, admin_password, navigate) {
    return (dispatch) => {
        api.post('/admin/login', { admin_name, admin_password })
            .then(({ data }) => {
                const session = {
                    email: data.adminName,
                    localId: data.adminId,
                    department: data.department,
                    idToken: data.token,
                    expiresIn: 3600,
                };
                saveSession(session);
                dispatch(loginConfirmedAction(session));
                navigate('/dashboard');
            })
            .catch((err) => {
                const body = err.response && err.response.data;
                const message = (body && (body.message || body.error)) || body || 'Login failed';
                dispatch(loginFailedAction(message));
            });
    };
}

export function loginFailedAction(data) {
    return { type: LOGIN_FAILED_ACTION, payload: data };
}

export function loginConfirmedAction(data) {
    return { type: LOGIN_CONFIRMED_ACTION, payload: data };
}

export function loadingToggleAction(status) {
    return { type: LOADING_TOGGLE_ACTION, payload: status };
}

export const navtoggle = () => ({ type: NAVTOGGLE });
