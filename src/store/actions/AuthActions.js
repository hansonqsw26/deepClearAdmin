import {
    formatError,
    login,
    runLogoutTimer,
    saveTokenInLocalStorage,
    signUp,
} from '../../services/AuthService';
import axios from "axios";


export const SIGNUP_CONFIRMED_ACTION = '[signup action] confirmed signup';
export const SIGNUP_FAILED_ACTION = '[signup action] failed signup';
export const LOGIN_CONFIRMED_ACTION = '[login action] confirmed login';
export const LOGIN_FAILED_ACTION = '[login action] failed login';
export const LOADING_TOGGLE_ACTION = '[Loading action] toggle loading';
export const LOGOUT_ACTION = '[Logout action] logout action';
export const NAVTOGGLE = 'NAVTOGGLE';



export function signupAction(email, password, navigate) {
	
    return (dispatch) => {
        signUp(email, password)
        .then((response) => {
            saveTokenInLocalStorage(response.data);
            runLogoutTimer(
                dispatch,
                response.data.expiresIn * 1000,            
            );
            dispatch(confirmedSignupAction(response.data));
            navigate('/dashboard');			
        })
        .catch((error) => {
            const errorMessage = formatError(error.response.data);
            dispatch(signupFailedAction(errorMessage));
        });
    };
}

export function Logout(navigate) {
    return (dispatch) => {
        localStorage.removeItem('adminUser');
        dispatch({ type: LOGOUT_ACTION });  // Reset the authentication state in Redux
        navigate('/login');  // Navigate to login page
    };
}

export function loginAction(admin_name, admin_password, navigate) {
    return (dispatch) => {
        axios.post('https://deepclear.ca/api/admin/login', {
            admin_name,
            admin_password
        })
            .then((res) => {
                const response = res.data;

                const userData = {
                    email: response.adminName,
                    localId: response.adminId,
                    department: response.department,
                    idToken: response.token, // <-- Normalize here
                    expiresIn: 3600,          // Optional: add expiry time if needed
                };
                {console.log(response)}

                localStorage.setItem('adminUser', JSON.stringify(userData));

                dispatch({
                    type: LOGIN_CONFIRMED_ACTION,
                    payload: userData
                });

                navigate('/dashboard');
            })
            .catch((err) => {
                const msg = err.response?.data || 'Login failed';
                dispatch({
                    type: LOGIN_FAILED_ACTION,
                    payload: msg
                });
            });
    };
}


export function loginFailedAction(data) {
    return {
        type: LOGIN_FAILED_ACTION,
        payload: data,
    };
}

export function loginConfirmedAction(data) {
    return {
        type: LOGIN_CONFIRMED_ACTION,
        payload: data,
    };
}

export function confirmedSignupAction(payload) {
    return {
        type: SIGNUP_CONFIRMED_ACTION,
        payload,
    };
}

export function signupFailedAction(message) {
    return {
        type: SIGNUP_FAILED_ACTION,
        payload: message,
    };
}

export function loadingToggleAction(status) {
    return {
        type: LOADING_TOGGLE_ACTION,
        payload: status
    };
}

export const navtoggle = () => {
    return {        
      type: 'NAVTOGGLE',
    };
};