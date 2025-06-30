    import { lazy, Suspense, useEffect } from 'react';
    /// Components
    // import CreateQuote from './jsx/index'; // We will use lazy loading for CreateQuote as well
    import { connect, useDispatch } from 'react-redux';
    import {  Route, Routes, useLocation , useNavigate , useParams } from 'react-router-dom';
    // action
    import { checkAutoLogin } from './services/AuthService';
    import { isAuthenticated } from './store/selectors/AuthSelectors';
    /// Style

    import './vendor/swiper/css/swiper-bundle.min.css';
    import "./vendor/bootstrap-select/dist/css/bootstrap-select.min.css";
    import "./css/style.css";
    import {LOGIN_CONFIRMED_ACTION} from "./store/actions/AuthActions";


    const SignUp = lazy(() => import('./jsx/pages/Registration'));
    const Login = lazy(() => {
        return new Promise(resolve => {
            setTimeout(() => resolve(import('./jsx/pages/Login')), 500);
        });
    });

    // Lazy load the CreateQuote component (Markup)
    const Index = lazy(() => import('./jsx/index')); // Ensure this path is correct to your Markup component

    function withRouter(Component) {
        function ComponentWithRouterProp(props) {
            let location = useLocation();
            let navigate = useNavigate();
            let params = useParams();

            return (
                <Component
                    {...props}
                    router={{ location, navigate, params }}
                />
            );
        }

        return ComponentWithRouterProp;
    }

    function App (props) {
        const dispatch = useDispatch();
        const navigate = useNavigate();
        useEffect(() => {
            checkAutoLogin(dispatch, navigate);
        }, [dispatch, navigate]);

        // Handle redirecting to login page if user is authenticated
        useEffect(() => {
            const userData = JSON.parse(localStorage.getItem('adminUser'));
            if (!userData) {
                // If no user data is found in localStorage, treat it as logged out
                navigate('/login');
            } else {
                // If user data exists, treat as logged in
                dispatch({
                    type: LOGIN_CONFIRMED_ACTION,
                    payload: userData,
                });
            }
        }, [dispatch, navigate]);

        return (
            <div className="vh-100">
                <Suspense fallback={
                    <div id="preloader">
                        <div className="sk-three-bounce">
                            <div className="sk-child sk-bounce1"></div>
                            <div className="sk-child sk-bounce2"></div>
                            <div className="sk-child sk-bounce3"></div>
                        </div>
                    </div>
                }>
                    <Routes>
                        {/* Public Routes (Accessible only if not authenticated) */}
                        {!props.isAuthenticated && (
                            <>
                                <Route path='/' element={<Login />} />
                                <Route path='/login' element={<Login />} />
                                <Route path='/page-register' element={<SignUp />} />
                            </>
                        )}
                        {/* Authenticated Routes */}
                        {props.isAuthenticated && (
                            <Route path='/*' element={<Index />} />
                        )}
                    </Routes>
                </Suspense>
            </div>
        );
    };

    const mapStateToProps = (state) => {
        return {
            isAuthenticated: isAuthenticated(state),
        };
    };

    export default withRouter(connect(mapStateToProps)(App));