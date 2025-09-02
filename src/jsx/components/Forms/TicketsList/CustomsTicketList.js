import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const CustomsTicketsList = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchContainer, setSearchContainer] = useState("");
    const [searchReference, setSearchReference] = useState("");
    const [searchTransaction, setSearchTransaction] = useState("");
    const [searchStatus, setSearchStatus] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [total, setTotal] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTickets();
    }, [page, searchContainer, searchReference, searchTransaction, searchStatus]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch("https://deepclear.ca/api/admin/fetchCbTicket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    container_number: searchContainer,
                    main_id: searchReference,
                    transaction_number: searchTransaction,
                    status: searchStatus !== "" ? Number(searchStatus) : undefined,
                    page,
                    limit,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setTickets(data.data || []);
                setTotal(data.total || 0);
            } else {
                console.error("Error fetching customs tickets:", data.error);
            }
        } catch (err) {
            console.error("Error fetching customs tickets:", err);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="container mt-4">
            <h3>Customs Brokerage Tickets</h3>

            {/* Filters */}
            <div className="row mb-3">
                <div className="col">
                    <input
                        type="text"
                        placeholder="Search by Container #"
                        className="form-control"
                        value={searchContainer}
                        onChange={(e) => setSearchContainer(e.target.value)}
                    />
                </div>
                <div className="col">
                    <input
                        type="text"
                        placeholder="Search by Reference #"
                        className="form-control"
                        value={searchReference}
                        onChange={(e) => setSearchReference(e.target.value)}
                    />
                </div>
                <div className="col">
                    <input
                        type="text"
                        placeholder="Search by Transaction #"
                        className="form-control"
                        value={searchTransaction}
                        onChange={(e) => setSearchTransaction(e.target.value)}
                    />
                </div>
                <div className="col">
                    <select
                        className="form-select"
                        value={searchStatus}
                        onChange={(e) => setSearchStatus(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="0">Reviewing</option>
                        <option value="1">Processing</option>
                        <option value="2">Finished</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <p>Loading tickets...</p>
            ) : (
                <div className="table-responsive shadow-sm rounded" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                    <table className="table table-bordered table-hover">
                        <thead className="table-dark sticky-top">
                        <tr>
                            <th>Action</th>
                            <th>Client</th>
                            <th>Reference #</th>
                            <th>Container #</th>
                            <th>Transaction #</th>
                            <th>Customs Status</th>
                            <th>Status</th>
                            <th>CAD Status</th>
                            <th>Destination</th>
                            <th>ETA</th>
                            <th>Note</th>
                            <th>Created At</th>
                        </tr>
                        </thead>
                        <tbody>
                        {tickets.map((ticket, i) => (
                            <tr key={i}>
                                <td>
                                    <button
                                        className="btn btn-sm btn-info"
                                        onClick={() =>
                                            navigate(`/customs-ticket-details?main_id=${ticket.main_id}&cb_id=${ticket.cb_id}`)
                                        }
                                    >
                                        View Details
                                    </button>
                                </td>
                                <td>{ticket.client_name || "-"}</td>
                                <td>{ticket.reference_number || "-"}</td>
                                <td>{ticket.container_number || "-"}</td>
                                <td>{ticket.transaction_number || "-"}</td>
                                <td>
                                    {ticket.cb_status === 0
                                        ? "Not Submitted"
                                        : ticket.cb_status === 1
                                            ? "Submitted"
                                            : ticket.cb_status === 2
                                                ? "Release"
                                                : ticket.cb_status === 3
                                                    ? "Exam"
                                                    : "-"}
                                </td>
                                <td>
                                    {ticket.status === 0
                                        ? "Reviewing"
                                        : ticket.status === 1
                                            ? "Processing"
                                            : ticket.status === 2
                                                ? "Finished"
                                                : "-"}
                                </td>
                                <td>
                                    {ticket.cad_status === 0
                                        ? "Not Uploaded"
                                        : ticket.cad_status === 1
                                            ? "Uploaded"
                                            : "-"}
                                </td>
                                <td>{ticket.destination || "-"}</td>
                                <td>{ticket.eta ? new Date(ticket.eta).toLocaleDateString() : "-"}</td>
                                <td>{ticket.note || "-"}</td>
                                <td>
                                    {ticket.create_date
                                        ? new Date(ticket.create_date).toLocaleString("en-CA", {
                                            timeZone: "America/Toronto",
                                            hour12: false,
                                        })
                                        : "-"}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            <div className="d-flex justify-content-between mt-3">
                <button
                    className="btn btn-secondary"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => prev - 1)}
                >
                    Previous
                </button>
                <span>
                    Page {page} of {totalPages || 1}
                </span>
                <button
                    className="btn btn-secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => prev + 1)}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default CustomsTicketsList;
