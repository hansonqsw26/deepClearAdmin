import React, { useState } from "react";

const CreateAdminUser = () => {
    const [adminName, setAdminName] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [department, setDepartment] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const res = await fetch("https://deepclear.ca/api/admin/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    admin_name: adminName,
                    admin_password: adminPassword,
                    department: department || null
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText);
            }

            const data = await res.json();
            setMessage(`✅ Success! Admin created: ${data.adminName} (ID: ${data.adminId})`);
            setAdminName("");
            setAdminPassword("");
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
            <h2>Create Admin User</h2>
            {message && (
                <div className={`alert ${message.startsWith('✅') ? 'alert-success' : 'alert-danger'}`}>
                    {message}
                </div>
            )}
            <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
                <div className="mb-3">
                    <label className="form-label">Admin Name</label>
                    <input
                        type="text"
                        className="form-control"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Enter admin username"
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Admin Password</label>
                    <input
                        type="password"
                        className="form-control"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="Enter password"
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Department</label>
                    <select
                        className="form-select"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={loading}
                        required
                    >
                        <option value="">Select Department</option>
                        <option value="1">Deep Clear Office</option>
                        <option value="2">Truck Company</option>
                    </select>
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? "Creating..." : "Create Admin"}
                </button>
            </form>
        </div>
    );
};

export default CreateAdminUser;
