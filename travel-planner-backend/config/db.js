require("dotenv").config();
const mongoose = require("mongoose");
const Location = require("../models/Location");

const MAX_DISTANCE = 0.01; // Adjust this value based on your distance threshold

// ✅ Connect to MongoDB (Fixed: Removed deprecated options)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

const connectLocations = async () => {
  try {
    const locations = await Location.find();

    for (const loc of locations) {
      const nearbyLocations = locations.filter((otherLoc) => {
        if (loc._id.equals(otherLoc._id)) return false;

        const distance = Math.sqrt(
          Math.pow(loc.latitude - otherLoc.latitude, 2) +
          Math.pow(loc.longitude - otherLoc.longitude, 2)
        );

        return distance < MAX_DISTANCE;
      });

      loc.connections = nearbyLocations.map((nearby) => nearby._id);
      await loc.save();
    }

    console.log("✅ Locations Connected Successfully!");
  } catch (error) {
    console.error("❌ Error connecting locations:", error);
  } finally {
    mongoose.connection.close();
  }
};

connectLocations();
