import axios from 'axios';
import swal from "sweetalert";
import {
    LOGIN_CONFIRMED_ACTION,
    Logout, LOGOUT_ACTION,
} from '../store/actions/AuthActions';

export function signUp(email, password) {
    //axios call
    const postData = {
        email,
        password,
        returnSecureToken: true,
    };
    return axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyD3RPAp3nuETDn9OQimqn_YF6zdzqWITII`,
        postData,
    );
}

export function login(email, password) {
    const postData = {
        email,
        password,
        returnSecureToken: true,
    };
    return axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyD3RPAp3nuETDn9OQimqn_YF6zdzqWITII`,
        postData,
    );
}

export function formatError(errorResponse) {
    switch (errorResponse.error.message) {
        case 'EMAIL_EXISTS':
            //return 'Email already exists';
            swal("Oops", "Email already exists", "error");
            break;
        case 'EMAIL_NOT_FOUND':
            //return 'Email not found';
           swal("Oops", "Email not found", "error",{ button: "Try Again!",});
           break;
        case 'INVALID_PASSWORD':
            //return 'Invalid Password';
            swal("Oops", "Invalid Password", "error",{ button: "Try Again!",});
            break;
        case 'USER_DISABLED':
            return 'User Disabled';

        default:
            return '';
    }
}

export function saveTokenInLocalStorage(tokenDetails) {
    tokenDetails.expireDate = new Date(
        new Date().getTime() + tokenDetails.expiresIn * 1000,
    );
    localStorage.setItem('userDetails', JSON.stringify(tokenDetails));
}

export function runLogoutTimer(dispatch, timer, navigate) {
    setTimeout(() => {
        //dispatch(Logout(history));
        dispatch(Logout(navigate));
    }, timer);
}

export const checkAutoLogin = (dispatch, navigate) => {
    const userData = JSON.parse(localStorage.getItem('adminUser'));

    if (!userData || !userData.idToken) {
        dispatch({ type: LOGOUT_ACTION });
        return;
    }

    dispatch({
        type: LOGIN_CONFIRMED_ACTION,
        payload: userData,
    });

    // Optional: Navigate to dashboard if the user is already logged in and on the login page
    if (window.location.pathname === '/login') {
        navigate('/dashboard');
    }
};