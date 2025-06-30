export const isAuthenticated = (state) => {
    return !!(state.auth && state.auth.auth && state.auth.auth.idToken);
};