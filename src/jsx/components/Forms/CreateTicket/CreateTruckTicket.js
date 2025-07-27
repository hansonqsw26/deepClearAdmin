import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
const CreateTruckTicket = () => {
    const [formData, setFormData] = useState({
        client_id: "",
        client_name: "",
        container_number: "",
        pickup_address: "",
        delivery_address: "",
        carrier_name: "",
        ein_number: "",
        scac_number: "",
        pickup_time: "",
        load_number: "",
        truck_number: "",
        trailer_number: "",
        poe: "",
        cross_border_location: "",
        quote_price: "",
        cost_price: "",
        supportor: "",
        supportor_code: "",
        gps_link: "",
        pars: "",
        transaction_number: "",
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
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({})
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
            const selectedClient = clients.find(client => String(client.client_id) === value);
            setFormData((prev) => ({
                ...prev,
                client_id: value,
                client_name: selectedClient ? selectedClient.client_name : ""
            }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (
            !formData.client_id ||
            !formData.pickup_address ||
            !formData.delivery_address
        ) {
            return setMessage("❌ Required: client, pickup and delivery address");
        }

        try {
            const res = await fetch("https://deepclear.ca/api/admin/createTruckTicket", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const result = await res.json();

            if (res.ok) {
                setMessage(`✅ Ticket created! Reference #: ${result.reference_number}`);
                setFormData((prev) => ({
                    ...prev,
                    container_number: "",
                    pickup_address: "",
                    delivery_address: ""
                }));
                navigate("/tickets-list");
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
            <h2>Create Truck Ticket</h2>

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

                {/* Required Address Fields */}
                <div className="mb-3">
                    <label>Pickup Address *</label>
                    <input
                        type="text"
                        name="pickup_address"
                        className="form-control"
                        value={formData.pickup_address}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="mb-3">
                    <label>Delivery Address *</label>
                    <input
                        type="text"
                        name="delivery_address"
                        className="form-control"
                        value={formData.delivery_address}
                        onChange={handleChange}
                        required
                    />
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
                    <label>POE</label>
                    <input
                        type="text"
                        name="poe"
                        className="form-control"
                        value={formData.poe}
                        onChange={handleChange}
                    />
                </div>

                <div className="mb-3">
                    <label>Cross Border Location</label>
                    <input
                        type="text"
                        name="cross_border_location"
                        className="form-control"
                        value={formData.cross_border_location}
                        onChange={handleChange}
                    />
                </div>

                {/* Date/Time Picker */}
                <div className="mb-3">
                    <label>Pickup Time</label>
                    <input
                        type="datetime-local"
                        name="pickup_time"
                        className="form-control"
                        value={formData.pickup_time}
                        onChange={handleChange}
                    />
                </div>

                {/* Remaining Optional Fields */}
                {[
                    "carrier_name", "ein_number", "scac_number", "load_number",
                    "truck_number", "trailer_number", "quote_price", "cost_price",
                    "supportor", "supportor_code", "gps_link", "pars", "transaction_number"
                ].map((field) => (
                    <div className="mb-3" key={field}>
                        <label>{field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</label>
                        <input
                            type={field.includes("price") ? "number" : "text"}
                            step={field.includes("price") ? "0.01" : undefined}
                            name={field}
                            className="form-control"
                            value={formData[field]}
                            onChange={handleChange}
                        />
                    </div>
                ))}

                <button type="submit" className="btn btn-primary">Create Ticket</button>
            </form>
        </div>
    );
};

export default CreateTruckTicket;
