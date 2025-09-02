import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

const CustomsTicketDetails = () => {
    const query = useQuery();
    const mainId = query.get("main_id");
    const navigate = useNavigate();

    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({});
    const [message, setMessage] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!mainId) {
            setError("No main_id provided.");
            return;
        }

        const fetchTicket = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch("https://deepclear.ca/api/admin/fetchCbTicket", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ main_id: mainId }),
                });
                const data = await res.json();

                if (res.ok && data.data && data.data.length > 0) {
                    const found = data.data[0];
                    setTicket(found);
                    setFormData({
                        container_number: found.container_number || "",
                        cb_status: found.cb_status ?? 0,
                        cad_status: found.cad_status ?? 0,
                        transaction_number: found.transaction_number || "",
                        status: found.status ?? 0,
                        destination: found.destination || "",
                        eta: found.eta ? new Date(found.eta).toISOString().slice(0,16) : "",
                        note: found.note || "",
                    });
                } else {
                    setError(data.error || "Ticket not found.");
                }
            } catch (err) {
                setError("Failed to fetch ticket details.");
            }
            setLoading(false);
        };

        fetchTicket();
    }, [mainId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        try {
            const res = await fetch("https://deepclear.ca/api/admin/updateCBTicket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ main_id: mainId, ...formData }),
            });
            const data = await res.json();

            if (res.ok) {
                setMessage("✅ Ticket updated successfully.");
                setIsEditing(false);
            } else {
                setMessage(`❌ Update failed: ${data.error || "Unknown error"}`);
            }
        } catch {
            setMessage("❌ Network or server error.");
        }
    };

    if (loading) return <p>Loading ticket details...</p>;
    if (error) return (
        <div>
            <p className="text-danger">{error}</p>
            <button className="btn btn-secondary" onClick={() => navigate("/customs-tickets-list")}>
                Back
            </button>
        </div>
    );
    if (!ticket) return null;

    return (
        <div className="container my-4">
            <button className="btn btn-secondary mb-3" onClick={() => navigate("/customs-tickets-list")}>
                Back to List
            </button>
            <h2>Customs Ticket Details (Main ID: {mainId})</h2>

            {!isEditing ? (
                <button className="btn btn-warning mb-3" onClick={() => setIsEditing(true)}>
                    Edit
                </button>
            ) : (
                <button className="btn btn-danger mb-3" onClick={() => {
                    setFormData({
                        container_number: ticket.container_number || "",
                        cb_status: ticket.cb_status ?? 0,
                        cad_status: ticket.cad_status ?? 0,
                        transaction_number: ticket.transaction_number || "",
                        status: ticket.status ?? 0,
                        destination: ticket.destination || "",
                        eta: ticket.eta ? new Date(ticket.eta).toISOString().slice(0,16) : "",
                        note: ticket.note || "",
                    });
                    setIsEditing(false);
                    setMessage("");
                }}>
                    Cancel Edit
                </button>
            )}

            <form onSubmit={handleSubmit}>
                <div className="row g-3">
                    <div className="col-md-4">
                        <label>Container Number</label>
                        <input
                            type="text"
                            name="container_number"
                            className="form-control"
                            value={formData.container_number}
                            onChange={handleChange}
                            readOnly={!isEditing}
                        />
                    </div>
                    <div className="col-md-4">
                        <label>CB Status</label>
                        <select
                            name="cb_status"
                            className="form-control"
                            value={formData.cb_status}
                            onChange={handleChange}
                            disabled={!isEditing}
                        >
                            <option value="0">Not Submitted</option>
                            <option value="1">Submitted</option>
                            <option value="2">Release</option>
                            <option value="3">Exam</option>
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label>CAD Status</label>
                        <select
                            name="cad_status"
                            className="form-control"
                            value={formData.cad_status}
                            onChange={handleChange}
                            disabled={!isEditing}
                        >
                            <option value="0">Not Uploaded</option>
                            <option value="1">Uploaded</option>
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label>Transaction Number</label>
                        <input
                            type="text"
                            name="transaction_number"
                            className="form-control"
                            value={formData.transaction_number}
                            onChange={handleChange}
                            readOnly={!isEditing}
                        />
                    </div>
                    <div className="col-md-4">
                        <label>Status</label>
                        <select
                            name="status"
                            className="form-control"
                            value={formData.status}
                            onChange={handleChange}
                            disabled={!isEditing}
                        >
                            <option value="0">Reviewing</option>
                            <option value="1">Processing</option>
                            <option value="2">Finished</option>
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label>Destination</label>
                        <input
                            type="text"
                            name="destination"
                            className="form-control"
                            value={formData.destination}
                            onChange={handleChange}
                            readOnly={!isEditing}
                        />
                    </div>
                    <div className="col-md-4">
                        <label>ETA</label>
                        <input
                            type="datetime-local"
                            name="eta"
                            className="form-control"
                            value={formData.eta}
                            onChange={handleChange}
                            readOnly={!isEditing}
                        />
                    </div>
                    <div className="col-md-12">
                        <label>Note</label>
                        <textarea
                            name="note"
                            className="form-control"
                            value={formData.note}
                            onChange={handleChange}
                            readOnly={!isEditing}
                        />
                    </div>
                </div>

                {isEditing && (
                    <button type="submit" className="btn btn-primary mt-3">
                        Save Changes
                    </button>
                )}
                {message && <p className="mt-3">{message}</p>}
            </form>
        </div>
    );
};

export default CustomsTicketDetails;
