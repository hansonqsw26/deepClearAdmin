import React, { useReducer, useContext, useEffect, useState } from "react";
/// Scroll
import PerfectScrollbar from "react-perfect-scrollbar";
/// Link
import { Link } from "react-router-dom";
import { Collapse, Dropdown } from "react-bootstrap";
import { useScrollPosition } from "@n8tb1t/use-scroll-position";
import { MenuList as originalMenuList } from "./Menu";
import { ThemeContext } from "../../../context/ThemeContext";
import LogoutPage from "./Logout";
/// Image
import profile from "../../../images/profile/pic1.jpg";

const reducer = (previousState, updatedState) => ({
  ...previousState,
  ...updatedState,
});

const initialState = {
  active: "",
  activeSubmenu: "",
};

const SideBar = () => {
  const {
    iconHover,
    sidebarposition,
    headerposition,
    sidebarLayout,
    ChangeIconSidebar,
  } = useContext(ThemeContext);

  const [state, setState] = useReducer(reducer, initialState);

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    profilePic: profile, // Default profile picture
    department: null,
  });

  // Filtered menu based on adminUser.department
  const [menuList, setMenuList] = useState(originalMenuList);

  useEffect(() => {
    // Load user data from localStorage
    let storedUserData = null;
    try {
      storedUserData = JSON.parse(localStorage.getItem("adminUser"));
    } catch {
      storedUserData = null;
    }

    if (storedUserData) {
      setUserData({
        name: storedUserData.email || "William",
        email: storedUserData.email || "william@gmail.com",
        profilePic: storedUserData.profilePic || profile,
        department: storedUserData.department || null,
      });

      if (storedUserData.department === 2) {
        // Filter menu for department 2:
        // 1) Remove "Quote" section
        // 2) Remove "Create Account" section
        // 3) Inside "Ticket" section, remove "Create Truck Ticket"
        const filteredMenu = originalMenuList
            .filter(
                (menu) =>
                    menu.title !== "Quote" && menu.title !== "Create Account"
            )
            .map((menu) => {
              if (menu.title === "Ticket") {
                // Filter "Create Truck Ticket" from Ticket content
                const filteredContent = menu.content.filter(
                    (item) => item.title !== "Create Truck Ticket"
                );
                return { ...menu, content: filteredContent };
              }
              return menu;
            });

        setMenuList(filteredMenu);
      } else {
        setMenuList(originalMenuList);
      }
    } else {
      // If no user data, just use original menu list
      setMenuList(originalMenuList);
    }

    var btn = document.querySelector(".nav-control");
    var aaa = document.querySelector("#main-wrapper");
    function toggleFunc() {
      return aaa.classList.toggle("menu-toggle");
    }
    if (btn) btn.addEventListener("click", toggleFunc);

    return () => {
      if (btn) btn.removeEventListener("click", toggleFunc);
    };
  }, []);

  let handleheartBlast = document.querySelector(".heart");
  function heartBlast() {
    return handleheartBlast.classList.toggle("heart-blast");
  }
  const [hideOnScroll, setHideOnScroll] = useState(true);
  useScrollPosition(
      ({ prevPos, currPos }) => {
        const isShow = currPos.y > prevPos.y;
        if (isShow !== hideOnScroll) setHideOnScroll(isShow);
      },
      [hideOnScroll]
  );

  const handleMenuActive = (status) => {
    setState({ active: status });
    if (state.active === status) {
      setState({ active: "" });
    }
  };
  const handleSubmenuActive = (status) => {
    setState({ activeSubmenu: status });
    if (state.activeSubmenu === status) {
      setState({ activeSubmenu: "" });
    }
  };

  /// Path
  let path = window.location.pathname;
  path = path.split("/");
  path = path[path.length - 1];
  /// Active menu

  return (
      <div
          onMouseEnter={() => ChangeIconSidebar(true)}
          onMouseLeave={() => ChangeIconSidebar(false)}
          className={`dlabnav ${iconHover} ${
              sidebarposition.value === "fixed" &&
              sidebarLayout.value === "horizontal" &&
              headerposition.value === "static"
                  ? hideOnScroll > 120
                      ? "fixed"
                      : ""
                  : ""
          }`}
      >
        <PerfectScrollbar className="dlabnav-scroll">
          <ul className="metismenu" id="menu">
            <Dropdown as="li" className="nav-item dropdown header-profile">
              <Dropdown.Toggle
                  variant=""
                  as="a"
                  className="nav-link i-false c-pointer"
                  role="button"
                  data-toggle="dropdown"
              >
                <img src={userData.profilePic} width={20} alt="profile" />
                <div className="header-info ms-3">
                <span className="font-w600 ">
                  Hi,<b>{userData.name}</b>
                </span>
                </div>
              </Dropdown.Toggle>

              <Dropdown.Menu
                  align="right"
                  className="mt-2 dropdown-menu dropdown-menu-end"
              >
                <LogoutPage />
              </Dropdown.Menu>
            </Dropdown>
            {menuList.map((data, index) => {
              let menuClass = data.classsChange;
              if (menuClass === "menu-title") {
                return (
                    <li className={menuClass} key={index}>
                      {data.title}
                    </li>
                );
              } else {
                return (
                    <li
                        className={` ${state.active === data.title ? "mm-active" : ""}`}
                        key={index}
                    >
                      {data.content && data.content.length > 0 ? (
                          <>
                            <Link
                                to={"#"}
                                className="has-arrow"
                                onClick={() => {
                                  handleMenuActive(data.title);
                                }}
                            >
                              {data.iconStyle}
                              <span className="nav-text">{data.title}</span>
                              <span className="badge badge-xs style-1 badge-danger ms-2">
                          {data.update}
                        </span>
                            </Link>
                            <Collapse in={state.active === data.title ? true : false}>
                              <ul
                                  className={`${
                                      menuClass === "mm-collapse" ? "mm-show" : ""
                                  }`}
                              >
                                {data.content.map((subItem, index) => {
                                  return (
                                      <li
                                          key={index}
                                          className={`${
                                              state.activeSubmenu === subItem.title ? "mm-active" : ""
                                          }`}
                                      >
                                        {subItem.content && subItem.content.length > 0 ? (
                                            <>
                                              <Link
                                                  to={subItem.to}
                                                  className={subItem.hasMenu ? "has-arrow" : ""}
                                                  onClick={() => {
                                                    handleSubmenuActive(subItem.title);
                                                  }}
                                              >
                                                {subItem.title}
                                              </Link>
                                              <Collapse
                                                  in={state.activeSubmenu === subItem.title ? true : false}
                                              >
                                                <ul
                                                    className={`${
                                                        menuClass === "mm-collapse" ? "mm-show" : ""
                                                    }`}
                                                >
                                                  {subItem.content.map((childItem, idx) => (
                                                      <li key={idx}>
                                                        <Link
                                                            className={`${
                                                                path === childItem.to ? "mm-active" : ""
                                                            }`}
                                                            to={childItem.to}
                                                        >
                                                          {childItem.title}
                                                        </Link>
                                                      </li>
                                                  ))}
                                                </ul>
                                              </Collapse>
                                            </>
                                        ) : (
                                            <Link to={subItem.to}>{subItem.title}</Link>
                                        )}
                                      </li>
                                  );
                                })}
                              </ul>
                            </Collapse>
                          </>
                      ) : (
                          <Link to={data.to}>
                            {data.iconStyle}
                            <span className="nav-text">{data.title}</span>
                          </Link>
                      )}
                    </li>
                );
              }
            })}
          </ul>
          <div className="copyright">
            <p>
              <strong>DeepClear Inc</strong> © 2025 All Rights Reserved
            </p>
            <p className="fs-12">
              Made with <span className="heart" onClick={heartBlast}></span> by Deep Clear
            </p>
          </div>
        </PerfectScrollbar>
      </div>
  );
};

export default SideBar;
