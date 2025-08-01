import React, { useEffect, useState } from "react";
import TicketDetails from "./TicketDetails";
import { useNavigate } from "react-router-dom";

const TicketsList = () => {
    const [tickets, setTickets] = useState([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalTickets, setTotalTickets] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [mainIdFilter, setMainIdFilter] = useState("");
    const [containerNumberFilter, setContainerNumberFilter] = useState("");
    const [transactionNumberFilter, setTransactionNumberFilter] = useState("");

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [refreshFlag, setRefreshFlag] = useState(false); // <-- new
    const navigate = useNavigate();
    const fetchTickets = async () => {
        setLoading(true);
        setError("");
        try {
            const body = { page, limit };
            if (mainIdFilter.trim()) body.main_id = mainIdFilter.trim();
            if (containerNumberFilter.trim()) body.container_number = containerNumberFilter.trim();
            if (transactionNumberFilter.trim()) body.transaction_number = transactionNumberFilter.trim();

            const res = await fetch("https://deepclear.ca/api/admin/fetchTruckTickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (res.ok) {
                setTickets(data.data || []);
                setTotalTickets(data.total || 0);
            } else {
                setError(data.error || "Failed to load tickets.");
                setTickets([]);
                setTotalTickets(0);
            }
        } catch (err) {
            console.error(err);
            setError("Something went wrong while fetching tickets.");
            setTickets([]);
            setTotalTickets(0);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTickets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit, refreshFlag]);  // <-- added refreshFlag here

    useEffect(() => {
        setPage(1);
        fetchTickets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mainIdFilter, containerNumberFilter, transactionNumberFilter]);

    const totalPages = Math.max(1, Math.ceil(totalTickets / limit));

    if (selectedTicket) {
        return (
            <TicketDetails
                mainId={selectedTicket.main_id}
                truckId={selectedTicket.truck_ticket_id}
                onBack={() => {
                    setSelectedTicket(null);
                    setRefreshFlag((prev) => !prev); // toggle to refresh list
                }}
            />
        );
    }

    return (
        <div className="container mt-4">
            <div className="bg-primary text-white rounded px-3 py-2 mb-4 text-center">
                <h2 className="mb-0">Truck Tickets List</h2>
            </div>

            <div className="row mb-4 g-3">
                <div className="col-md-3">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Filter by Main ID"
                        value={mainIdFilter}
                        onChange={(e) => setMainIdFilter(e.target.value)}
                    />
                </div>
                <div className="col-md-3">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Filter by Container #"
                        value={containerNumberFilter}
                        onChange={(e) => setContainerNumberFilter(e.target.value)}
                    />
                </div>
                <div className="col-md-3">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Filter by Transaction #"
                        value={transactionNumberFilter}
                        onChange={(e) => setTransactionNumberFilter(e.target.value)}
                    />
                </div>
                <div className="col-md-3 d-flex align-items-center">
                    <select
                        className="form-select me-3"
                        value={limit}
                        onChange={(e) => {
                            setLimit(Number(e.target.value));
                            setPage(1);
                        }}
                        aria-label="Items per page"
                    >
                        {[5, 10, 20, 50].map((n) => (
                            <option key={n} value={n}>
                                {n} per page
                            </option>
                        ))}
                    </select>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setPage(1);
                            fetchTickets();
                        }}
                    >
                        Search
                    </button>
                </div>
            </div>

            {loading && <p className="text-center">Loading tickets...</p>}
            {error && <p className="text-danger text-center">{error}</p>}
            {!loading && tickets.length === 0 && !error && <p className="text-center">No tickets found.</p>}

            {!loading && tickets.length > 0 && (
                <div
                    className="table-responsive shadow-sm rounded"
                    style={{ maxHeight: "60vh", overflowY: "auto" }}
                >
                    <table className="table table-striped table-bordered table-hover align-middle mb-0">
                        <thead className="table-dark sticky-top">
                        <tr>
                            <th>Reference #</th>
                            <th>Client</th>
                            <th>Container #</th>
                            <th>Pickup</th>
                            <th>Delivery</th>
                            <th>POE</th>
                            <th>Cross Border</th>
                            <th>Pickup Time</th>
                            <th>Transaction #</th>
                            <th>Created At</th>
                            <th>Action</th>
                        </tr>
                        </thead>
                        <tbody>
                        {tickets.map((ticket, i) => (
                            <tr key={ticket.truck_ticket_id || i}>
                                <td>{ticket.reference_number || "-"}</td>
                                <td>{ticket.client_name || "-"}</td>
                                <td>{ticket.container_number || "-"}</td>
                                <td>{ticket.pickup_address || "-"}</td>
                                <td>{ticket.delivery_address || "-"}</td>
                                <td>{ticket.poe || "-"}</td>
                                <td>{ticket.cross_border_location || "-"}</td>
                                <td>
                                    {ticket.pickup_time
                                        ? new Date(ticket.pickup_time).toLocaleString("en-CA", {
                                            timeZone: "America/Toronto",
                                            hour12: false,
                                        })
                                        : "-"}
                                </td>
                                <td>{ticket.transaction_number || "-"}</td>
                                <td>
                                    {ticket.main_create_date
                                        ? new Date(ticket.main_create_date).toLocaleString("en-CA", {
                                            timeZone: "America/Toronto",
                                            hour12: false,
                                        })
                                        : "-"}
                                </td>
                                <td>
                                    <button
                                        className="btn btn-sm btn-info"
                                        onClick={() => navigate(`/ticket-details?reference=${ticket.reference_number}`)}
                                    >
                                        View Details
                                    </button>

                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="d-flex justify-content-between align-items-center mt-3">
                <button
                    className="btn btn-outline-primary"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                >
                    Previous
                </button>
                <span>
          Page {page} of {Math.max(1, Math.ceil(totalTickets / limit))}
        </span>
                <button
                    className="btn btn-outline-primary"
                    onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(totalTickets / limit)), p + 1))}
                    disabled={page === Math.max(1, Math.ceil(totalTickets / limit))}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default TicketsList;
