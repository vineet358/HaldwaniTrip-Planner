import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import "leaflet/dist/leaflet.css";
import { fetchPOIData } from "../utils/fetchPOIData";



const MapContainer = dynamic(() => import("react-leaflet").then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });
const ZoomControl = dynamic(() => import("react-leaflet").then((mod) => mod.ZoomControl), { ssr: false });


let L;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

export default function MapComponent() {
  const [sourceCoords, setSourceCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [sourceName, setSourceName] = useState("");
  const [destName, setDestName] = useState("");
  const [routePath, setRoutePath] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([29.2183, 79.5152]); // Default: Haldwani
  const [mapZoom, setMapZoom] = useState(13);
  const [userName, setUserName] = useState("");
  
  // New state for points of interest
  const [pointsOfInterest, setPointsOfInterest] = useState([]);
  const [showPOI, setShowPOI] = useState(false);

  // Define default icon for markers
  const defaultIcon = L
    ? L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      })
    : null;
    
  // Define custom POI icons
  const poiIcons = L ? {
    restaurant: L.icon({
      iconUrl: "/icons/restaurant.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    }),
    hotel: L.icon({
      iconUrl: "/icons/hotel.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    }),
    hospital: L.icon({
      iconUrl: "/icons/hospital.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    }),
    default: L.icon({
      iconUrl: "/icons/poi.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })
  } : null;
  
  // Get icon based on POI type
  const getPOIIcon = (type) => {
    if (!L || !poiIcons) return defaultIcon;
    if (poiIcons[type]) return poiIcons[type];
    return poiIcons.default;
  };

    

  // Get coordinates for a place name using Nominatim
  const getCoordinates = async (placeName) => {
    try {
      // Use Nominatim geocoding API to convert place name to coordinates
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1`
      );

      if (response.data && response.data.length > 0) {
        const location = response.data[0];
        return {
          lat: parseFloat(location.lat),
          lon: parseFloat(location.lon),
          displayName: location.display_name
        };
      }
      throw new Error(`Location not found: ${placeName}`);
    } catch (error) {
      console.error(`Error finding coordinates for ${placeName}:`, error);
      throw error;
    }
  };

  // Get route between two points
  const getRoute = async (sourceCoord, destCoord, isShortestPath = false) => {
    try {
      // Use OSRM service to get route between coordinates
      // Use 'shortest' for distance-based routing, 'fastest' for time-based routing
      const routeType = isShortestPath ? 'shortest' : 'driving';
      
      const response = await axios.get(
        `https://router.project-osrm.org/route/v1/${routeType}/${sourceCoord.lon},${sourceCoord.lat};${destCoord.lon},${destCoord.lat}?overview=full&geometries=geojson`
      );

      if (response.data && response.data.routes && response.data.routes.length > 0) {
        // Convert coordinates from [lon, lat] to [lat, lon] for Leaflet
        return response.data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
      }
      throw new Error("Unable to calculate route between locations");
    } catch (error) {
      console.error("Error fetching route:", error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const source = params.get("source");
          const destination = params.get("destination");
          const username = params.get("name");
          const shortestPath = params.get("shortestPath") === "true";
          
          setUserName(username || "");
          setSourceName(source);
          setDestName(destination);

          if (!source || !destination) {
            throw new Error("Source and destination are required");
          }

          // Get coordinates for source and destination
          const sourceLocation = await getCoordinates(source);
          const destLocation = await getCoordinates(destination);

          // Set source and destination coordinates
          setSourceCoords([sourceLocation.lat, sourceLocation.lon]);
          setDestCoords([destLocation.lat, destLocation.lon]);

          // Calculate center point for map
          const centerLat = (sourceLocation.lat + destLocation.lat) / 2;
          const centerLon = (sourceLocation.lon + destLocation.lon) / 2;
          setMapCenter([centerLat, centerLon]);

          // Calculate appropriate zoom level based on distance
          const distance = calculateDistance(
            sourceLocation.lat, sourceLocation.lon,
            destLocation.lat, destLocation.lon
          );
          
          setMapZoom(getZoomLevel(distance));

          // Get route between source and destination
          const routeCoordinates = await getRoute(sourceLocation, destLocation);
          setRoutePath(routeCoordinates);
          
          // Fetch points of interest using the imported utility function
          const poisData = await fetchPOIData(
            sourceLocation.lat, 
            sourceLocation.lon, 
            destLocation.lat, 
            destLocation.lon
          );
          
          setPointsOfInterest(poisData);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error in map setup:", err);
        setError(err.message || "An error occurred while setting up the map");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  // Determine appropriate zoom level based on distance
  const getZoomLevel = (distance) => {
    if (distance > 100) return 8;
    if (distance > 50) return 9;
    if (distance > 20) return 10;
    if (distance > 10) return 11;
    if (distance > 5) return 12;
    if (distance > 2) return 13;
    if (distance > 1) return 14;
    return 15;
  };

  // Toggle points of interest visibility
  const togglePOI = () => {
    setShowPOI(!showPOI);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Finding the best route for you...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => window.history.back()}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="map-page">
      <div className="map-header">
        <h1>Your Route</h1>
        <div className="route-info">
          <p><strong>From:</strong> {sourceName}</p>
          <p><strong>To:</strong> {destName}</p>
          {userName && <p><strong>Traveler:</strong> {userName}</p>}
        </div>
        <div className="map-controls">
          <button 
            onClick={togglePOI} 
            className={`poi-toggle ${showPOI ? 'active' : ''}`}
          >
            {showPOI ? 'Hide Points of Interest' : 'Show Points of Interest'}
          </button>
          <button onClick={() => window.history.back()} className="back-button">
            ← Back to Planner
          </button>
        </div>
      </div>
      
      <div className="map-container">
        {sourceCoords && destCoords ? (
          <MapContainer 
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "600px", width: "100%" }}
          >
            <TileLayer 
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ZoomControl position="bottomright" />

            {/* Source Marker */}
            <Marker position={sourceCoords} icon={defaultIcon}>
              <Popup>
                <strong>📍 Starting Point:</strong><br />
                {sourceName}
              </Popup>
            </Marker>

            {/* Destination Marker */}
            <Marker position={destCoords} icon={defaultIcon}>
              <Popup>
                <strong>🏁 Destination:</strong><br />
                {destName}
              </Popup>
            </Marker>

            {/* Route Path */}
            {routePath.length > 0 && (
              <Polyline 
                positions={routePath} 
                color="#3388ff" 
                weight={5} 
                opacity={0.7} 
              />
            )}
            
            {/* Points of Interest */}
            {showPOI && pointsOfInterest.map((poi, index) => (
              <Marker 
                key={index} 
                position={poi.coordinates} 
                icon={getPOIIcon(poi.type)}
              >
                <Popup>
                  <div className="poi-popup">
                    <h4>{poi.name}</h4>
                    <p>Type: {poi.type}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="no-map-message">
            <p>No map data available. Please try a different route.</p>
          </div>
        )}
      </div>
      
      {/* POI Legend - displayed when POIs are visible */}
      {showPOI && pointsOfInterest.length > 0 && (
        <div className="poi-legend">
          <h3>Points of Interest</h3>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-icon restaurant"></div>
              <span>Restaurant</span>
            </div>
            <div className="legend-item">
              <div className="legend-icon hotel"></div>
              <span>Hotel</span>
            </div>
            <div className="legend-item">
              <div className="legend-icon hospital"></div>
              <span>Hospital</span>
            </div>
          </div>
          <p>Total POIs found: {pointsOfInterest.length}</p>
        </div>
      )}
      
      <style jsx>{`
        .map-page {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .map-header {
          margin-bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
        }
        
        .map-header h1 {
          margin: 0;
          font-size: 24px;
        }
        
        .route-info {
          flex-grow: 1;
          margin: 0 20px;
        }
        
        .route-info p {
          margin: 5px 0;
        }
        
        .map-controls {
          display: flex;
          gap: 10px;
        }
        
        .back-button, .poi-toggle {
          background-color: #f0f0f0;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          transition: background-color 0.2s;
        }
        
        .back-button:hover, .poi-toggle:hover {
          background-color: #e0e0e0;
        }
        
        .poi-toggle.active {
          background-color: #4CAF50;
          color: white;
        }
        
        .map-container {
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }
        
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
        }
        
        .loading-spinner {
          border: 5px solid #f3f3f3;
          border-top: 5px solid #3498db;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error-container {
          padding: 20px;
          background-color: #fff1f0;
          border: 1px solid #ffccc7;
          border-radius: 4px;
          margin: 20px 0;
        }
        
        .no-map-message {
          padding: 20px;
          text-align: center;
          background-color: #f9f9f9;
          border: 1px dashed #ccc;
          border-radius: 4px;
        }
        
        .error-container button {
          margin-top: 10px;
          background-color: #ff4d4f;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        
        .error-container button:hover {
          background-color: #ff7875;
        }
        
        .poi-legend {
          background-color: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          margin-top: 20px;
        }
        
        .poi-legend h3 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 18px;
        }
        
        .legend-items {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 10px;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .legend-icon {
          width: 20px;
          height: 20px;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }
        
        .legend-icon.restaurant {
          background-image: url('/icons/restaurant.png');
        }
        
        .legend-icon.hotel {
          background-image: url('/icons/hotel.png');
        }
        
        .legend-icon.hospital {
          background-image: url('/icons/hospital.png');
        }
        
        .poi-popup h4 {
          margin-top: 0;
          margin-bottom: 5px;
        }
        
        .poi-popup p {
          margin: 0;
        }
      `}</style>
    </div>
  );
}