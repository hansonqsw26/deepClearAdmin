/**
 * Pages shown after login, all rendered inside the main layout (sidebar + header).
 * To add a page: create it under src/features/<area>/, add a lazy import and a
 * route below, then add a menu entry in layouts/nav/Menu.js.
 */
import React, { lazy, Suspense, useContext } from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

import "./index.css";
import "./chart.css";
import "./step.css";

import Nav from "./layouts/nav";
import Footer from "./layouts/Footer";
import ScrollToTop from "./pages/ScrollToTop";
import { ThemeContext } from "../context/ThemeContext";

import Dashboard from "../features/dashboard/Dashboard";
import Error400 from "./pages/Error400";
import Error403 from "./pages/Error403";
import Error404 from "./pages/Error404";
import Error500 from "./pages/Error500";
import Error503 from "./pages/Error503";

// Feature pages are loaded on demand to keep the first download small.
const QuoteList = lazy(() => import("../features/quotes/QuoteList/QuoteList"));
const CreateQuote = lazy(() => import("../features/quotes/CreateQuote/CreateQuote"));
const CreateAdminUser = lazy(() => import("../features/accounts/CreateAdminUser"));
const CreateClientUser = lazy(() => import("../features/accounts/CreateClientUser"));
const CreateTruckTicket = lazy(() => import("../features/truckTickets/CreateTruckTicket"));
const TicketsList = lazy(() => import("../features/truckTickets/TicketsList"));
const TicketDetails = lazy(() => import("../features/truckTickets/TicketDetails"));
const CreateCustomsTicket = lazy(() => import("../features/customsTickets/CreateCustomsTicket"));
const CustomsTicketsList = lazy(() => import("../features/customsTickets/CustomsTicketsList"));
const CustomsTicketDetails = lazy(() => import("../features/customsTickets/CustomsTicketDetails"));

export const appRoutes = [
  { url: "", component: <Dashboard /> },
  { url: "dashboard", component: <Dashboard /> },

  // Quotes
  { url: "quote-list", component: <QuoteList /> },
  { url: "create-quote", component: <CreateQuote /> },

  // Accounts
  { url: "create-admin-account", component: <CreateAdminUser /> },
  { url: "create-client-account", component: <CreateClientUser /> },

  // Truck tickets
  { url: "create-truck-ticket", component: <CreateTruckTicket /> },
  { url: "tickets-list", component: <TicketsList /> },
  { url: "ticket-details", component: <TicketDetails /> },

  // Customs brokerage tickets
  { url: "create-customs-ticket", component: <CreateCustomsTicket /> },
  { url: "customs-tickets-list", component: <CustomsTicketsList /> },
  { url: "customs-ticket-details", component: <CustomsTicketDetails /> },
];

const PageLoader = () => (
  <div className="text-center p-5">
    <div className="spinner-border text-primary" role="status" />
  </div>
);

const Markup = () => (
  <>
    <Routes>
      <Route path="/page-error-400" element={<Error400 />} />
      <Route path="/page-error-403" element={<Error403 />} />
      <Route path="/page-error-404" element={<Error404 />} />
      <Route path="/page-error-500" element={<Error500 />} />
      <Route path="/page-error-503" element={<Error503 />} />
      <Route element={<MainLayout />}>
        {appRoutes.map((route) => (
          <Route key={route.url || "home"} path={route.url} element={route.component} />
        ))}
        <Route path="login" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Error404 />} />
      </Route>
    </Routes>
    <ScrollToTop />
  </>
);

function MainLayout() {
  const { sidebariconHover } = useContext(ThemeContext);
  const sideMenu = useSelector((state) => state.sideMenu);
  return (
    <div id="main-wrapper" className={`show ${sidebariconHover ? "iconhover-toggle" : ""} ${sideMenu ? "menu-toggle" : ""}`}>
      <Nav />
      <div className="content-body" style={{ minHeight: window.screen.height - 60 }}>
        <div className="container-fluid">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Markup;
