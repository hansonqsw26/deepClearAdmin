import {
    LOADING_TOGGLE_ACTION,
    LOGIN_CONFIRMED_ACTION,
    LOGIN_FAILED_ACTION,
    LOGOUT_ACTION,
} from '../actions/AuthActions';

const emptyAuth = { email: '', idToken: '', localId: '', expiresIn: '', department: '' };

export const initialAuthState = {
    auth: emptyAuth,
    errorMessage: '',
    successMessage: '',
    showLoading: false,
};

export function AuthReducer(state = initialAuthState, action) {
    switch (action.type) {
        case LOGIN_CONFIRMED_ACTION:
            return { ...state, auth: action.payload, errorMessage: '', successMessage: 'Login Successfully Completed', showLoading: false };
        case LOGOUT_ACTION:
            return { ...state, auth: emptyAuth, errorMessage: '', successMessage: '' };
        case LOGIN_FAILED_ACTION:
            return { ...state, errorMessage: action.payload, successMessage: '', showLoading: false };
        case LOADING_TOGGLE_ACTION:
            return { ...state, showLoading: action.payload };
        default:
            return state;
    }
}
