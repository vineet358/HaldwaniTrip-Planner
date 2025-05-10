import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";

export default function SelectRoute() {
  const router = useRouter();
  const [locations, setLocations] = useState([]);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    axios
      .get("http://localhost:3000/api/locations")
      .then((res) => {
        const placeNames = res.data
          .map((loc) => loc.properties.name)
          .filter((name) => name); 
        setLocations(placeNames);
      })
      .catch((err) => console.error("Error fetching locations:", err));
  }, []);

  const handleSubmit = () => {
    if (source && destination) {
      router.push(`/map?source=${source}&destination=${destination}`);
    } else {
      alert("Please select both source and destination.");
    }
  };

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Select Your Route</h1>

      <label>Source:</label>
      <select value={source} onChange={(e) => setSource(e.target.value)}>
        <option value="">Select Source</option>
        {locations.map((loc, index) => (
          <option key={index} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      <br />

      <label>Destination:</label>
      <select value={destination} onChange={(e) => setDestination(e.target.value)}>
        <option value="">Select Destination</option>
        {locations.map((loc, index) => (
          <option key={index} value={loc}>
            {loc}
          </option>
        ))}
      </select>

      <br />
      <button onClick={handleSubmit} style={{ marginTop: "10px", padding: "10px" }}>
        Show Route
      </button>
    </div>
  );
}
