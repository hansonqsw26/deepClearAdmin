import React, { useState } from "react";

const StepOne = ({ containerType, onCargoSubmit }) => {
    const [cargo, setCargo] = useState({
        number: "",
        length: "",
        width: "",
        height: "",
        weight: "",
        cargoNote: "",
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCargo((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleAddCargo = () => {
        if (!cargo.length || !cargo.width || !cargo.height || !cargo.weight) {
            alert("Please fill in all required fields.");
            return;
        }

        if (!containerType) {
            alert("Please select cargo type first.");
            return;
        }

        const cargoItem = {
            containerType,
            number: cargo.number ? parseInt(cargo.number) : null,
            length: parseFloat(cargo.length),
            width: parseFloat(cargo.width),
            height: parseFloat(cargo.height),
            weight: parseFloat(cargo.weight),
            cargoNote: cargo.cargoNote,
        };

        onCargoSubmit(cargoItem);

        setCargo({
            number: "",
            length: "",
            width: "",
            height: "",
            weight: "",
            cargoNote: "",
        });
    };

    return (
        <div>
            <h5 className="mb-3">Cargo Information</h5>

            <p>
                <strong>Cargo Type:</strong>{" "}
                {containerType === "1"
                    ? "Pallet"
                    : containerType === "2"
                        ? "Boxes"
                        : containerType === "3"
                            ? "Crea"
                            : "Not selected"}
            </p>

            <div className="d-flex justify-content-end mb-3">
                <button className="btn btn-success" onClick={handleAddCargo}>
                    Add Cargo Item
                </button>
            </div>

            <div className="row g-3">
                <div className="col-md-3">
                    <div className="mb-3">
                        <label className="form-label">Length (m)</label>
                        <input
                            type="number"
                            name="length"
                            className="form-control"
                            value={cargo.length}
                            onChange={handleChange}
                            placeholder="Length"
                            step="any"
                            required
                        />
                    </div>
                </div>

                <div className="col-md-3">
                    <div className="mb-3">
                        <label className="form-label">Width (m)</label>
                        <input
                            type="number"
                            name="width"
                            className="form-control"
                            value={cargo.width}
                            onChange={handleChange}
                            placeholder="Width"
                            step="any"
                            required
                        />
                    </div>
                </div>

                <div className="col-md-3">
                    <div className="mb-3">
                        <label className="form-label">Height (m)</label>
                        <input
                            type="number"
                            name="height"
                            className="form-control"
                            value={cargo.height}
                            onChange={handleChange}
                            placeholder="Height"
                            step="any"
                            required
                        />
                    </div>
                </div>

                <div className="col-md-3">
                    <div className="mb-3">
                        <label className="form-label">Weight (kg)</label>
                        <input
                            type="number"
                            name="weight"
                            className="form-control"
                            value={cargo.weight}
                            onChange={handleChange}
                            placeholder="Weight"
                            step="any"
                            required
                        />
                    </div>
                </div>
            </div>

            <div className="mb-3">
                <label className="form-label">Cargo Note (optional)</label>
                <textarea
                    name="cargoNote"
                    className="form-control"
                    value={cargo.cargoNote}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Any special notes about the cargo"
                />
            </div>
        </div>
    );
};

export default StepOne;
