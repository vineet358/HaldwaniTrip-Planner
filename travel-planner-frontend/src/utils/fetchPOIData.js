import axios from 'axios';

export default async function fetchPOIData(sourceLat, sourceLon, destLat, destLon) {
  try {
    // Calculate a bounding box that covers the route
    const minLat = Math.min(sourceLat, destLat) - 0.01;
    const maxLat = Math.max(sourceLat, destLat) + 0.01;
    const minLon = Math.min(sourceLon, destLon) - 0.01;
    const maxLon = Math.max(sourceLon, destLon) + 0.01;

    // Query POIs within the bounding box using Overpass API
    const query = `
      [out:json];
      (
        node["amenity"="restaurant"](${minLat},${minLon},${maxLat},${maxLon});
        node["tourism"="hotel"](${minLat},${minLon},${maxLat},${maxLon});
        node["amenity"="hospital"](${minLat},${minLon},${maxLat},${maxLon});
      );
      out body;
    `;

   // Encode query to be URL-safe
   const encodedQuery = encodeURIComponent(query);

   // Send request to Overpass API
   const url = `https://overpass-api.de/api/interpreter?data=${encodedQuery}`;
   const response = await axios.get(url);
    // Transform data to expected format
    const pointsOfInterest = response.data.elements.map((element) => {
      let type = 'default';

      if (element.tags.amenity === 'restaurant') type = 'restaurant';
      else if (element.tags.tourism === 'hotel') type = 'hotel';
      else if (element.tags.amenity === 'hospital') type = 'hospital';

      return {
        name: element.tags.name || type.charAt(0).toUpperCase() + type.slice(1),
        type: type,
        coordinates: [element.lat, element.lon],
      };
    });

    return pointsOfInterest;
  } catch (error) {
    console.error('Error fetching POIs:', error);
    return []; // Return empty array on error
  }
}
