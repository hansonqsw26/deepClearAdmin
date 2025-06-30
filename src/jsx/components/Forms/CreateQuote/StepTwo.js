import React, { useState } from "react";

const StepTwo = () => {
   const [cargo, setCargo] = useState({
      containerType: "",
      number: 0,
      length: 0,
      width: 0,
      height: 0,
      weight: 0,
      totalWeight: 0,
      totalVolume: 0,
      cargoNote: ""
   });

   const handleCargoChange = (e) => {
      const { name, value } = e.target;
      setCargo((prevCargo) => ({
         ...prevCargo,
         [name]: value,
      }));
   };

   return (
       <section>
          <h5>Cargo Information</h5>
          <div className="mb-3">
             <label className="form-label">Container Type</label>
             <input
                 type="text"
                 name="containerType"
                 className="form-control"
                 value={cargo.containerType}
                 onChange={handleCargoChange}
                 placeholder="Enter container type"
                 required
             />
          </div>
          <div className="mb-3">
             <label className="form-label">Number of Containers</label>
             <input
                 type="number"
                 name="number"
                 className="form-control"
                 value={cargo.number}
                 onChange={handleCargoChange}
                 placeholder="Number of containers"
                 required
             />
          </div>
          <div className="mb-3">
             <label className="form-label">Length (m)</label>
             <input
                 type="number"
                 name="length"
                 className="form-control"
                 value={cargo.length}
                 onChange={handleCargoChange}
                 placeholder="Length of container"
                 required
             />
          </div>
          <div className="mb-3">
             <label className="form-label">Width (m)</label>
             <input
                 type="number"
                 name="width"
                 className="form-control"
                 value={cargo.width}
                 onChange={handleCargoChange}
                 placeholder="Width of container"
                 required
             />
          </div>
          <div className="mb-3">
             <label className="form-label">Height (m)</label>
             <input
                 type="number"
                 name="height"
                 className="form-control"
                 value={cargo.height}
                 onChange={handleCargoChange}
                 placeholder="Height of container"
                 required
             />
          </div>
          <div className="mb-3">
             <label className="form-label">Weight (kg)</label>
             <input
                 type="number"
                 name="weight"
                 className="form-control"
                 value={cargo.weight}
                 onChange={handleCargoChange}
                 placeholder="Weight of container"
                 required
             />
          </div>
          <div className="mb-3">
             <label className="form-label">Cargo Note</label>
             <textarea
                 name="cargoNote"
                 className="form-control"
                 value={cargo.cargoNote}
                 onChange={handleCargoChange}
                 rows="3"
                 placeholder="Enter any special notes about the cargo"
             />
          </div>
       </section>
   );
};

export default StepTwo;
