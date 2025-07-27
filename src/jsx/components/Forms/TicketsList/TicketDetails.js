import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

const TicketDetails = () => {
    const query = useQuery();
    const referenceNumber = query.get("reference");
    const navigate = useNavigate();

    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({});
    const [originalData, setOriginalData] = useState({});
    const [message, setMessage] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!referenceNumber) {
            setError("No reference number provided.");
            return;
        }

        const fetchTicketDetails = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch("https://deepclear.ca/api/admin/fetchTruckTickets", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reference_number: referenceNumber }),
                });
                const data = await res.json();

                if (res.ok && data.data && data.data.length > 0) {
                    const found = data.data[0]; // assuming API returns array of matches
                    setTicket(found);
                    setFormData(found);
                    setOriginalData(found);
                } else {
                    setError(data.error || "Ticket not found.");
                }
            } catch (err) {
                setError("Failed to fetch ticket details.");
            }
            setLoading(false);
        };

        fetchTicketDetails();
    }, [referenceNumber]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        const payload = {
            ...formData,
            truck_id: formData.truck_ticket_id,
        };
        delete payload.truck_ticket_id;

        if (!payload.main_id || !payload.truck_id || !payload.truck_details_id) {
            setMessage("❌ Missing required fields: main_id, truck_id, or truck_details_id");
            return;
        }

        try {
            const res = await fetch("https://deepclear.ca/api/admin/uploadTruckTickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage("✅ Ticket updated successfully.");
                setIsEditing(false);
                setOriginalData(formData);
            } else {
                setMessage(`❌ Update failed: ${data.error || "Unknown error"}`);
            }
        } catch {
            setMessage("❌ Network or server error.");
        }
    };

    if (loading) return <p>Loading ticket details...</p>;
    if (error)
        return (
            <div>
                <p className="text-danger">{error}</p>
                <button className="btn btn-secondary" onClick={() => navigate("/tickets-list")}>
                    Back
                </button>
            </div>
        );

    if (!ticket) return null;

    return (
        <div className="container my-4">
            <button className="btn btn-secondary mb-3" onClick={() => navigate("/tickets-list")}>
                Back to List
            </button>
            <h2>Ticket Details (Reference: {referenceNumber})</h2>

            {!isEditing ? (
                <button className="btn btn-warning mb-3" onClick={() => setIsEditing(true)}>
                    Edit
                </button>
            ) : (
                <button className="btn btn-danger mb-3" onClick={() => {
                    setFormData(originalData);
                    setIsEditing(false);
                    setMessage("");
                }}>
                    Cancel Edit
                </button>
            )}

            <form onSubmit={handleSubmit}>
                {/* Example readonly fields */}
                <div className="mb-3">
                    <label>Main ID</label>
                    <input type="text" name="main_id" className="form-control" value={formData.main_id || ""} readOnly />
                </div>
                <div className="mb-3">
                    <label>Reference Number</label>
                    <input type="text" name="reference_number" className="form-control" value={formData.reference_number || ""} readOnly />
                </div>

                {/* Editable fields */}
                {[
                    "container_number",
                    "pickup_address",
                    "delivery_address",
                    "carrier_name",
                    "ein_number",
                    "scac_number",
                    "pickup_time",
                    "load_number",
                    "truck_number",
                    "trailer_number",
                    "poe",
                    "cross_border_location",
                    "quote_price",
                    "cost_price",
                    "supportor",
                    "supportor_code",
                    "gps_link",
                    "pars",
                    "transaction_number",
                ].map((field) => (
                    <div className="mb-3" key={field}>
                        <label>{field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</label>
                        <input
                            type={field.includes("price") ? "number" : field === "pickup_time" ? "datetime-local" : "text"}
                            step={field.includes("price") ? "0.01" : undefined}
                            name={field}
                            className="form-control"
                            value={formData[field] || ""}
                            onChange={handleChange}
                            readOnly={!isEditing}
                        />
                    </div>
                ))}

                {isEditing && (
                    <button type="submit" className="btn btn-primary">
                        Save Changes
                    </button>
                )}
                {message && <p className="mt-3">{message}</p>}
            </form>
        </div>
    );
};

export default TicketDetails;
