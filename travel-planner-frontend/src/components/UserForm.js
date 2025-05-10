import { useState } from "react";
import { useRouter } from "next/router";

const UserForm = () => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !location) {
      alert("Please enter your name and location.");
      return;
    }
    
    localStorage.setItem("userName", name);
    localStorage.setItem("userLocation", location);
    router.push("/select-route"); 
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Welcome to Travel Planner</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <label className="block mb-2">Enter your Name:</label>
        <input
          type="text"
          className="border p-2 w-full mb-4"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          required
        />
        <label className="block mb-2">Enter your Location:</label>
        <input
          type="text"
          className="border p-2 w-full mb-4"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Your Location"
          required
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md">
          Continue
        </button>
      </form>
    </div>
  );
};

export default UserForm;
