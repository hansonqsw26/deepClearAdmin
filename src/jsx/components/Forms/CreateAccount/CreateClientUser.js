import React, { useState } from "react";

const CreateClientUser = () => {
    const [clientName, setClientName] = useState("");
    const [clientPassword, setClientPassword] = useState("");
    const [department, setDepartment] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const res = await fetch("https://deepclear.ca/api/client/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_name: clientName,
                    client_password: clientPassword,
                    department: department || null
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText);
            }

            const data = await res.json();
            setMessage(`✅ Success! Client created: ${data.clientName} (ID: ${data.clientId})`);
            setClientName("");
            setClientPassword("");
            setDepartment("");
        } catch (err) {
            console.error(err);
            setMessage(`❌ Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5">
            <h2>Create Client User</h2>
            {message && (
                <div className={`alert ${message.startsWith('✅') ? 'alert-success' : 'alert-danger'}`}>
                    {message}
                </div>
            )}
            <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
                <div className="mb-3">
                    <label className="form-label">Client Name</label>
                    <input
                        type="text"
                        className="form-control"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Enter client username"
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Client Password</label>
                    <input
                        type="password"
                        className="form-control"
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Enter password"
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Department (Optional)</label>
                    <input
                        type="text"
                        className="form-control"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={loading}
                        placeholder="Enter department ID or leave blank"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? "Creating..." : "Create Client"}
                </button>
            </form>
        </div>
    );
};

export default CreateClientUser;
