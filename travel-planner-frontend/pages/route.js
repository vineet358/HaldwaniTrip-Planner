// pages/route.js
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";

// Use dynamic import for the Map component to ensure it loads client-side only
const Map = dynamic(() => import("../src/components/Map"), { ssr: false });

export default function RoutePage() {
  const router = useRouter();
  const { source, destination } = router.query;
  
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPOICategory, setSelectedPOICategory] = useState("all");
  const [transportMode, setTransportMode] = useState('car');
  
  // Redirect to home if source or destination is missing
  useEffect(() => {
    if (router.isReady && (!source || !destination)) {
      const redirectTimer = setTimeout(() => router.push('/'), 2000);
      return () => clearTimeout(redirectTimer);
    }
  }, [router, source, destination]);

  // Generate route data when source, destination, or optimization preference changes
  useEffect(() => {
    if (source && destination) {
      setLoading(true);
      fetchRouteData(source, destination, 'distance', transportMode);
    }
  }, [source, destination, transportMode]);

  // Function to geocode location names to coordinates using OpenRouteService
  const geocodeLocation = async (locationName) => {
    try {
      const API_KEY = '5b3ce3597851110001cf62483af92f8f1bc04a3fae4b61c61b1a43e1';
      
      const response = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(locationName)}&boundary.rect.min_lon=79.45&boundary.rect.min_lat=29.18&boundary.rect.max_lon=79.58&boundary.rect.max_lat=29.31`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        throw new Error(`Location "${locationName}" not found`);
      }
      
      const coordinates = data.features[0].geometry.coordinates;
      
      return {
        lat: coordinates[1],
        lng: coordinates[0],
        displayName: data.features[0].properties.label || locationName
      };
    } catch (error) {
      console.error(`Error geocoding "${locationName}":`, error);
      throw error;
    }
  };
  

  // Function to fetch POIs along route using Overpass API
  const fetchPOIsAlongRoute = async (routeGeometry, bufferDistance = 0.01) => {
    try {
      // Extract key points from route geometry to reduce query complexity
      // Take points at regular intervals (e.g., every 10th point)
      const keyPoints = routeGeometry.coordinates.filter((_, index) => index % 10 === 0);
      
      // Prepare Overpass QL query for multiple POI types
      const poiTypes = {
        restaurants: ['node["amenity"="restaurant"]', 'node["amenity"="cafe"]', 'node["amenity"="fast_food"]'],
        hospitals: ['node["amenity"="hospital"]', 'node["amenity"="clinic"]'],
        atms: ['node["amenity"="atm"]', 'node["amenity"="bank"]']
      };
      
      const overpassQueries = {};
      
      // Build a query for each POI category
      for (const [category, typeQueries] of Object.entries(poiTypes)) {
        let query = '[out:json];(';
        
        // Add area around each key point to the query
        keyPoints.forEach(point => {
          const [lng, lat] = point;
          typeQueries.forEach(typeQuery => {
            query += `${typeQuery}(around:${bufferDistance * 111000},${lat},${lng});`;
          });
        });
        
        query += ');out body;';
        overpassQueries[category] = query;
      }
      
      // Execute each query and process results
      const poiResults = {};
      
      // For each category, fetch POIs
      for (const [category, query] of Object.entries(overpassQueries)) {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${category} POIs`);
        }
        
        const data = await response.json();
        
        // Initialize uniquePOIs as an object
        const uniquePOIs = {};
        
        // First pass: collect all unique POIs
        data.elements.forEach(element => {
          // Skip if we already have this POI
          if (uniquePOIs[element.id]) return;
          
          // Get name (use a default if not available)
          const name = element.tags.name || 
                    (category === 'restaurants' ? 'Restaurant' : 
                    category === 'hospitals' ? 'Hospital' : 'ATM');
          
          // Calculate distance from route start
          const startPoint = routeGeometry.coordinates[0];
          const poiDistance = calculateDistance(
            [startPoint[1], startPoint[0]],
            [element.lat, element.lon]
          );
          
          // Add to our collection as an object
          uniquePOIs[element.id] = {
            id: element.id,
            name: name,
            coords: [element.lat, element.lon],
            distance: poiDistance.toFixed(1),
            // Estimate time based on distance and average speed
            time: Math.round((poiDistance / 40) * 60) // time in minutes
          };
        });
        
        // Convert object to array and sort by distance
        poiResults[category] = Object.values(uniquePOIs)
          .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance))
          .slice(0, 5); // Limit to 5 POIs per category
      }
      
      return poiResults;
    } catch (error) {
      console.error("Error fetching POIs:", error);
      return {
        restaurants: [],
        hospitals: [],
        atms: []
      };
    }
  };

  // Function to calculate distance between two points in km
  const calculateDistance = (point1, point2) => {
    // Convert degrees to radians
    const toRad = (deg) => deg * Math.PI / 180;
    
    const lat1 = toRad(point1[0]);
    const lon1 = toRad(point1[1]);
    const lat2 = toRad(point2[0]);
    const lon2 = toRad(point2[1]);
    
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
  };

  // Function to fetch route data from OpenRouteService API
  const fetchRouteData = async (source, destination, optimizationPreference='distance', transportMode='car') => {
    try {
      // Step 1: Convert source and destination to coordinates (geocoding)
      const sourceCoords = await geocodeLocation(source);
      const destCoords = await geocodeLocation(destination);
      
      // Step 2: Map transport mode to ORS profile
      let profile;
      switch(transportMode) {
        case 'bike':
          profile = 'cycling-regular';
          break;
        case 'foot':
          profile = 'foot-walking';
          break;
        case 'car':
        default:
          profile = 'driving-car';
      }
      
      // Step 3: Set up preference for optimization
      const preference = 'shortest';
      
      // Step 4: Call OpenRouteService API for directions
      const API_KEY = '5b3ce3597851110001cf62483af92f8f1bc04a3fae4b61c61b1a43e1';
      
      const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;
      const headers = {
        'Authorization': `5b3ce3597851110001cf62483af92f8f1bc04a3fae4b61c61b1a43e1`,
        'Content-Type': 'application/json; charset=utf-8'
      };
      
      const requestBody = {
        coordinates: [
          [sourceCoords.lng, sourceCoords.lat],
          [destCoords.lng, destCoords.lat]
        ],
        preference: preference,
        format: 'geojson',
        instructions: true
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get route data: ${errorText}`);
      }
      
      const data = await response.json();
      
      // Step 5: Process the response
      if (!data.features || data.features.length === 0) {
        throw new Error('No route found between these locations');
      }

      let route;
if (optimizationPreference === 'distance') {
  // Find the route with the truly shortest distance
  const routes = data.features.map(feature => ({
    route: feature,
    distance: feature.properties.summary.distance
  }));
  
  // Sort by distance and pick the shortest one
  routes.sort((a, b) => a.distance - b.distance);
  route = routes[0].route;
} else {
  // For time-based optimization, use the first route which should be the fastest
  route = data.features[0];
}
      
      
      const properties = route.properties;
      const segments = properties.segments;
      
      // Extract distance and duration from the route response
      const distance = parseFloat((properties.summary.distance / 1000).toFixed(1)); // Convert meters to kilometers
      let duration = Math.round(properties.summary.duration / 60); // Convert seconds to minutes
      
      // Adjust duration if needed for specific transport modes
      if (transportMode === 'bike' && optimizationPreference === 'distance') {
        // Average bike speed of 15 km/h for distance optimization
        duration = Math.round((distance / 15) * 60);
      } else if (transportMode === 'foot' && optimizationPreference === 'distance') {
        // Average walking speed of 5 km/h for distance optimization
        duration = Math.round((distance / 5) * 60);
      }
      
      // Extract waypoints (coordinates) from the route geometry
      const waypoints = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      
      // Step 6: Fetch POIs along the route
      const pois = await fetchPOIsAlongRoute(route.geometry);
      
      const routeSummary = "This is the shortest route by distance.";

      
      // Step 7: Build the final route data object
     const routeData = {
  source: sourceCoords.displayName,
  destination: destCoords.displayName,
  distance: distance,
  duration: duration,
  transportMode: transportMode,
  optimizationPreference: 'distance', // FIXED TO 'distance'
  routeSummary: routeSummary,
  pois: pois,
  // Add geolocation data for map
  coordinates: {
    source: { lat: sourceCoords.lat, lng: sourceCoords.lng },
    destination: { lat: destCoords.lat, lng: destCoords.lng },
    waypoints: waypoints
  }
};
      
      setRouteData(routeData);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching route data:", err);
      setError("Failed to fetch route data. Please try again.");
      setLoading(false);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes} mins`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours} hr${hours > 1 ? 's' : ''} ${remainingMins > 0 ? `${remainingMins} mins` : ''}`;
  };
  
  const getTotalPOIs = () => {
    if (!routeData || !routeData.pois) return 0;
    return Object.values(routeData.pois).reduce((total, poiArray) => total + poiArray.length, 0);
  };
  
  // Filter POIs based on selected category
  const getFilteredPOIs = () => {
    if (!routeData || !routeData.pois) return {};
    
    if (selectedPOICategory === "all") {
      return routeData.pois;
    }
    
    // Return only the selected category
    return {
      [selectedPOICategory]: routeData.pois[selectedPOICategory] || []
    };
  };
  
  if (router.isReady && (!source || !destination)) {
    return (
      <div className="loading-container">
        <p>Missing route information. Redirecting to home...</p>
      </div>
    );
  }
  
  const formatLocationName = (name) => {
    if (!name) return "";
    // For display, show only first part of the name (before comma)
    const shortName = name.split(',')[0];
    return shortName.charAt(0).toUpperCase() + shortName.slice(1).toLowerCase();
  };
  
  return (
    <div className="route-page">
      <Head>
        <title>Route from {formatLocationName(source)} to {formatLocationName(destination)} | Haldwani Trip Planner</title>
        <link 
          rel="stylesheet" 
          href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
          integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
          crossOrigin=""
        />
      </Head>
      
      {/* Header/Navigation Bar */}
      <header className="navbar">
        <div className="logo">
          <Link href="/">
            <span className="logo-link">
              <span className="logo-icon">🚗</span>
              <span className="logo-text">Haldwani Trip Planner</span>
            </span>
          </Link>
        </div>
        <nav className="nav-links">
          <Link href="/" className="nav-link">Home</Link>
          <a href="#" className="nav-link">Popular Routes</a>
          <a href="#" className="nav-link">Explore</a>
          <button className="sign-in-btn">Sign In</button>
        </nav>
      </header>

      <div className="route-container">
        {/* Left Panel - Route Information */}
        <div className="route-info-panel">
          <div className="route-header">
            <h1 className="route-title">
              <span className="route-from">{formatLocationName(source)}</span>
              <span className="route-arrow">→</span>
              <span className="route-to">{formatLocationName(destination)}</span>
            </h1>
            <Link href="/" className="back-btn">← Change Route</Link>
          </div>
          
          {!loading && !error && (
  <div className="route-optimization">
    <div className="transport-mode-selection">
      <label className="transport-mode-label">Transport Mode:</label>
      <div className="mode-options">
        <button 
          className={`mode-btn ${transportMode === 'car' ? 'active' : ''}`}
          onClick={() => setTransportMode('car')}
        >
          <span className="mode-icon">🚗</span> Car
        </button>
        <button 
          className={`mode-btn ${transportMode === 'bike' ? 'active' : ''}`}
          onClick={() => setTransportMode('bike')}
        >
          <span className="mode-icon">🚲</span> Bike
        </button>
        <button 
          className={`mode-btn ${transportMode === 'foot' ? 'active' : ''}`}
          onClick={() => setTransportMode('foot')}
        >
          <span className="mode-icon">🚶</span> Walking
        </button>
      </div>
    </div>
  </div>
)}

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Finding the best route for you...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p className="error-message">{error}</p>
              <button onClick={() => fetchRouteData(source, destination, 'distance')} className="retry-btn">Try Again</button>

            </div>
          ) : (
            <div className="route-details">
              {/* Route Summary */}
              <div className="route-summary">
                <div className="summary-item">
                  <div className="summary-icon">⏱️</div>
                  <div className="summary-text">
                    <span className="summary-value">{formatTime(routeData.duration)}</span>
                    <span className="summary-label">Travel Time</span>
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-icon">📏</div>
                  <div className="summary-text">
                    <span className="summary-value">{routeData.distance} km</span>
                    <span className="summary-label">Distance</span>
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-icon">📍</div>
                  <div className="summary-text">
                    <span className="summary-value">{getTotalPOIs()}</span>
                    <span className="summary-label">Points of Interest</span>
                  </div>
                </div>
              </div>
              
              {/* Tab Navigation */}
              <div className="route-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'pois' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pois')}
                >
                  Points of Interest
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
                  onClick={() => setActiveTab('plan')}
                >
                  Plan Trip
                </button>
              </div>
              
              {/* Tab Content */}
              <div className="tab-content">
                {activeTab === 'overview' && (
                  <div className="overview-tab">
                    <div className="travel-summary">
                      <h3>Trip Overview</h3>
                      <p>Your journey from <strong>{formatLocationName(source)}</strong> to <strong>{formatLocationName(destination)}</strong> is approximately <strong>{routeData.distance} km</strong> and should take around <strong>{formatTime(routeData.duration)}</strong>.</p>
                      
                      {/* Route summary based on optimization */}
                      <p className="route-description"><strong>Route Note:</strong> {routeData.routeSummary}</p>
                      
                      <div className="journey-highlights">
                        <h3>Journey Highlights</h3>
                        <ul className="highlights-list">
                          {routeData.pois.restaurants && routeData.pois.restaurants.length > 0 && (
                            <li>
                              <span className="highlight-icon">🍽️</span>
                              <span className="highlight-text">You'll pass by <strong>{routeData.pois.restaurants.length} restaurants</strong> 
                              {routeData.pois.restaurants[0] && ` including <strong>${routeData.pois.restaurants[0].name}</strong> at ${routeData.pois.restaurants[0].time} mins into your journey`}.</span>
                            </li>
                          )}
                          
                          {routeData.pois.hospitals && routeData.pois.hospitals.length > 0 && (
                            <li>
                              <span className="highlight-icon">🏥</span>
                              <span className="highlight-text">There are <strong>{routeData.pois.hospitals.length} hospitals</strong> on the way for any emergency.</span>
                            </li>
                          )}
                          
                          {routeData.pois.atms && routeData.pois.atms.length > 0 && (
                            <li>
                              <span className="highlight-icon">🏧</span>
                              <span className="highlight-text"><strong>{routeData.pois.atms.length} ATMs</strong> are available along your route.</span>
                            </li>
                          )}
                        </ul>
                      </div>
                      
                      <div className="travel-tips">
                        <h3>Travel Tips</h3>
                        <ul className="tips-list">
                          <li>Consider starting your journey during non-peak hours to avoid traffic.</li>
                          <li>The road conditions are generally good throughout this route.</li>
                          <li>Several parking spots are available near your destination.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab === 'pois' && (
                  <div className="pois-tab">
                    {/* POI Filter */}
                    <div className="poi-filter">
                      <label className="filter-label">Filter Points of Interest:</label>
                      <div className="filter-options">
                        <button 
                          className={`filter-btn ${selectedPOICategory === 'all' ? 'active' : ''}`}
                          onClick={() => setSelectedPOICategory('all')}
                        >
                          All
                        </button>
                        <button 
                          className={`filter-btn ${selectedPOICategory === 'restaurants' ? 'active' : ''}`}
                          onClick={() => setSelectedPOICategory('restaurants')}
                        >
                          🍽️ Restaurants
                        </button>
                        <button 
                          className={`filter-btn ${selectedPOICategory === 'hospitals' ? 'active' : ''}`}
                          onClick={() => setSelectedPOICategory('hospitals')}
                        >
                          🏥 Hospitals
                        </button>
                        <button 
                          className={`filter-btn ${selectedPOICategory === 'atms' ? 'active' : ''}`}
                          onClick={() => setSelectedPOICategory('atms')}
                        >
                          🏧 ATMs
                        </button>
                      </div>
                    </div>
                    
                    <div className="pois-categories">
                      {/* Render POIs based on filter */}
                      {Object.entries(getFilteredPOIs()).map(([category, pois]) => {
                        // Map category to display name and icon
                        const categoryInfo = {
                          restaurants: { name: "Restaurants", icon: "🍽️" },
                          hospitals: { name: "Hospitals", icon: "🏥" },
                          atms: { name: "ATMs", icon: "🏧" }
                        };
                        
                        return (
                          <div key={category} className="poi-category">
                            <h3>
                              <span className="category-icon">{categoryInfo[category].icon}</span>
                              {categoryInfo[category].name} ({pois.length})
                            </h3>
                            <ul className="poi-list">
                              {pois.map((poi, index) => (
                                <li key={index} className="poi-item">
                                  <div className="poi-name">{poi.name}</div>
                                  <div className="poi-details">
                                    <span>{poi.distance} km from start</span>
                                    <span className="poi-time">{poi.time} mins into journey</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {activeTab === 'plan' && (
                  <div className="plan-tab">
                    <div className="trip-planner">
                      <h3>Plan Your Trip</h3>
                      <p>Add stops or plan activities along your route.</p>
                      
                      <div className="suggested-itinerary">
                        <h4>Suggested Itinerary</h4>
                        <ul className="itinerary-list">
                          <li className="itinerary-item">
                            <div className="itinerary-time">Start</div>
                            <div className="itinerary-content">
                              <div className="itinerary-title">Begin your journey at {formatLocationName(source)}</div>
                            </div>
                          </li>
                          
                          {routeData.pois.restaurants && routeData.pois.restaurants[0] && (
                            <li className="itinerary-item">
                              <div className="itinerary-time">+{routeData.pois.restaurants[0].time} mins</div>
                              <div className="itinerary-content">
                                <div className="itinerary-title">Pass by {routeData.pois.restaurants[0].name}</div>
                                <div className="itinerary-description">Great spot for a quick coffee or snack</div>
                              </div>
                            </li>
                          )}
                          
                          {routeData.pois.restaurants && routeData.pois.restaurants[1] && (
                            <li className="itinerary-item">
                              <div className="itinerary-time">+{routeData.pois.restaurants[1].time} mins</div>
                              <div className="itinerary-content">
                                <div className="itinerary-title">Reach {routeData.pois.restaurants[1].name}</div>
                                <div className="itinerary-description">Good place for refreshments</div>
                              </div>
                            </li>
                          )}
                          
                          <li className="itinerary-item">
                            <div className="itinerary-time">+{formatTime(routeData.duration)}</div>
                            <div className="itinerary-content">
                              <div className="itinerary-title">Arrive at {formatLocationName(destination)}</div>
                            </div>
                          </li>
                        </ul>
                      </div>
                      
                      <div className="add-stop-section">
                        <h4>Add a Stop</h4>
                        <button className="add-stop-btn">+ Add to Itinerary</button>
                        <p className="stop-hint">Adding stops will automatically recalculate your route and time.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Right Panel - Map */}
        <div className="map-panel">
          {loading ? (
            <div className="map-loading">
              <div className="loading-spinner"></div>
              <p>Loading map...</p>
            </div>
          ) : (
            <div className="map-container">
              <Map 
                source={source}
                destination={destination}
                routeData={routeData}
                selectedPOICategory={selectedPOICategory}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <span className="logo-icon">🚗</span>
            <span className="footer-logo-text">Haldwani Trip Planner</span>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Contact</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Privacy</a>
          </div>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} Haldwani Trip Planner. All rights reserved.
        </div>
      </footer>
      <style jsx>{`
        /* Global Styles */
        .route-page {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        
        /* Navbar Styles */
        .navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background-color: white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .logo {
          display: flex;
          align-items: center;
          font-size: 1.5rem;
          font-weight: bold;
        }
        
        .logo-link {
          display: flex;
          align-items: center;
          color: #2563eb;
          text-decoration: none;
          cursor: pointer;
        }
        
        .logo-icon {
          margin-right: 0.5rem;
        }
        
        .nav-links {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        
        .nav-link {
          text-decoration: none;
          color: #555;
          font-weight: 500;
          padding: 0.5rem;
          transition: color 0.3s;
        }
        
        .nav-link:hover, .nav-link.active {
          color: #2563eb;
        }
        
        .sign-in-btn {
          background-color: #2563eb;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background-color 0.3s;
        }
        
        .sign-in-btn:hover {
          background-color: #1d4ed8;
        }
        
           /* Route Container - Primary Layout */
.route-container {
  display: flex;
  height: calc(100vh - 150px); /* Full height minus navbar/footer */
  overflow: hidden; /* Prevent shared scroll */
}

/* Left Panel - Route Info */
.route-info-panel {
  width: 50%;
  padding: 1.5rem;
  overflow-y: auto;      /* Enables independent vertical scroll */
  background-color: #f8fafc;
  height: 100%;          /* Fill parent height */
}

/* Right Panel - Map */
.map-panel {
  width: 50%;
  overflow-y: auto;      /* Enables independent vertical scroll */
  background-color: #e2e8f0;
  height: 100%;          /* Fill parent height */
}

}
        
        /* Map container should take full space */
        .map-container {
          height: 100%;
          width: 100%;
        }
        
        /* Route Header */
        .route-header {
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .route-title {
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .route-arrow {
          color: #2563eb;
        }
        
        .back-btn {
          display: inline-block;
          color: #555;
          text-decoration: none;
          font-size: 0.9rem;
          margin-top: 0.5rem;
          transition: color 0.3s;
        }
        
        .back-btn:hover {
          color: #2563eb;
        }
        
        /* Route Optimization Styles */
        .route-optimization {
          margin-bottom: 1.5rem;
          background-color: white;
          padding: 1.2rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .optimization-label {
          display: block;
          margin-bottom: 0.8rem;
          font-weight: 500;
        }
        
        .optimization-options {
          display: flex;
          gap: 1rem;
        }
        
        .optimization-btn {
    flex: 1;
    padding: 0.8rem;
    background-color: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .optimization-btn:hover {
    border-color: #2563eb;
    color: #2563eb;
  }
  
  .optimization-btn.active {
    background-color: #2563eb;
    color: white;
    border-color: #2563eb;
  }
  
  .optimization-icon {
    font-size: 1.1rem;
  }
    /* Transport Mode Selector Styles */
.transport-mode-selection {
  margin-top: 1rem;
}

.transport-mode-label {
  display: block;
  margin-bottom: 0.8rem;
  font-weight: 500;
}

.mode-options {
  display: flex;
  gap: 1rem;
}

.mode-btn {
  flex: 1;
  padding: 0.8rem;
  background-color: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.mode-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.mode-btn.active {
  background-color: #2563eb;
  color: white;
  border-color: #2563eb;
}

.mode-icon {
  font-size: 1.1rem;
}
  
  /* Route Details Styles */
  .route-details {
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  
  /* Route Summary */
  .route-summary {
    display: flex;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .summary-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  
  .summary-icon {
    font-size: 1.5rem;
  }
  
  .summary-text {
    display: flex;
    flex-direction: column;
  }
  
  .summary-value {
    font-weight: 700;
    font-size: 1.2rem;
    color: #2563eb;
  }
  
  .summary-label {
    font-size: 0.9rem;
    color: #64748b;
  }
  
  /* Tab Navigation */
  .route-tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .tab-btn {
    flex: 1;
    padding: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
    color: #64748b;
    transition: all 0.3s;
    border-bottom: 2px solid transparent;
  }
  
  .tab-btn:hover {
    color: #334155;
  }
  
  .tab-btn.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
  }
  
  /* Tab Content */
  .tab-content {
    padding: 1.5rem;
  }
  
  /* Overview Tab */
  .travel-summary h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #334155;
  }
  
  .route-description {
    background-color: #f8fafc;
    padding: 0.8rem;
    border-radius: 6px;
    margin: 1rem 0;
    border-left: 3px solid #2563eb;
  }
  
  .journey-highlights, .travel-tips {
    margin-top: 1.5rem;
  }
  
  .highlights-list, .tips-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .highlights-list li, .tips-list li {
    display: flex;
    gap: 0.8rem;
    margin-bottom: 0.8rem;
    padding-bottom: 0.8rem;
    border-bottom: 1px dashed #e2e8f0;
  }
  
  .highlights-list li:last-child, .tips-list li:last-child {
    border-bottom: none;
  }
  
  .highlight-icon {
    font-size: 1.2rem;
  }
  
  /* POIs Tab */
  .poi-filter {
    margin-bottom: 1.5rem;
  }
  
  .filter-label {
    display: block;
    margin-bottom: 0.8rem;
    font-weight: 500;
  }
  
  .filter-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .filter-btn {
    padding: 0.5rem 0.8rem;
    background-color: #f1f5f9;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 0.9rem;
  }
  
  .filter-btn:hover {
    background-color: #e2e8f0;
  }
  
  .filter-btn.active {
    background-color: #2563eb;
    color: white;
  }
  
  .pois-categories {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .poi-category h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0;
    margin-bottom: 0.8rem;
    color: #334155;
  }
  
  .category-icon {
    font-size: 1.2rem;
  }
  
  .poi-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .poi-item {
    padding: 0.8rem;
    border-radius: 6px;
    background-color: #f8fafc;
    margin-bottom: 0.5rem;
  }
  
  .poi-name {
    font-weight: 500;
    margin-bottom: 0.3rem;
  }
  
  .poi-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: #64748b;
  }
  
  /* Plan Tab */
  .trip-planner h3, .trip-planner h4 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #334155;
  }
  
  .suggested-itinerary {
    margin: 1.5rem 0;
  }
  
  .itinerary-list {
    list-style: none;
    padding: 0;
    margin: 0;
    position: relative;
  }
  
  .itinerary-list::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 60px;
    width: 2px;
    background-color: #e2e8f0;
  }
  
  .itinerary-item {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    position: relative;
  }
  
  .itinerary-time {
    width: 60px;
    min-width: 60px;
    font-weight: 500;
    color: #2563eb;
    text-align: right;
    padding-right: 1rem;
  }
  
  .itinerary-content {
    flex: 1;
    padding-left: 1.5rem;
  }
  
  .itinerary-content::before {
    content: '';
    position: absolute;
    left: 60px;
    top: 5px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #2563eb;
    transform: translateX(-50%);
    z-index: 1;
  }
  
  .itinerary-title {
    font-weight: 500;
    margin-bottom: 0.3rem;
  }
  
  .itinerary-description {
    font-size: 0.9rem;
    color: #64748b;
  }
  
  .add-stop-section {
    margin-top: 1.5rem;
    background-color: #f8fafc;
    padding: 1rem;
    border-radius: 6px;
    text-align: center;
  }
  
  .add-stop-btn {
    background-color: #2563eb;
    color: white;
    border: none;
    padding: 0.8rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    margin: 0.5rem 0;
    transition: background-color 0.3s;
  }
  
  .add-stop-btn:hover {
    background-color: #1d4ed8;
  }
  
  .stop-hint {
    font-size: 0.9rem;
    color: #64748b;
    margin-top: 0.5rem;
  }
  
  /* Loading and Error Styles */
  .loading-container, .map-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    height: 100%;
  }
  
  .loading-spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top: 4px solid #2563eb;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-container {
    padding: 1.5rem;
    text-align: center;
    background-color: #fee2e2;
    border-radius: 6px;
    margin: 1rem 0;
  }
  
  .error-message {
    color: #b91c1c;
    margin-bottom: 1rem;
  }
  
  .retry-btn {
    background-color: #b91c1c;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }
  
  /* Footer Styles */
  .footer {
    background-color: #1e293b;
    color: white;
    padding: 2rem;
    margin-top: auto;
  }
  
  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .footer-logo {
    display: flex;
    align-items: center;
    font-size: 1.2rem;
    font-weight: bold;
  }
  
  .footer-logo-text {
    margin-left: 0.5rem;
  }
  
  .footer-links {
    display: flex;
    gap: 1.5rem;
  }
  
  .footer-link {
    color: #cbd5e1;
    text-decoration: none;
    transition: color 0.3s;
  }
  
  .footer-link:hover {
    color: white;
  }
  
  .footer-copyright {
    text-align: center;
    font-size: 0.9rem;
    color: #94a3b8;
  }
  
  /* Responsive Styles */
  @media (max-width: 1024px) {
    .route-container {
      flex-direction: column;
      max-height: none;
    }
    
    .route-info-panel, .map-panel {
      width: 100%;
    }
    
    .map-panel {
      height: 400px;
    }
  }
  
  @media (max-width: 768px) {
    .navbar {
      padding: 1rem;
    }
    
    .logo-text, .nav-links a:not(.sign-in-btn) {
      display: none;
    }
    
    .nav-links {
      gap: 0.5rem;
    }
    
    .route-summary {
      flex-direction: column;
      gap: 1rem;
    }
    
    .filter-options {
      flex-direction: column;
    }
    
    .optimization-options {
      flex-direction: column;
    }
  }
      `}</style>
    </div>
  );
}