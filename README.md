# DeepClear Admin Portal

React single-page app used by DeepClear staff. It talks only to the DeepClear API
(`price` repo, live at `https://deepclear.ca/api`).

Stack: **React 18 · React Router 6 · Redux (auth + sidebar state) · Bootstrap template "Dompet" · Create React App 5**.

## Quick start

```bash
npm install
cp .env.example .env.local     # optional: point at a local API
npm start                      # http://localhost:3000
npm run build                  # production files in build/
```

By default the app calls the live API. To develop against a backend on your
machine, put `REACT_APP_API_BASE_URL=http://localhost:3000/api` in `.env.local`
and run the API on another port (e.g. `PORT=4000` there, and use that port here).
Restart `npm start` after changing env files.

## Project structure

```
src/
├── index.js                 # mounts <App/> with Redux store, router, theme
├── App.js                   # login page when logged out, the app when logged in
├── config/env.js            # API_BASE_URL (from REACT_APP_API_BASE_URL) + session storage key
├── api/
│   ├── http.js              # apiFetch() and axios `api`: base URL + "Authorization: Bearer <token>"
│   └── session.js           # read / save / clear the logged-in user in localStorage
│   ├── features/            # one folder per business area (start here)
│   │   ├── dashboard/       # landing page: quote summary cards
│   │   ├── quotes/          # QuoteList, CreateQuote, quotes.api.js
│   │   ├── accounts/        # create admin / client logins
│   │   ├── truckTickets/    # CreateTruckTicket, TicketsList, TicketDetails
│   │   └── customsTickets/  # CreateCustomsTicket, CustomsTicketsList, CustomsTicketDetails
├── jsx/
│   ├── index.js             # list of pages (routes) inside the main layout
│   ├── layouts/             # sidebar (nav/Menu.js = menu entries), header, footer
│   └── pages/               # Login and error pages
├── store/                   # Redux: AuthActions (login/logout), AuthReducer, sidebar toggle
├── services/AuthService.js  # restores the login on page load, drops expired tokens
├── css/style.css            # compiled theme stylesheet actually used by the app
├── scss/                    # theme sources (see "Styles" below)
└── icons/, images/, vendor/ # fonts, images and third-party CSS used by the theme
```

## Pages

| URL | What it does |
| --- | --- |
| `/dashboard` | quote counts |
| `/quote-list` | all quotes; set price and admin note |
| `/create-quote` | create a quote for a chosen client |
| `/create-admin-account`, `/create-client-account` | new logins |
| `/create-truck-ticket`, `/tickets-list`, `/ticket-details` | truck tickets |
| `/create-customs-ticket`, `/customs-tickets-list`, `/customs-ticket-details` | customs brokerage tickets |

## How API calls work

Always call the API through `src/api/http.js`, never with a full URL:

```js
import { apiFetch } from '../../api/http';

const res = await apiFetch('/admin/fetchCbTicket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 0 }),
});
```

`apiFetch` adds the base URL and the login token. If the API answers **401**
(token missing or expired) the user is logged out and sent to `/login`.
Admin endpoints reject client tokens (403).

Login: `POST /api/admin/login` returns a JWT that is saved in localStorage under
`adminUser` (`idToken` field). It is valid for 7 days.

## Adding a page

1. Create the component in `src/features/<area>/`.
2. Add a lazy import and a route in `src/jsx/index.js`.
3. Add a menu entry in `src/jsx/layouts/nav/Menu.js`.
4. Put its API calls in a small `<area>.api.js` next to it, using `apiFetch`.

## Styles

`src/css/style.css` is the compiled theme and is what the app loads. The SCSS
sources in `src/scss` come from the template; `npm run sass:build` regenerates
style.css with Dart Sass, but the template has one line that Dart Sass rejects
(`calc(45vw + 3)` in `scss/layout/sidebar/_mega-menu.scss`) — fix it before regenerating.

## Deploying

```bash
npm ci
npm run build          # REACT_APP_API_BASE_URL defaults to https://deepclear.ca/api
```

Upload the contents of `build/` to the web server that hosts this site (for
example Nginx on the EC2 instance). Configure the server to send unknown paths to `index.html` so
deep links like `/tickets-list` work after a refresh:

```nginx
location / {
    try_files $uri /index.html;
}
```

`build/` is committed in this repo (that was the existing workflow), so rebuild
and commit it whenever `src/` changes.

## Clean-up history

The project started from a purchased admin template. In the restructure, the
template's demo pages (shop, email, calendar, charts, CMS, UI kits, extra
dashboards), the unused Firebase sign-up code and about 40 unused npm packages
were removed. The template's look and layout are unchanged.
