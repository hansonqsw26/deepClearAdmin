import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const CreateCBTicket = () => {
    const [formData, setFormData] = useState({
        client_id: "",
        client_name: "",
        note: "",
        container_number: "",
        transaction_number: "",
        destination: "",
        eta: "",
        cb_status: 0,
        cad_status: 0,
    });

    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const res = await fetch("https://deepclear.ca/api/admin/getUsers", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                });

                const data = await res.json();
                if (res.ok) {
                    setClients(data.data || []);
                } else {
                    console.error("Error loading client users:", data.error);
                }
            } catch (err) {
                console.error("Network error:", err.message);
            }
        };

        fetchClients();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "client_id") {
            const selectedClient = clients.find(
                (client) => String(client.client_id) === value
            );
            setFormData((prev) => ({
                ...prev,
                client_id: value,
                client_name: selectedClient ? selectedClient.client_name : "",
            }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.client_id) {
            return setMessage("❌ Required: select a client");
        }

        try {
            const res = await fetch("https://deepclear.ca/api/admin/createCBTicket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const result = await res.json();

            if (res.ok) {
                setMessage(
                    `✅ Customs Brokerage ticket created! Reference #: ${result.reference_number}`
                );
                setFormData((prev) => ({
                    ...prev,
                    container_number: "",
                    note: "",
                    transaction_number: "",
                    destination: "",
                    eta: "",
                }));
                navigate("/customs-tickets-list");
            } else {
                setMessage(`❌ Error: ${result.error || "Server error"}`);
            }
        } catch (error) {
            console.error("Fetch error:", error);
            setMessage("❌ Network or server error");
        }
    };

    return (
        <div className="container my-4">
            <h2>Create Customs Brokerage Ticket</h2>

            {message && <div className="alert alert-info my-3">{message}</div>}

            <form onSubmit={handleSubmit}>
                {/* CLIENT DROPDOWN */}
                <div className="mb-3">
                    <label>Select Client *</label>
                    <select
                        name="client_id"
                        className="form-select"
                        value={formData.client_id}
                        onChange={handleChange}
                        required
                    >
                        <option value="">-- Select Client --</option>
                        {clients.map((client) => (
                            <option key={client.client_id} value={client.client_id}>
                                {client.client_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Optional Fields */}
                <div className="mb-3">
                    <label>Container Number</label>
                    <input
                        type="text"
                        name="container_number"
                        className="form-control"
                        value={formData.container_number}
                        onChange={handleChange}
                    />
                </div>

                <div className="mb-3">
                    <label>Transaction Number</label>
                    <input
                        type="text"
                        name="transaction_number"
                        className="form-control"
                        value={formData.transaction_number}
                        onChange={handleChange}
                    />
                </div>

                <div className="mb-3">
                    <label>Destination</label>
                    <input
                        type="text"
                        name="destination"
                        className="form-control"
                        value={formData.destination}
                        onChange={handleChange}
                    />
                </div>

                <div className="mb-3">
                    <label>ETA</label>
                    <input
                        type="datetime-local"
                        name="eta"
                        className="form-control"
                        value={formData.eta}
                        onChange={handleChange}
                    />
                </div>

                <div className="mb-3">
                    <label>Note</label>
                    <textarea
                        name="note"
                        className="form-control"
                        rows="3"
                        value={formData.note}
                        onChange={handleChange}
                    ></textarea>
                </div>

                <button type="submit" className="btn btn-primary">
                    Create Customs Ticket
                </button>
            </form>
        </div>
    );
};

export default CreateCBTicket;
