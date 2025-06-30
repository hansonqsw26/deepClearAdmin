import React, { useState } from 'react'
import { connect, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom'
import { loadingToggleAction,loginAction,
} from '../../store/actions/AuthActions';

// image
import logo from "../../images/logo-full-white.png";
import loginbg from "../../images/bg-login.jpg";

function Login (props) {
  const [email, setEmail] = useState('');
    let errorsObj = { email: '', password: '' };
    const [errors, setErrors] = useState(errorsObj);
    const [password, setPassword] = useState('');

    const dispatch = useDispatch();
    const nav  = useNavigate();
    const currentYear = new Date().getFullYear();
    function onLogin(e) {
        e.preventDefault();
        let error = false;
        const errorObj = { ...errorsObj };
        if (email === '') {
            errorObj.email = 'Email is Required';
            error = true;
        }
        if (password === '') {
            errorObj.password = 'Password is Required';
            error = true;
        }
        setErrors(errorObj);
        if (error) {
			return ;
		}
		dispatch(loadingToggleAction(true));
        dispatch(loginAction(email, password, nav));
    }

  return (
		<div className="login-main-page" style={{backgroundImage:"url("+ loginbg +")"}}>
            <div className="login-wrapper">
                <div className="login-aside-left" >
                    <Link to="/login" className="login-logo">
                        <img src={logo} alt="" />
                      </Link>
                    <div className="login-description">
                        <h2 className="main-title mb-2">Welcome To Deep Clear!</h2>
                        <h3 className="main-title mb-2">Admin Portal</h3>
                        <p className="">Think Deep, Solve Clear</p>
                        <ul className="social-icons mt-4">
                            <li><Link to={"/login"} target='_blank'><i className="fab fa-facebook-f"></i></Link></li>
                            <li><Link to={"/login"} target='_blank'><i className="fab fa-twitter"></i></Link></li>
                            <li><Link to={"/login   "} target='_blank'><i className="fab fa-linkedin-in"></i></Link>
                            </li>
                        </ul>
                        <div className="mt-5 bottom-privacy">
                            <Link to={"#"} className="mr-4">Privacy Policy</Link>
                            <Link to={"#"} className="mr-4">Contact</Link>
                            <Link to={"#"} className="text-gray-400 text-sm mx-3 my-1">
                                © {currentYear} Deep Clear Inc
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="login-aside-right">
                <div className="row m-0 justify-content-center h-100 align-items-center">
                      <div className="p-5">
                        <div className="authincation-content">
                          <div className="row no-gutters">
                            <div className="col-xl-12">
                              <div className="auth-form-1">
                                <div className="mb-4">
                                    <h3 className="dz-title mb-1">Sign in</h3>
                                    <p className="">Sign in by entering information below</p>
                                </div>
                                  {props.errorMessage && (
                                      <div className="alert alert-danger text-center" role="alert">
                                          {typeof props.errorMessage === 'string'
                                              ? props.errorMessage
                                              : props.errorMessage.message}
                                      </div>
                                  )}
                                  {props.successMessage && (
                                      <div className='bg-green-300 text-green-900 border border-green-900 p-1 my-2'>
                                          {typeof props.successMessage === 'string'
                                              ? props.successMessage
                                              : props.successMessage.message}
                                      </div>
                                  )}

                                  <form onSubmit={onLogin}>
                                    <div className="form-group">
                                        <label className="mb-2 ">
                                          <strong>Client Name</strong>
                                        </label>
                                        <input type="text" className="form-control"
                                          value={email}
                                           onChange={(e) => setEmail(e.target.value)}
                                               placeholder="Type Your Client Name"
                                        />
                                      {errors.email && <div className="text-danger fs-12">{errors.email}</div>}
                                    </div>
                                    <div className="form-group">
                                        <label className="mb-2 "><strong>Password</strong></label>
                                        <input
                                          type="password"
                                          className="form-control"
                                          value={password}
										                       placeholder="Type Your Password"
                                            onChange={(e) =>
                                                setPassword(e.target.value)
                                            }
                                        />
                                        {errors.password && <div className="text-danger fs-12">{errors.password}</div>}
                                    </div>
                                  <div className="form-row d-flex justify-content-between mt-4 mb-2">
                                    <div className="form-group">
                                      <div className="form-check custom-checkbox ml-1 ">
                                        <input
                                          type="checkbox"
                                          className="form-check-input"
                                          id="basic_checkbox_1"
                                        />
                                        <label
                                          className="form-check-label"
                                          htmlFor="basic_checkbox_1"
                                        >
                                          Remember my preference
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <button
                                      type="submit"
                                      className="btn btn-primary btn-block"
                                    >
                                      Sign In
                                    </button>
                                  </div>
                                </form>
                                {/*<div className="new-account mt-2">*/}
                                {/*  <p className="">*/}
                                {/*    Don't have an account?{" "}*/}
                                {/*    <Link className="text-primary" to="/page-register">*/}
                                {/*      Sign up*/}
                                {/*    </Link>*/}
                                {/*  </p>*/}
                                {/*</div>*/}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
            </div>
        </div>
  );
};

const mapStateToProps = (state) => {
    return {
        errorMessage: state.auth.errorMessage,
        successMessage: state.auth.successMessage,
        showLoading: state.auth.showLoading,
    };
};
export default connect(mapStateToProps)(Login);
