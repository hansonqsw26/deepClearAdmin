import { applyMiddleware, combineReducers, compose, createStore } from 'redux';
import thunk from 'redux-thunk';
import { AuthReducer, initialAuthState } from './reducers/AuthReducer';
import { sideMenu } from './reducers/uiReducer';
import { getValidSession } from '../api/session';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const reducers = combineReducers({
    sideMenu,
    auth: AuthReducer,
});

// Start already logged in when a valid token is stored, so a page refresh keeps the current URL.
const session = getValidSession();
const preloadedState = session ? { auth: { ...initialAuthState, auth: session } } : undefined;

export const store = createStore(reducers, preloadedState, composeEnhancers(applyMiddleware(thunk)));
