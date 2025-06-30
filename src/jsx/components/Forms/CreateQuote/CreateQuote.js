import React, { useState } from "react";
import { Stepper, Step } from "react-form-stepper";
import PageTitle from "../../../layouts/PageTitle";
import { createQuote } from "../../../../helper/quoteApi/quoteApi";
import StepOne from "./StepOne";
import { useNavigate } from "react-router-dom";

const CreateQuote = () => {
	const [goSteps, setGoSteps] = useState(0);

	// Address fields split
	const [pickupCity, setPickupCity] = useState("");
	const [pickupStreet, setPickupStreet] = useState("");
	const [pickupPostcode, setPickupPostcode] = useState("");

	const [arrivalCity, setArrivalCity] = useState("");
	const [arrivalStreet, setArrivalStreet] = useState("");
	const [arrivalPostcode, setArrivalPostcode] = useState("");

	const [cargoType, setCargoType] = useState("");
	const [cargoItems, setCargoItems] = useState([]);
	const [quoteNote, setQuoteNote] = useState("");

	const navigate = useNavigate();

	const handleAddCargo = (newCargo) => {
		setCargoItems((prev) => [...prev, newCargo]);
	};

	const handleNext = () => {
		if (
			!pickupCity ||
			!pickupStreet ||
			!pickupPostcode ||
			!arrivalCity ||
			!arrivalStreet ||
			!arrivalPostcode ||
			!cargoType
		) {
			alert("Please fill in all address fields and select cargo type.");
			return;
		}
		setGoSteps(goSteps + 1);
	};

	const handlePrev = () => {
		setGoSteps(goSteps - 1);
	};

	const handleSubmit = async () => {
		if (cargoItems.length === 0) {
			alert("Please add at least one cargo item.");
			return;
		}

		const pickupAddress = `${pickupStreet}, ${pickupCity}, ${pickupPostcode}`;
		const arrivalAddress = `${arrivalStreet}, ${arrivalCity}, ${arrivalPostcode}`;

		const data = {
			departure_address: pickupAddress,
			arrival_address: arrivalAddress,
			quote_note: quoteNote,
			cargo_items: cargoItems.map((item) => ({
				cargo_type: parseInt(item.containerType),
				number: item.number ? parseInt(item.number) : null,
				length: parseFloat(item.length),
				width: parseFloat(item.width),
				height: parseFloat(item.height),
				weight: parseFloat(item.weight),
				cargoNote: item.cargoNote,
			})),
		};

		try {
			await createQuote(data);
			alert("Quote created successfully!");
			navigate("/quote-list");
		} catch (error) {
			alert(`Error: ${error.message || "Failed to create quote"}`);
		}
	};

	return (
		<div>
			<PageTitle activeMenu="Components" motherMenu="Home" />

			<div className="row">
				<div className="col-xl-12 col-xxl-12">
					<div className="card">
						<div className="card-header">
							<h4 className="card-title">Create a Quote</h4>
						</div>
						<div className="card-body">
							<div className="form-wizard">
								<Stepper
									activeStep={goSteps}
									styleConfig={{
										activeBgColor: '#28a745',  // Bootstrap green
										activeTextColor: '#ffffff',
										completedBgColor: '#28a745',
										completedTextColor: '#ffffff'
									}}
									connectorStyleConfig={{
										activeColor: '#28a745',
										completedColor: '#28a745'
									}}
								>
									<Step onClick={() => setGoSteps(0)} />
									<Step onClick={() => setGoSteps(1)} />
								</Stepper>

								{goSteps === 0 && (
									<>
										<h5 className="mt-4">Pickup Address</h5>
										<div className="mb-3">
											<label>City</label>
											<input
												type="text"
												className="form-control"
												value={pickupCity}
												onChange={(e) => setPickupCity(e.target.value)}
												placeholder="Enter city"
											/>
										</div>
										<div className="mb-3">
											<label>Street</label>
											<input
												type="text"
												className="form-control"
												value={pickupStreet}
												onChange={(e) => setPickupStreet(e.target.value)}
												placeholder="Enter street"
											/>
										</div>
										<div className="mb-3">
											<label>Postcode</label>
											<input
												type="text"
												className="form-control"
												value={pickupPostcode}
												onChange={(e) => setPickupPostcode(e.target.value)}
												placeholder="Enter postcode"
											/>
										</div>

										<h5 className="mt-4">Arrival Address</h5>
										<div className="mb-3">
											<label>City</label>
											<input
												type="text"
												className="form-control"
												value={arrivalCity}
												onChange={(e) => setArrivalCity(e.target.value)}
												placeholder="Enter city"
											/>
										</div>
										<div className="mb-3">
											<label>Street</label>
											<input
												type="text"
												className="form-control"
												value={arrivalStreet}
												onChange={(e) => setArrivalStreet(e.target.value)}
												placeholder="Enter street"
											/>
										</div>
										<div className="mb-3">
											<label>Postcode</label>
											<input
												type="text"
												className="form-control"
												value={arrivalPostcode}
												onChange={(e) => setArrivalPostcode(e.target.value)}
												placeholder="Enter postcode"
											/>
										</div>

										<div className="mb-3">
											<label>Cargo Type</label>
											<select
												className="form-control"
												value={cargoType}
												onChange={(e) => setCargoType(e.target.value)}
											>
												<option value="">Select Cargo Type</option>
												<option value="1">Pallet</option>
												<option value="2">Boxes</option>
												<option value="3">Crea</option>
											</select>
										</div>

										<div className="text-end toolbar toolbar-bottom p-2">
											<button
												className="btn btn-primary"
												onClick={handleNext}
												disabled={
													!pickupCity ||
													!pickupStreet ||
													!pickupPostcode ||
													!arrivalCity ||
													!arrivalStreet ||
													!arrivalPostcode ||
													!cargoType
												}
											>
												Next
											</button>
										</div>
									</>
								)}

								{goSteps === 1 && (
									<>
										<StepOne containerType={cargoType} onCargoSubmit={handleAddCargo} />

										<div className="mb-3 mt-3">
											<label>Quote Note</label>
											<input
												type="text"
												className="form-control"
												value={quoteNote}
												onChange={(e) => setQuoteNote(e.target.value)}
												placeholder="Enter any quote-specific note"
											/>
										</div>

										<h5>Current Cargo Items:</h5>
										<ul>
											{cargoItems.map((item, index) => (
												<li key={index}>
													Cargo Type:{" "}
													{item.containerType === "1"
														? "Pallet"
														: item.containerType === "2"
															? "Boxes"
															: "Crea"}, Dimensions:{" "}
													{item.length} x {item.width} x {item.height} m, Weight:{" "}
													{item.weight} kg, Note: {item.cargoNote || "-"}
												</li>
											))}
										</ul>

										<div className="text-end toolbar toolbar-bottom p-2">
											<button className="btn btn-secondary me-1" onClick={handlePrev}>
												Prev
											</button>
											<button
												className="btn btn-success ms-1"
												onClick={handleSubmit}
												disabled={cargoItems.length === 0}
											>
												Submit
											</button>
										</div>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CreateQuote;
