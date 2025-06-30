import React, { useState } from "react";

const StepThree = ({ containerType, onCargoSubmit }) => {
    const [cargo, setCargo] = useState({
        number: "", // optional
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
            alert("Please select container type first.");
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
            <h5>Cargo Information</h5>

            <p>
                <strong>Container Type:</strong>{" "}
                {containerType === "1"
                    ? "Pallet"
                    : containerType === "2"
                        ? "Boxes"
                        : containerType === "3"
                            ? "Crea"
                            : "Not selected"}
            </p>

            {/*<div className="mb-3">*/}
            {/*    <label>Quantity (optional)</label>*/}
            {/*    <input*/}
            {/*        type="number"*/}
            {/*        name="number"*/}
            {/*        className="form-control"*/}
            {/*        value={cargo.number}*/}
            {/*        onChange={handleChange}*/}
            {/*        placeholder="Quantity"*/}
            {/*        min="1"*/}
            {/*    />*/}
            {/*</div>*/}

            <div className="mb-3">
                <label>Length (m)</label>
                <input
                    type="number"
                    name="length"
                    className="form-control"
                    value={cargo.length}
                    onChange={handleChange}
                    placeholder="Length"
                    required
                    step="any"
                />
            </div>

            <div className="mb-3">
                <label>Width (m)</label>
                <input
                    type="number"
                    name="width"
                    className="form-control"
                    value={cargo.width}
                    onChange={handleChange}
                    placeholder="Width"
                    required
                    step="any"
                />
            </div>

            <div className="mb-3">
                <label>Height (m)</label>
                <input
                    type="number"
                    name="height"
                    className="form-control"
                    value={cargo.height}
                    onChange={handleChange}
                    placeholder="Height"
                    required
                    step="any"
                />
            </div>

            <div className="mb-3">
                <label>Weight (kg)</label>
                <input
                    type="number"
                    name="weight"
                    className="form-control"
                    value={cargo.weight}
                    onChange={handleChange}
                    placeholder="Weight"
                    required
                    step="any"
                />
            </div>

            <div className="mb-3">
                <label>Cargo Note (optional)</label>
                <textarea
                    name="cargoNote"
                    className="form-control"
                    value={cargo.cargoNote}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any special notes about the cargo"
                />
            </div>

            <button className="btn btn-success" onClick={handleAddCargo}>
                Add Cargo Item
            </button>
        </div>
    );
};

export default StepThree;
