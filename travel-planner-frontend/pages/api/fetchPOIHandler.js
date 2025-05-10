import fetchPOIData from "../../src/utils/fetchPOIData";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { sourceLat, sourceLon, destLat, destLon } = req.body;

    try {
      const data = await fetchPOIData(sourceLat, sourceLon, destLat, destLon);
      res.status(200).json(data); // Send POI data to the frontend
    } catch (error) {
      console.error("Error fetching POI data:", error);
      res.status(500).json({ error: "Failed to fetch POI data" });
    }
  } else {
    res.status(405).json({ error: "Method Not Allowed" });
  }
}
