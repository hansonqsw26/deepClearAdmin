/**
 * Top-level routing: the login page when logged out, the app (jsx/index.js) when logged in.
 */
import { lazy, Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { checkAutoLogin } from './services/AuthService';
import { isAuthenticated } from './store/selectors/AuthSelectors';

import './vendor/swiper/css/swiper-bundle.min.css';
import './vendor/bootstrap-select/dist/css/bootstrap-select.min.css';
import './css/style.css';

const Login = lazy(() => import('./features/auth/Login'));
const Index = lazy(() => import('./jsx/index'));

const Preloader = () => (
    <div id="preloader">
        <div className="sk-three-bounce">
            <div className="sk-child sk-bounce1" />
            <div className="sk-child sk-bounce2" />
            <div className="sk-child sk-bounce3" />
        </div>
    </div>
);

function App() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const loggedIn = useSelector(isAuthenticated);

    useEffect(() => {
        checkAutoLogin(dispatch, navigate);
    }, [dispatch, navigate]);

    return (
        <div className="vh-100">
            <Suspense fallback={<Preloader />}>
                <Routes>
                    {loggedIn ? (
                        <Route path="/*" element={<Index />} />
                    ) : (
                        <>
                            <Route path="/login" element={<Login />} />
                            <Route path="*" element={<Navigate to="/login" replace />} />
                        </>
                    )}
                </Routes>
            </Suspense>
        </div>
    );
}

export default App;
