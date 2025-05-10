// pages/index.js - Home page with user authentication
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [username, setUsername] = useState("");
  
  const [sourceOptions, setSourceOptions] = useState([]);
  const [destOptions, setDestOptions] = useState([]);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isLoadingDest, setIsLoadingDest] = useState(false);

  useEffect(() => {
    // Get username from localStorage
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    router.replace('/login');
  };

  // Search for locations using Nominatim API
  const searchLocations = async (query, inSpecificArea = true) => {
    if (!query || query.length < 3) return [];
    
    try {
      // Append area to the search to focus on specific region (Haldwani)
      const searchQuery = inSpecificArea ? `${query}, Haldwani, India` : query;
      
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      
      return response.data.map(location => ({
        display_name: location.display_name,
        lat: location.lat,
        lon: location.lon
      }));
    } catch (error) {
      console.error("Error searching locations:", error);
      return [];
    }
  };

  // Handle source location input change
  const handleSourceChange = async (e) => {
    const value = e.target.value;
    setSource(value);
    
    if (value.length >= 3) {
      setIsLoadingSource(true);
      const locations = await searchLocations(value);
      setSourceOptions(locations);
      setIsLoadingSource(false);
    } else {
      setSourceOptions([]);
    }
  };

  // Handle destination location input change
  const handleDestChange = async (e) => {
    const value = e.target.value;
    setDestination(value);
    
    if (value.length >= 3) {
      setIsLoadingDest(true);
      const locations = await searchLocations(value);
      setDestOptions(locations);
      setIsLoadingDest(false);
    } else {
      setDestOptions([]);
    }
  };

  // Select a source location from dropdown
  const selectSourceLocation = (location) => {
    setSource(location.display_name);
    setSourceOptions([]);
  };

  // Select a destination location from dropdown
  const selectDestLocation = (location) => {
    setDestination(location.display_name);
    setDestOptions([]);
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (source && destination) {
      // Changed from /map to /route to match your new flow
      router.push(
        `/route?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}`
      );
    } else {
      alert("Please enter both source and destination");
    }
  };
  
  return (
    <div className="app-container">
      {/* Header/Navigation Bar */}
      <header className="navbar">
        <div className="logo">
          <span className="logo-icon">🚗</span>
          <span className="logo-text">Haldwani Trip Planner</span>
        </div>
        <nav className="nav-links">
          <a href="#" className="nav-link active">Home</a>
          <a href="#" className="nav-link">Popular Routes</a>
          <a href="#" className="nav-link">Explore</a>
          {username ? (
            <div className="user-menu">
              <span className="username">Hello, {username}</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          ) : (
            <button className="sign-in-btn" onClick={() => router.push('/login')}>Sign In</button>
          )}
        </nav>
      </header>

      <main className="main-content">
        {/* Hero section */}
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">Explore Haldwani With Ease</h1>
            <p className="hero-subtitle">Discover the best routes and places of interest along your journey</p>
          </div>
        </section>

        {/* Search Form - Streamlined */}
        <section className="search-section">
          <div className="form-container">
            <h2 className="section-title">Plan Your Trip</h2>
            
            <form onSubmit={handleSubmit} className="search-form">
              <div className="form-inputs">
                <div className="form-group location-input">
                  <label className="form-label">Starting Point</label>
                  <div className="autocomplete-container">
                    <input
                      type="text"
                      placeholder="Enter your starting location in Haldwani"
                      value={source}
                      onChange={handleSourceChange}
                      className="form-input"
                      required
                    />
                    {isLoadingSource && <div className="loading-indicator">Loading...</div>}
                    {sourceOptions.length > 0 && (
                      <ul className="autocomplete-results">
                        {sourceOptions.map((location, index) => (
                          <li 
                            key={index} 
                            onClick={() => selectSourceLocation(location)}
                            className="autocomplete-item"
                          >
                            {location.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="form-group location-input">
                  <label className="form-label">Destination</label>
                  <div className="autocomplete-container">
                    <input
                      type="text"
                      placeholder="Where do you want to go in Haldwani?"
                      value={destination}
                      onChange={handleDestChange}
                      className="form-input"
                      required
                    />
                    {isLoadingDest && <div className="loading-indicator">Loading...</div>}
                    {destOptions.length > 0 && (
                      <ul className="autocomplete-results">
                        {destOptions.map((location, index) => (
                          <li 
                            key={index} 
                            onClick={() => selectDestLocation(location)}
                            className="autocomplete-item"
                          >
                            {location.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <button type="submit" className="search-btn">
                🔍 Find Best Route
              </button>
            </form>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <h2 className="section-title">Why Plan with Us?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🗺️</div>
              <h3>Smart Routes</h3>
              <p>Get the best route tailored to your needs</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🍽️</div>
              <h3>Places to Eat</h3>
              <p>Discover restaurants and cafes along your route</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⛽</div>
              <h3>Essential Services</h3>
              <p>Find Restaurants, ATMs, and hospitals on the way</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏱️</div>
              <h3>Time Estimation</h3>
              <p>Know exactly how long your journey will take</p>
            </div>
          </div>
        </section>
        
        {/* Popular Destinations Section */}
        <section className="destinations-section">
          <h2 className="section-title">Popular Destinations in Haldwani</h2>
          <div className="destinations-grid">
            <div className="destination-card">
              <div className="destination-image" style={{backgroundImage: 'url(/placeholder-img.jpg)'}}></div>
              <h3>Kathgodam Railway Station</h3>
              <p>Major railway junction connecting to Delhi and other cities</p>
            </div>
            <div className="destination-card">
              <div className="destination-image" style={{backgroundImage: 'url(/placeholder-img.jpg)'}}></div>
              <h3>Haldwani Botanical Garden</h3>
              <p>A peaceful place for nature lovers</p>
            </div>
            <div className="destination-card">
              <div className="destination-image" style={{backgroundImage: 'url(/placeholder-img.jpg)'}}></div>
              <h3>Haidakhan Ashram</h3>
              <p>Beautiful temple with peaceful surroundings</p>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-info">
            <div className="footer-logo">
              <span className="logo-icon">🚗</span>
              <span>Haldwani Trip Planner</span>
            </div>
            <p>Your smart companion for exploring Haldwani</p>
          </div>
          <div className="footer-links">
            <div className="footer-links-group">
              <h4>Navigation</h4>
              <ul>
                <li><a href="#">Home</a></li>
                <li><a href="#">Popular Routes</a></li>
                <li><a href="#">Explore</a></li>
              </ul>
            </div>
            <div className="footer-links-group">
              <h4>Support</h4>
              <ul>
                <li><a href="#">Help Center</a></li>
                <li><a href="#">Contact Us</a></li>
                <li><a href="#">FAQs</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="copyright">
          <p>© 2025 Haldwani Trip Planner. All rights reserved.</p>
        </div>
      </footer>
      
      <style jsx>{`
        /* Global Styles */
.app-container {
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #1f2937;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f9fafb;
}

/* Navbar Styles */
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2.5rem;
  background-color: rgba(255, 255, 255, 0.98);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(8px);
}

.logo {
  display: flex;
  align-items: center;
  font-size: 1.375rem;
  font-weight: 700;
  color: #2563eb;
  letter-spacing: -0.025em;
}

.logo-icon {
  margin-right: 0.625rem;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.nav-link {
  text-decoration: none;
  color: #4b5563;
  font-weight: 500;
  padding: 0.5rem;
  transition: all 0.2s ease;
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: #2563eb;
  transition: width 0.3s ease;
}

.nav-link:hover::after, .nav-link.active::after {
  width: 100%;
}

.nav-link:hover, .nav-link.active {
  color: #2563eb;
}

/* User menu styles */
.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.username {
  font-weight: 500;
  color: #2563eb;
}

.logout-btn {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background-color: #dc2626;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sign-in-btn {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 0.625rem 1.25rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.sign-in-btn:hover {
  background-color: #1d4ed8;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

/* Hero Section */
.hero-section {
  background: linear-gradient(rgba(30, 64, 175, 0.85), rgba(37, 99, 235, 0.85)), 
              url('https://images.unsplash.com/photo-1566552881560-0be862a7c445?ixlib=rb-4.0.3&auto=format&fit=crop&w=1950&q=80') center/cover no-repeat;
  color: white;
  text-align: center;
  padding: 6rem 2rem;
  margin-bottom: 3rem;
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 100%);
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
}

.hero-title {
  font-size: 3.25rem;
  margin-bottom: 1.25rem;
  font-weight: 800;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
  letter-spacing: -0.025em;
  line-height: 1.1;
}

.hero-subtitle {
  font-size: 1.25rem;
  max-width: 600px;
  margin: 0 auto;
  opacity: 0.95;
  line-height: 1.6;
  font-weight: 400;
}

/* Search Form */
.search-section {
  max-width: 850px;
  margin: -4rem auto 4rem;
  padding: 2.5rem;
  background-color: white;
  border-radius: 1rem;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04);
  position: relative;
  z-index: 5;
}

.section-title {
  text-align: center;
  margin-bottom: 1.75rem;
  color: #111827;
  font-weight: 700;
  font-size: 1.75rem;
  letter-spacing: -0.025em;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.form-inputs {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

@media (min-width: 768px) {
  .form-inputs {
    flex-direction: row;
    align-items: stretch;
  }
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #4b5563;
  font-size: 0.9375rem;
}

.form-input {
  width: 100%;
  padding: 0.9375rem 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: all 0.25s ease;
  background-color: #f9fafb;
  color: #1f2937;
}

.form-input::placeholder {
  color: #9ca3af;
  font-size: 0.9375rem;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.search-btn {
  background-color: #2563eb;
  color: white;
  padding: 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.search-btn:hover {
  background-color: #1d4ed8;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
}

.search-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

/* Autocomplete Styles */
.autocomplete-container {
  position: relative;
  width: 100%;
}

.autocomplete-results {
  position: absolute;
  z-index: 1000;
  background: white;
  border: 1px solid #e5e7eb;
  width: 100%;
  max-height: 250px;
  overflow-y: auto;
  border-radius: 0 0 0.5rem 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
  list-style: none;
  padding: 0;
  margin: 0;
}

.autocomplete-item {
  padding: 0.875rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.9375rem;
  transition: background-color 0.2s ease;
  color: #4b5563;
}

.autocomplete-item:last-child {
  border-bottom: none;
}

.autocomplete-item:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}

.loading-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8125rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Features Section */
.features-section {
  padding: 5rem 2rem;
  background-color: #f3f4f6;
  position: relative;
  overflow: hidden;
}

.features-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(to right, #2563eb, #3b82f6, #60a5fa);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.75rem;
  max-width: 1200px;
  margin: 0 auto;
}

.feature-card {
  background-color: white;
  padding: 2rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
  text-align: center;
  transition: all 0.3s ease;
  border: 1px solid rgba(0,0,0,0.02);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.feature-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.05);
}

/* Feature icon styling continued */
.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
  background-color: #eff6ff;
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #2563eb;
}

.feature-card h3 {
  margin-bottom: 0.75rem;
  color: #1f2937;
  font-weight: 600;
  font-size: 1.25rem;
}

.feature-card p {
  color: #6b7280;
  line-height: 1.6;
}

/* Destinations Section */
.destinations-section {
  padding: 5rem 2rem;
  margin-bottom: 2rem;
  max-width: 1200px;
  margin: 0 auto 5rem;
}

.destinations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2.5rem;
}

.destination-card {
  background-color: white;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
  transition: all 0.3s ease;
  border: 1px solid #f3f4f6;
}

.destination-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
}

.destination-image {
  height: 200px;
  background-color: #e5e7eb;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
}

.destination-image::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);
}

.destination-card h3 {
  padding: 1.25rem 1.25rem 0.75rem;
  color: #1f2937;
  font-weight: 600;
  font-size: 1.125rem;
}

.destination-card p {
  padding: 0 1.25rem 1.25rem;
  color: #6b7280;
  font-size: 0.9375rem;
  line-height: 1.6;
}

/* Footer */
.footer {
  background-color: #1e3a8a;
  color: #fff;
  padding: 4rem 2rem 1.5rem;
  margin-top: auto;
  position: relative;
}

.footer::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(to right, #60a5fa, #3b82f6, #2563eb);
}

.footer-content {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .footer-content {
    flex-direction: row;
    justify-content: space-between;
  }
}

.footer-info {
  flex: 1;
  max-width: 350px;
}

.footer-logo {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
  color: white;
}

.footer-logo .logo-icon {
  font-size: 1.5rem;
  margin-right: 0.75rem;
}

.footer-info p {
  color: #cbd5e1;
  line-height: 1.6;
  font-size: 0.9375rem;
}

.footer-links {
  display: flex;
  gap: 4rem;
  flex-wrap: wrap;
}

.footer-links-group h4 {
  margin-bottom: 1.25rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
  position: relative;
  padding-bottom: 0.75rem;
}

.footer-links-group h4::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 40px;
  height: 2px;
  background-color: #60a5fa;
}

.footer-links-group ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links-group ul li {
  margin-bottom: 0.75rem;
}

.footer-links-group ul li a {
  color: #cbd5e1;
  text-decoration: none;
  transition: all 0.2s ease;
  font-size: 0.9375rem;
  display: inline-block;
}

.footer-links-group ul li a:hover {
  color: white;
  transform: translateX(3px);
}

.copyright {
  text-align: center;
  padding-top: 2.5rem;
  margin-top: 2.5rem;
  font-size: 0.875rem;
  color: #94a3b8;
  border-top: 1px solid rgba(255,255,255,0.1);
}

/* Responsive Adjustments */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }
  
  .hero-subtitle {
    font-size: 1.125rem;
  }
  
  .search-section {
    margin-top: -2rem;
    padding: 1.75rem;
  }
  
  .footer-links {
    gap: 2rem;
  }

  .user-menu {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
  }
}

@media (max-width: 640px) {
  .navbar {
    padding: 0.75rem 1.25rem;
  }
  
  .nav-links {
    gap: 1rem;
  }
  
  .logo-text {
    display: none;
  }
  
  .hero-title {
    font-size: 2.25rem;
  }
  
  .section-title {
    font-size: 1.5rem;
  }
}
      `}</style>
    </div>
  );
}