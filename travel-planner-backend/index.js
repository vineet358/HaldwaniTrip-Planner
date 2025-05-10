const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { findShortestPath } = require('./utils/dijkstra');

// Import the locations router
const locationsRoutes = require('./routes/locationsRoutes');

const app = express();
app.use(express.json());
app.use(cors());


// Mount the locations router - This connects your router to the main app
app.use("/api", locationsRoutes);

// Base OSM Overpass API URL
const OSM_API_URL = "https://overpass-api.de/api/interpreter";

// Enhanced function to create Overpass query with expanded bounding box
function createOverpassQuery(source, destination, bufferKm = 0.5) {
  // Calculate raw bounding box
  const minLat = Math.min(source[0], destination[0]);
  const maxLat = Math.max(source[0], destination[0]);
  const minLng = Math.min(source[1], destination[1]);
  const maxLng = Math.max(source[1], destination[1]);
  
  // Add buffer (roughly convert km to degrees - this is approximate)
  const latBuffer = bufferKm / 111; // ~111km per degree of latitude
  const lngBuffer = bufferKm / (111 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180)); // longitude degrees vary by latitude
  
  // Apply buffer to bounding box
  const bufferedMinLat = minLat - latBuffer;
  const bufferedMaxLat = maxLat + latBuffer;
  const bufferedMinLng = minLng - lngBuffer;
  const bufferedMaxLng = maxLng + lngBuffer;
  
  // Create the query with the buffered bounding box
  return `
    [out:json];
    (
      way["highway"]["highway"!~"footway|path|cycleway|service|track"](${bufferedMinLat},${bufferedMinLng},${bufferedMaxLat},${bufferedMaxLng});
      node(w);
    );
    out body;
  `;
}

// Enhanced route endpoint with better error handling
app.post("/api/route", async (req, res) => {
  try {
    const { source, destination } = req.body;

    if (!source || !destination) {
      return res.status(400).json({ message: "Source and destination are required." });
    }
    
    console.log(`Calculating route from [${source}] to [${destination}]`);
    
    // Create an enhanced Overpass query with 1km buffer
    const overpassQuery = createOverpassQuery(source, destination, 1.0);
    
    // Log the query for debugging
    console.log("Using Overpass query:", overpassQuery);

    const response = await axios.get(`${OSM_API_URL}?data=${encodeURIComponent(overpassQuery)}`);
    
    if (!response.data || !response.data.elements || response.data.elements.length === 0) {
      return res.status(404).json({ message: "No roads found in the area. Try expanding search area." });
    }

    const nodes = {};
    const edges = {};

    // Parse nodes from response
    response.data.elements.forEach((element) => {
      if (element.type === "node") {
        nodes[element.id] = {
          lat: element.lat,
          lon: element.lon,
        };
      }
    });
    
    // Parse edges from response
    response.data.elements.forEach((element) => {
      if (element.type === "way" && element.nodes && element.nodes.length > 1) {
        for (let i = 0; i < element.nodes.length - 1; i++) {
          const nodeA = element.nodes[i];
          const nodeB = element.nodes[i + 1];
          
          // Skip if either node is missing
          if (!nodes[nodeA] || !nodes[nodeB]) continue;

          const distance = getDistance(nodes[nodeA], nodes[nodeB]);

          if (!edges[nodeA]) edges[nodeA] = [];
          if (!edges[nodeB]) edges[nodeB] = [];

          edges[nodeA].push({ node: nodeB, distance });
          edges[nodeB].push({ node: nodeA, distance });
        }
      }
    });
    
    console.log(`Found ${Object.keys(nodes).length} nodes and ${Object.keys(edges).length} edges`);
    
    if (Object.keys(nodes).length === 0 || Object.keys(edges).length === 0) {
      return res.status(404).json({ 
        message: "Insufficient road network data in the selected area.",
        detail: "Try selecting locations in more developed areas or increasing the search radius." 
      });
    }

    // Run Dijkstra's algorithm to calculate shortest path
    const startNode = findNearestNode(source, nodes);
    const endNode = findNearestNode(destination, nodes);

    if (!startNode) {
      return res.status(404).json({ 
        message: "No valid location found near the starting point.",
        detail: "Try selecting a starting point closer to a road."
      });
    }
    
    if (!endNode) {
      return res.status(404).json({ 
        message: "No valid location found near the destination.",
        detail: "Try selecting a destination closer to a road."
      });
    }

    if (!edges[startNode] || !edges[endNode]) {
      return res.status(404).json({ 
        message: "The selected locations are not connected to the road network.",
        detail: "Try selecting locations closer to connected roads."
      });
    }

    // Use the imported findShortestPath function instead of dijkstra
    const result = findShortestPath(edges, startNode, endNode);
    
    if (!result || !result.path || result.path.length < 2) {
      return res.status(404).json({ 
        message: "No valid route found between the selected locations.",
        detail: "The locations may be separated by impassable terrain or disconnected road networks."
      });
    }

    // Format path to return coordinates
    const pathCoordinates = result.path.map((node) => ({
      lat: nodes[node].lat,
      lon: nodes[node].lon,
    }));

    res.json({ 
      path: pathCoordinates,
      distance: result.distance,
      nodeCount: result.path.length
    });
  } catch (error) {
    console.error("Error fetching route:", error);
    res.status(500).json({ 
      message: "Error calculating route", 
      error: error.message,
      stack: typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Helper function to calculate distance between two nodes
function getDistance(nodeA, nodeB) {
  const R = 6371; // Radius of Earth in km
  const dLat = ((nodeB.lat - nodeA.lat) * Math.PI) / 180;
  const dLon = ((nodeB.lon - nodeA.lon) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nodeA.lat * Math.PI) / 180) *
      Math.cos((nodeB.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Enhanced findNearestNode function with distance threshold
function findNearestNode(coords, nodes, maxDistanceKm = 2) {
  let nearestNode = null;
  let minDist = Infinity;

  for (const nodeId in nodes) {
    const distance = getDistance(
      { lat: coords[0], lon: coords[1] },
      nodes[nodeId]
    );

    if (distance < minDist) {
      minDist = distance;
      nearestNode = nodeId;
    }
  }

  // Check if the nearest node is within a reasonable distance
  if (minDist > maxDistanceKm) {
    console.log(`Nearest node is too far (${minDist.toFixed(2)}km). Increase search area.`);
    return null;
  }
  
  console.log(`Found nearest node at distance: ${minDist.toFixed(2)}km`);
  return nearestNode;
}

// Start the server
app.listen(3000, () => console.log("🚀 Server running on port 3000"));