/**
 * Sidebar menu of the admin portal.
 * `hideForDepartments`: admin departments that do not see the entry (department 2 = operations-only staff).
 */
export const MenuList = [
    {
        title: 'Dashboard',
        to: 'dashboard',
        iconStyle: <i className="fa-solid fa-gauge-high" />,
    },
    {
        title: 'Ticket summary',
        to: 'ticket-summary',
        iconStyle: <i className="fa-solid fa-chart-column" />,
    },
    {
        title: 'Customs',
        classsChange: 'mm-collapse',
        iconStyle: <i className="fa-solid fa-ship" />,
        content: [
            { title: 'Customs files', to: 'customs-tickets-list' },
            { title: 'New customs file', to: 'create-customs-ticket' },
        ],
    },
    {
        title: 'Trucking',
        classsChange: 'mm-collapse',
        iconStyle: <i className="fa-solid fa-truck-fast" />,
        content: [
            { title: 'Truck tickets', to: 'tickets-list' },
            { title: 'New truck ticket', to: 'create-truck-ticket', hideForDepartments: [2] },
        ],
    },
    {
        title: 'Quotes',
        classsChange: 'mm-collapse',
        iconStyle: <i className="fa-solid fa-calculator" />,
        hideForDepartments: [2],
        content: [
            { title: 'Quote requests', to: 'quote-list' },
            { title: 'New quote', to: 'create-quote' },
        ],
    },
    {
        title: 'Accounts',
        classsChange: 'mm-collapse',
        iconStyle: <i className="fa-solid fa-users" />,
        hideForDepartments: [2],
        content: [
            { title: 'Clients', to: 'client-accounts' },
            { title: 'Staff', to: 'staff-accounts' },
        ],
    },
];

/** The menu as a given admin department sees it. */
export function menuForDepartment(department) {
    const dep = Number(department);
    const visible = (item) => !(item.hideForDepartments || []).includes(dep);
    return MenuList.filter(visible).map((item) => (item.content ? { ...item, content: item.content.filter(visible) } : item));
}
