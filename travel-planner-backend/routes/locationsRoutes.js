const express = require("express");
const axios = require("axios");

const router = express.Router();

// New route to fetch dynamic locations between source & destination
router.post("/fetch-locations", async (req, res) => {
  try {
    console.log("Fetch locations endpoint called"); // Log to confirm route is being hit
    
    // 1. Get source and destination from request body
    const { source, destination } = req.body;

    if (!source || !destination) {
      return res.status(400).json({ message: "Source and destination are required." });
    }

    // 2. Calculate bounding box (min/max lat & lng)
    const minLat = Math.min(source[0], destination[0]);
    const maxLat = Math.max(source[0], destination[0]);
    const minLng = Math.min(source[1], destination[1]);
    const maxLng = Math.max(source[1], destination[1]);

    // 3. Define Overpass API query with dynamic bounding box
    const overpassQuery = `
      [out:json];
      (
        node["amenity"~"restaurant|hotel|hospital"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out;
    `;

    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    // 4. Fetch data from Overpass API
    const response = await axios.get(overpassUrl);

    // 5. Check if data exists
    if (!response.data || !response.data.elements) {
      return res.status(404).json({ message: "No locations found." });
    }

    // 6. Format response (convert data to desired format)
    const locations = response.data.elements.map((element) => ({
      name: element.tags.name || "Unknown",
      type: element.tags.amenity || "Unknown",
      coordinates: [element.lat, element.lon],
    }));

    // 7. Return formatted data to frontend
    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error.message);
    res.status(500).json({ message: "Error fetching locations", error });
  }
});

module.exports = router;