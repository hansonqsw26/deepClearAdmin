import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function useQuery() {
    return new URLSearchParams(useLocation().search);
}

const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"];

const CustomsTicketDetails = () => {
    const query = useQuery();
    const mainId = query.get("main_id");
    const cbId = query.get("cb_id");
    const navigate = useNavigate();

    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({});
    const [message, setMessage] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    // --- FILE STATES ---
    const [files, setFiles] = useState({
        "draft cad": [],
        "release cad": [],
        bol: [],
        emf: [],
    });
    const [filesLoading, setFilesLoading] = useState(false);

    const [selectedDraftFile, setSelectedDraftFile] = useState(null);
    const [selectedReleaseFile, setSelectedReleaseFile] = useState(null);
    const [uploadingDraft, setUploadingDraft] = useState(false);
    const [uploadingRelease, setUploadingRelease] = useState(false);

    // --- FETCH TICKET ---
    const fetchTicket = async () => {
        if (!mainId) return;
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
            console.error(err);
            setError("Failed to fetch ticket details.");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTicket();
    }, [mainId]);

    // --- FETCH FILES (GENERALIZED) ---
    const fetchFiles = async (fileType) => {
        if (!cbId || !ticket?.container_number) return;
        setFilesLoading(true);
        try {
            const res = await fetch("https://deepclear.ca/api/admin/getFiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticket_id: cbId,
                    container_number: ticket.container_number,
                    file_type: fileType
                }),
            });
            const data = await res.json();
            let filesArray = [];
            if (res.ok && data.files) filesArray = Array.isArray(data.files) ? data.files : [data.files];

            setFiles(prev => ({ ...prev, [fileType]: filesArray }));
        } catch (err) {
            console.error(err);
            setFiles(prev => ({ ...prev, [fileType]: [] }));
        }
        setFilesLoading(false);
    };

    // --- Fetch all file types when ticket is loaded ---
    useEffect(() => {
        if (ticket?.container_number) {
            ["draft cad", "release cad", "bol", "emf"].forEach(ft => fetchFiles(ft));
        }
    }, [ticket]);

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
                ["draft cad", "release cad"].forEach(ft => fetchFiles(ft)); // only refresh editable files
            } else {
                setMessage(`Update failed: ${data.error || "Unknown error"}`);
            }
        } catch (err) {
            console.error(err);
            setMessage("Network or server error.");
        }
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            alert("Invalid file type. Only PDF, Word, Excel, PNG, JPG, JPEG are allowed.");
            e.target.value = ""; // Reset input
            return;
        }

        if (type === "draft") setSelectedDraftFile(file);
        if (type === "release") setSelectedReleaseFile(file);
    };

    const refreshTicket = async () => await fetchTicket();

    const handleUpload = async (fileType) => {
        if (!ticket?.container_number) return alert("Ticket info missing. Please wait until ticket is loaded.");

        const selectedFile = fileType === "draft cad" ? selectedDraftFile : selectedReleaseFile;
        if (!selectedFile) return alert("Please select a file first.");

        if (fileType === "draft cad") setUploadingDraft(true);
        if (fileType === "release cad") setUploadingRelease(true);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append("file", selectedFile);
            formDataToSend.append("ticket_id", cbId);
            formDataToSend.append("container_number", ticket.container_number);
            formDataToSend.append("file_type", fileType);

            const res = await fetch("https://deepclear.ca/api/admin/uploadFile", {
                method: "POST",
                body: formDataToSend,
            });
            const data = await res.json();

            if (res.ok) {
                alert(`${fileType} file uploaded successfully!`);
                if (fileType === "draft cad") setSelectedDraftFile(null);
                if (fileType === "release cad") setSelectedReleaseFile(null);

                await refreshTicket();
                fetchFiles(fileType);
            } else {
                alert(`Upload failed: ${data.error || "Unknown error"}`);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to upload file.");
        }

        if (fileType === "draft cad") setUploadingDraft(false);
        if (fileType === "release cad") setUploadingRelease(false);
    };

    if (loading) return <p>Loading ticket details...</p>;
    if (error) return (
        <div>
            <p className="text-danger">{error}</p>
            <button className="btn btn-secondary" onClick={() => navigate("/customs-tickets-list")}>Back</button>
        </div>
    );
    if (!ticket) return null;

    return (
        <div className="container my-4">
            <button className="btn btn-secondary mb-3" onClick={() => navigate("/customs-tickets-list")}>Back to List</button>
            <h2>Customs Ticket Details (Main ID: {mainId})</h2>

            {!isEditing ? (
                <button className="btn btn-warning mb-3" onClick={() => setIsEditing(true)}>Edit</button>
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
                }}>Cancel Edit</button>
            )}

            <form onSubmit={handleSubmit}>
                <div className="row g-3">
                    {/* --- Ticket fields --- */}
                    <div className="col-md-4">
                        <label>Container Number</label>
                        <input type="text" name="container_number" className="form-control"
                               value={formData.container_number} onChange={handleChange} readOnly={!isEditing} />
                    </div>
                    <div className="col-md-4">
                        <label>Customs Status</label>
                        <select name="cb_status" className="form-control" value={formData.cb_status} onChange={handleChange} disabled={!isEditing}>
                            <option value="0">Not Submitted</option>
                            <option value="1">Submitted</option>
                            <option value="2">Release</option>
                            <option value="3">Exam</option>
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label>CAD Status</label>
                        <select name="cad_status" className="form-control" value={formData.cad_status} disabled>
                            <option value="0">Not Uploaded</option>
                            <option value="1">Uploaded</option>
                            <option value="2">Confirmed</option>
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label>Transaction Number</label>
                        <input type="text" name="transaction_number" className="form-control" value={formData.transaction_number} onChange={handleChange} readOnly={!isEditing} />
                    </div>
                    <div className="col-md-4">
                        <label>Status</label>
                        <select name="status" className="form-control" value={formData.status} onChange={handleChange} disabled={!isEditing}>
                            <option value="0">Reviewing</option>
                            <option value="1">Processing</option>
                            <option value="2">Finished</option>
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label>Destination</label>
                        <input type="text" name="destination" className="form-control" value={formData.destination} onChange={handleChange} readOnly={!isEditing} />
                    </div>
                    <div className="col-md-4">
                        <label>ETA</label>
                        <input type="datetime-local" name="eta" className="form-control" value={formData.eta} onChange={handleChange} readOnly={!isEditing} />
                    </div>
                    <div className="col-md-12">
                        <label>Note</label>
                        <textarea name="note" className="form-control" value={formData.note} onChange={handleChange} readOnly={!isEditing} />
                    </div>
                </div>

                {isEditing && <button type="submit" className="btn btn-primary mt-3">Save Changes</button>}
                {message && <p className="mt-3">{message}</p>}
            </form>

            {/* --- FILE SECTIONS --- */}
            {["draft cad", "release cad", "bol", "emf"].map(ft => (
                <div key={ft}>
                    <hr />
                    <h4>{ft.toUpperCase()} Files</h4>
                    {files[ft].length === 0 ? <p>No {ft} files.</p> :
                        <div className="list-group mb-3">
                            {files[ft].map(file => (
                                <a key={file.file_id} href={file.file_link} target="_blank" rel="noopener noreferrer" className="list-group-item list-group-item-action">
                                    {file.file_name || "Unnamed file"}
                                </a>
                            ))}
                        </div>
                    }
                    {/* Only Draft/Release CAD allow uploads */}
                    {(ft === "draft cad" || ft === "release cad") && (
                        <div className="input-group mb-3">
                            <input type="file" className="form-control" onChange={(e) => handleFileChange(e, ft === "draft cad" ? "draft" : "release")}
                                   disabled={ft === "draft cad" ? uploadingDraft : uploadingRelease} />
                            <button className="btn btn-primary" type="button" onClick={() => handleUpload(ft)}
                                    disabled={ft === "draft cad" ? uploadingDraft || !selectedDraftFile : uploadingRelease || !selectedReleaseFile}>
                                {ft === "draft cad" ? (uploadingDraft ? "Uploading..." : "Upload Draft CAD") :
                                    (uploadingRelease ? "Uploading..." : "Upload Release CAD")}
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default CustomsTicketDetails;
