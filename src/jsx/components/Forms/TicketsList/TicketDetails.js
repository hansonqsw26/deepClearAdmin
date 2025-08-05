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
    const [department, setDepartment] = useState(null);

    const formatDateTimeLocal = (datetime) => {
        if (!datetime) return "";
        const date = new Date(datetime);
        const tzOffset = date.getTimezoneOffset() * 60000; // in milliseconds
        const localISOTime = new Date(date - tzOffset).toISOString().slice(0, 16);
        return localISOTime;
    };

    const formatDateOnly = (datetime) => {
        if (!datetime) return "";
        const date = new Date(datetime);
        return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
    };


    const editableFieldsForDept2 = [
        "carrier_name",
        "ein_number",
        "scac_number",
        "pars",
        "transaction_number",
        "supportor",
        "load_number",
        "poe",
        "cost_price"
    ];

    useEffect(() => {
        try {
            const userData = JSON.parse(localStorage.getItem("adminUser"));
            setDepartment(userData?.department || null);
        } catch {
            setDepartment(null);
        }
    }, []);

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
                    const found = data.data[0];
                    setTicket(found);
                    setFormData({
                        ...found,
                        pars: found.pars ? found.pars.split(",") : [""],
                        transaction_number: found.transaction_number ? found.transaction_number.split(",") : [""],
                    });
                    setOriginalData({
                        ...found,
                        pars: found.pars ? found.pars.split(",") : [""],
                        transaction_number: found.transaction_number ? found.transaction_number.split(",") : [""],
                    });
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

    const handleArrayChange = (field, index, value) => {
        setFormData((prev) => {
            const updated = [...(prev[field] || [])];
            updated[index] = value;
            return { ...prev, [field]: updated };
        });
    };

    const addField = (field) => {
        setFormData((prev) => ({
            ...prev,
            [field]: [...(prev[field] || []), ""],
        }));
    };

    const removeField = (field, index) => {
        setFormData((prev) => {
            const updated = [...(prev[field] || [])];
            updated.splice(index, 1);
            return { ...prev, [field]: updated };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        const payload = {
            ...formData,
            truck_id: formData.truck_ticket_id,
            pars: Array.isArray(formData.pars) ? formData.pars.join(",") : formData.pars,
            transaction_number: Array.isArray(formData.transaction_number)
                ? formData.transaction_number.join(",")
                : formData.transaction_number,
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

    const isFieldEditable = (field) => {
        if (!isEditing) return false;
        if (department === 2) return editableFieldsForDept2.includes(field);
        return true;
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

    // Helper to render normal input or arrays
    const renderField = (field) => {
        if (["pars", "transaction_number"].includes(field)) {
            return formData[field]?.map((val, idx) => (
                <div className="mb-2 d-flex align-items-center" key={idx}>
                    <input
                        type="text"
                        className="form-control me-2"
                        value={val}
                        onChange={(e) => handleArrayChange(field, idx, e.target.value)}
                        readOnly={!isFieldEditable(field)}
                    />
                    {isEditing && isFieldEditable(field) && (
                        <>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger me-1"
                                onClick={() => removeField(field, idx)}
                            >
                                −
                            </button>
                            {idx === formData[field].length - 1 && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => addField(field)}
                                >
                                    +
                                </button>
                            )}
                        </>
                    )}
                </div>
            ));
        }

        if (field === "poe") {
            return isEditing && isFieldEditable(field) ? (
                <select
                    className="form-control"
                    name="poe"
                    value={formData.poe || ""}
                    onChange={handleChange}
                >
                    <option value="">Select POE</option>
                    <option value="Coutts, AB (0705)">Coutts, AB (0705)</option>
                    <option value="Sarnia,ON(3802)">Sarnia,ON(3802)</option>
                    <option value="Windsor,ON(3801)">Windsor,ON(3801)</option>
                </select>
            ) : formData.poe ? (
                <input type="text" className="form-control" value={formData.poe} readOnly />
            ) : null;
        }

        return (
            <input
                type={
                    field.includes("price")
                        ? "number"
                        : field === "pickup_time"
                            ? "datetime-local"
                            : "text"
                }
                step={field.includes("price") ? "0.01" : undefined}
                name={field}
                className="form-control"
                value={formData[field] || ""}
                onChange={handleChange}
                readOnly={!isFieldEditable(field)}
            />
        );
    };

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
                <button
                    className="btn btn-danger mb-3"
                    onClick={() => {
                        setFormData(originalData);
                        setIsEditing(false);
                        setMessage("");
                    }}
                >
                    Cancel Edit
                </button>
            )}

            <form onSubmit={handleSubmit}>
                {/* Section 1: IDs */}
                <h5 className="mb-3 mt-4">Ticket Identification</h5>
                <div className="row g-3">
                    <div className="col-md-4">
                        <label>Main ID</label>
                        <input type="text" name="main_id" className="form-control" value={formData.main_id || ""}
                               readOnly/>
                    </div>
                    <div className="col-md-4">
                        <label>Reference Number</label>
                        <input type="text" name="reference_number" className="form-control"
                               value={formData.reference_number || ""} readOnly/>
                    </div>
                    <div className="col-md-4">
                        <label>Container Number</label>
                        <input
                            type="text"
                            name="container_number"
                            className="form-control"
                            value={formData.container_number || ""}
                            onChange={handleChange}
                            readOnly={!isFieldEditable("container_number")}
                        />
                    </div>
                    <div className="col-md-4">
                        <label>PU Number</label>
                        <input
                            type="text"
                            name="pu_number"
                            className="form-control"
                            value={formData.pu_number || ""}
                            onChange={handleChange}
                            readOnly={!isEditing}
                        />
                    </div>

                    <div className="col-md-4">
                        <label>Note</label>
                        <input
                            type="text"
                            name="note"
                            className="form-control"
                            value={formData.note || ""}
                            onChange={handleChange}
                            readOnly={!isEditing}
                        />
                    </div>

                </div>

                {/* Section 2: Addresses */}
                <h5 className="mb-3 mt-4">Addresses</h5>
                <div className="row g-3">
                    <div className="col-md-6">
                        <label>Pickup Address</label>
                        <input
                            type="text"
                            name="pickup_address"
                            className="form-control"
                            value={formData.pickup_address || ""}
                            onChange={handleChange}
                            readOnly={!isFieldEditable("pickup_address")}
                        />
                    </div>

                    {/* pickup_time */}
                    <div className="col-md-6">
                        <label>Pickup Date</label>
                        <input
                            type="date"
                            name="pickup_time"
                            className="form-control"
                            value={formatDateOnly(formData.pickup_time)}
                            onChange={handleChange}
                            readOnly={!isFieldEditable("pickup_time")}
                        />
                    </div>


                    <div className="col-md-6">
                        <label>Delivery Address</label>
                        <input
                            type="text"
                            name="delivery_address"
                            className="form-control"
                            value={formData.delivery_address || ""}
                            onChange={handleChange}
                            readOnly={!isFieldEditable("delivery_address")}
                        />
                    </div>

                    <div className="col-md-6">
                        <label>Delivery Date</label>
                        <input
                            type="date"
                            name="delivery_time"
                            className="form-control"
                            value={formatDateOnly(formData.delivery_time)}
                            onChange={handleChange}
                            readOnly={!isFieldEditable("delivery_time")}
                        />
                    </div>


                </div>

                <h5 className="mb-3 mt-4">Customer Information</h5>
                <div className="row g-3">
                    {/* transaction_number (array) */}
                    <div className="col-md-4">
                        <label>Transaction Number</label>
                        {formData.transaction_number?.map((val, idx) => (
                            <div className="mb-2 d-flex align-items-center" key={idx}>
                                <input
                                    type="text"
                                    className="form-control me-2"
                                    value={val}
                                    onChange={(e) => handleArrayChange("transaction_number", idx, e.target.value)}
                                    readOnly={!isFieldEditable("transaction_number")}
                                />
                                {isEditing && isFieldEditable("transaction_number") && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger me-1"
                                            onClick={() => removeField("transaction_number", idx)}
                                        >
                                            −
                                        </button>
                                        {idx === formData.transaction_number.length - 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => addField("transaction_number")}
                                            >
                                                +
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    {/* pars (array) */}
                    <div className="col-md-4">
                        <label>PARS</label>
                        {formData.pars?.map((val, idx) => (
                            <div className="mb-2 d-flex align-items-center" key={idx}>
                                <input
                                    type="text"
                                    className="form-control me-2"
                                    value={val}
                                    onChange={(e) => handleArrayChange("pars", idx, e.target.value)}
                                    readOnly={!isFieldEditable("pars")}
                                />
                                {isEditing && isFieldEditable("pars") && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger me-1"
                                            onClick={() => removeField("pars", idx)}
                                        >
                                            −
                                        </button>
                                        {idx === formData.pars.length - 1 && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => addField("pars")}
                                            >
                                                +
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>


                </div>

                    {/* Section 3: Carrier info */}
                    <h5 className="mb-3 mt-4">Carrier Information</h5>
                    <div className="row g-3">
                        <div className="col-md-4">
                            <label>Carrier Name</label>
                            <input
                                type="text"
                                name="carrier_name"
                                className="form-control"
                                value={formData.carrier_name || ""}
                                onChange={handleChange}
                                readOnly={!isFieldEditable("carrier_name")}
                            />
                        </div>
                        <div className="col-md-4">
                            <label>Ein Number</label>
                            <input
                                type="text"
                                name="ein_number"
                                className="form-control"
                                value={formData.ein_number || ""}
                                onChange={handleChange}
                                readOnly={!isFieldEditable("ein_number")}
                            />
                        </div>
                        <div className="col-md-4">
                            <label>Scac Number</label>
                            <input
                                type="text"
                                name="scac_number"
                                className="form-control"
                                value={formData.scac_number || ""}
                                onChange={handleChange}
                                readOnly={!isFieldEditable("scac_number")}
                            />
                        </div>

                        <div className="row g-3">

                            {/* load_number */}
                            <div className="col-md-4">
                                <label>Load Number</label>
                                <input
                                    type="text"
                                    name="load_number"
                                    className="form-control"
                                    value={formData.load_number || ""}
                                    onChange={handleChange}
                                    readOnly={!isFieldEditable("load_number")}
                                />
                            </div>

                            {/* truck_number */}
                            <div className="col-md-4">
                                <label>Truck Number</label>
                                <input
                                    type="text"
                                    name="truck_number"
                                    className="form-control"
                                    value={formData.truck_number || ""}
                                    onChange={handleChange}
                                    readOnly={!isFieldEditable("truck_number")}
                                />
                            </div>

                            {/* trailer_number */}
                            <div className="col-md-4">
                                <label>Trailer Number</label>
                                <input
                                    type="text"
                                    name="trailer_number"
                                    className="form-control"
                                    value={formData.trailer_number || ""}
                                    onChange={handleChange}
                                    readOnly={!isFieldEditable("trailer_number")}
                                />
                            </div>

                            {/* poe */}
                            <div className="col-md-4">
                                <label>POE</label>
                                {isEditing && isFieldEditable("poe") ? (
                                    <select
                                        className="form-control"
                                        name="poe"
                                        value={formData.poe || ""}
                                        onChange={handleChange}
                                    >
                                        <option value="">Select POE</option>
                                        <option value="Coutts, AB (0705)">Coutts, AB (0705)</option>
                                        <option value="Sarnia,ON(3802)">Sarnia,ON(3802)</option>
                                        <option value="Windsor,ON(3801)">Windsor,ON(3801)</option>
                                    </select>
                                ) : formData.poe ? (
                                    <input type="text" className="form-control" value={formData.poe} readOnly/>
                                ) : null}
                            </div>

                            <div className="col-md-4">
                                <label>Supportor</label>
                                <input
                                    type="text"
                                    name="supportor"
                                    className="form-control"
                                    value={formData.supportor || ""}
                                    onChange={handleChange}
                                    readOnly={!isFieldEditable("supportor")}
                                />
                            </div>


                            {/* gps_link */}
                            <div className="col-md-5">
                                <label>GPS Link</label>
                                <div style={{position: "relative"}}>
                                    <input
                                        type="text"
                                        name="gps_link"
                                        className="form-control"
                                        value={formData.gps_link || ""}
                                        onChange={handleChange}
                                        readOnly={!isFieldEditable("gps_link")}
                                        style={{
                                            cursor: formData.gps_link && !isFieldEditable("gps_link") ? "pointer" : "text"
                                        }}
                                        onClick={() => {
                                            if (!isFieldEditable("gps_link") && formData.gps_link) {
                                                window.open(formData.gps_link, "_blank");
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                        </div>

                        {/* Section 4: Pricing */}
                        <h5 className="mb-3 mt-4">Pricing</h5>
                        <div className="row g-3">
                            {department !== 2 && (
                                <div className="col-md-6">
                                    <label>Quote Price</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="quote_price"
                                        className="form-control"
                                        value={formData.quote_price || ""}
                                        onChange={handleChange}
                                        readOnly={!isFieldEditable("quote_price")}
                                    />
                                </div>
                            )}
                            <div className="col-md-6">
                                <label>Cost Price</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="cost_price"
                                    className="form-control"
                                    value={formData.cost_price || ""}
                                    onChange={handleChange}
                                    readOnly={!isFieldEditable("cost_price")}
                                />
                            </div>
                        </div>


                    </div>

                    {isEditing && (
                        <button type="submit" className="btn btn-primary mt-4">
                            Save Changes
                        </button>
                    )}
                    {message && <p className="mt-3">{message}</p>}
            </form>
        </div>
);
};

export default TicketDetails;
