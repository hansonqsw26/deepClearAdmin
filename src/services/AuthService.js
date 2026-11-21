import { clearSession, getValidSession } from '../api/session';
import { LOGIN_CONFIRMED_ACTION, LOGOUT_ACTION } from '../store/actions/AuthActions';

/** Restore the login saved in localStorage when the page loads. */
export const checkAutoLogin = (dispatch, navigate) => {
    const session = getValidSession();
    if (!session) {
        clearSession();
        dispatch({ type: LOGOUT_ACTION });
        return false;
    }

    dispatch({ type: LOGIN_CONFIRMED_ACTION, payload: session });
    if (window.location.pathname === '/login') navigate('/dashboard');
    return true;
};
