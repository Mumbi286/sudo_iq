// src/pages/Home/Home.jsx
import { useState } from "react";
import Navbar from "../../components/Navbar/Navbar";
import Chatbox from "../../components/Chatbox/Chatbox";
import NearbyRisks from "../../components/Nearbyrisks/Nearbyrisks";
import "./Home.css";

export default function Home() {
  // Set by the Chatbox when the user pins their location,
  // then used by NearbyRisks to load risks around that spot.
  const [location, setLocation] = useState(null);

  return (
    <div className="home">
      <Navbar />

      <main className="home__main">
        <div className="home__intro">
          <h1 className="home__heading">Check the flood risk before you travel</h1>
          <p className="home__lead">
            Pin where you are, tell us where you are going, and see which places around you are
            at risk right now.
          </p>
        </div>

        <div className="home__grid">
          <div className="home__chat">
            <Chatbox onLocationPinned={setLocation} />
          </div>
          <div className="home__risks">
            <NearbyRisks location={location} />
          </div>
        </div>
      </main>
    </div>
  );
}
