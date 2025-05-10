const axios = require('axios');
const dijkstra = require('../utils/dijkstra');

// Function to calculate distance between two coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Function to break down journey based on distance
function breakdownJourney(totalDistance, points) {
  // Average speed in km/h
  const avgSpeed = 60;
  // Maximum hours of driving per day
  const maxDrivingHours = 6;
  // Maximum distance per day
  const maxDistancePerDay = avgSpeed * maxDrivingHours;
  
  // Calculate number of days needed
  const days = Math.ceil(totalDistance / maxDistancePerDay);
  
  // Create day-wise breakdown
  const breakdown = [];
  const pointsPerDay = Math.ceil(points.length / days);
  
  for (let i = 0; i < days; i++) {
    const startIndex = i * pointsPerDay;
    const endIndex = Math.min((i + 1) * pointsPerDay, points.length - 1);
    
    breakdown.push({
      day: i + 1,
      startPoint: points[startIndex],
      endPoint: points[endIndex],
      distance: calculateTotalDistance(points.slice(startIndex, endIndex + 1)),
      estimatedTime: calculateEstimatedTime(calculateTotalDistance(points.slice(startIndex, endIndex + 1)), avgSpeed)
    });
  }
  
  return breakdown;
}

// Calculate total distance of a path
function calculateTotalDistance(path) {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalDistance += calculateDistance(
      path[i].lat, path[i].lon,
      path[i + 1].lat, path[i + 1].lon
    );
  }
  return totalDistance;
}

// Calculate estimated time based on distance and speed
function calculateEstimatedTime(distance, speed) {
  return distance / speed; // hours
}

// Controller method to plan a journey
exports.planJourney = async (req, res) => {
  try {
    const { source, destination } = req.body;
    
    if (!source || !destination) {
      return res.status(400).json({ message: "Source and destination are required." });
    }
    
    // 1. Get route between source and destination
    const routeResponse = await axios.post('http://localhost:3000/api/route', { 
      source: source, 
      destination: destination 
    });
    
    const route = routeResponse.data;
    
    // 2. Get POIs near the route
    const minLat = Math.min(source[0], destination[0]) - 0.05;
    const maxLat = Math.max(source[0], destination[0]) + 0.05;
    const minLng = Math.min(source[1], destination[1]) - 0.05;
    const maxLng = Math.max(source[1], destination[1]) + 0.05;
    
    // Get hotels
    const hotelQuery = `
      [out:json];
      (
        node["tourism"="hotel"](${minLat},${minLng},${maxLat},${maxLng});
        node["tourism"="hostel"](${minLat},${minLng},${maxLat},${maxLng});
        node["tourism"="guest_house"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out body;
    `;
    
    const hotelResponse = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(hotelQuery)}`);
    
    // Get restaurants
    const restaurantQuery = `
      [out:json];
      (
        node["amenity"="restaurant"](${minLat},${minLng},${maxLat},${maxLng});
        node["amenity"="cafe"](${minLat},${minLng},${maxLat},${maxLng});
        node["amenity"="fast_food"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out body;
    `;
    
    const restaurantResponse = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(restaurantQuery)}`);
    
    // Get emergency services
    const emergencyQuery = `
      [out:json];
      (
        node["amenity"="hospital"](${minLat},${minLng},${maxLat},${maxLng});
        node["amenity"="clinic"](${minLat},${minLng},${maxLat},${maxLng});
        node["amenity"="doctors"](${minLat},${minLng},${maxLat},${maxLng});
        node["amenity"="pharmacy"](${minLat},${minLng},${maxLat},${maxLng});
        node["amenity"="police"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out body;
    `;
    
    const emergencyResponse = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(emergencyQuery)}`);
    
    // Format POIs
    const hotels = hotelResponse.data.elements.map(element => ({
      id: element.id,
      name: element.tags.name || 'Unnamed Hotel',
      type: element.tags.tourism || 'hotel',
      coordinates: [element.lat, element.lon],
      rating: element.tags.stars || '3',
      amenities: element.tags.amenity_1 || 'Standard amenities'
    }));
    
    const restaurants = restaurantResponse.data.elements.map(element => ({
      id: element.id,
      name: element.tags.name || 'Unnamed Restaurant',
      type: element.tags.amenity || 'restaurant',
      cuisine: element.tags.cuisine || 'Various',
      coordinates: [element.lat, element.lon]
    }));
    
    const emergencyServices = emergencyResponse.data.elements.map(element => ({
      id: element.id,
      name: element.tags.name || `Unnamed ${element.tags.amenity}`,
      type: element.tags.amenity || 'emergency',
      coordinates: [element.lat, element.lon],
      phone: element.tags.phone || 'N/A'
    }));
    
    // 3. Break down journey by days
    const totalDistance = route.distance || calculateTotalDistance(route.path);
    const journeyBreakdown = breakdownJourney(totalDistance, route.path);
    
    // 4. Create recommendations for each day
    const recommendations = journeyBreakdown.map(day => {
      const dayCenter = {
        lat: (day.startPoint.lat + day.endPoint.lat) / 2,
        lon: (day.startPoint.lon + day.endPoint.lon) / 2
      };
      
      // Find closest POIs for the day's segment
      const dayHotels = hotels
        .map(hotel => ({
          ...hotel,
          distance: calculateDistance(
            dayCenter.lat, dayCenter.lon,
            hotel.coordinates[0], hotel.coordinates[1]
          )
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);
      
      const dayRestaurants = restaurants
        .map(restaurant => ({
          ...restaurant,
          distance: calculateDistance(
            dayCenter.lat, dayCenter.lon,
            restaurant.coordinates[0], restaurant.coordinates[1]
          )
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);
      
      const dayEmergency = emergencyServices
        .map(service => ({
          ...service,
          distance: calculateDistance(
            dayCenter.lat, dayCenter.lon,
            service.coordinates[0], service.coordinates[1]
          )
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);
      
      return {
        ...day,
        recommendations: {
          stay: dayHotels,
          dining: dayRestaurants,
          emergency: dayEmergency
        }
      };
    });
    
    // 5. Prepare and send the complete journey plan
    const journeyPlan = {
      route: {
        path: route.path,
        distance: totalDistance.toFixed(2),
        nodeCount: route.nodeCount || route.path.length
      },
      accommodations: hotels.slice(0, 10),
      restaurants: restaurants.slice(0, 15),
      emergencyServices: emergencyServices.slice(0, 10),
      dailyPlan: recommendations
    };
    
    res.json(journeyPlan);
  } catch (error) {
    console.error("Error planning journey:", error);
    res.status(500).json({ 
      message: "Error planning journey", 
      error: error.message
    });
  }
};

// Get a previously created journey plan
exports.getJourneyById = async (req, res) => {
  try {
    // This would typically fetch from a database
    // For now, return a placeholder response
    res.status(404).json({ message: "Journey not found" });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving journey", error: error.message });
  }
};

// Save a journey plan
exports.saveJourney = async (req, res) => {
  try {
    const { name, source, destination, plan } = req.body;
    
    if (!name || !source || !destination || !plan) {
      return res.status(400).json({ message: "Name, source, destination and plan are required." });
    }
    
    // This would typically save to a database
    // For now, return a success placeholder
    res.json({ 
      message: "Journey saved successfully", 
      journeyId: "j-" + Date.now() 
    });
  } catch (error) {
    res.status(500).json({ message: "Error saving journey", error: error.message });
  }
};