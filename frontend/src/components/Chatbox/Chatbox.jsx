import { useEffect, useRef, useState } from "react";
import { getCurrentPosition, geocodeAddress, reverseGeocode } from "../../services/locationService";
import { getFloodRisk, registerLocation } from "../../services/floodService";
import "./Chatbox.css";

const WELCOME = {
  id: 1,
  sender: "bot",
  text: "Hello! Pin your location, then tell me where you are headed. I will check flood risk along the way.",
};

export default function Chatbox() {
  const [messages, setMessages] = useState([WELCOME]);
  const [destination, setDestination] = useState("");
  const [origin, setOrigin] = useState(null); // { lat, lng, name }
  const [pinning, setPinning] = useState(false);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const nextId = useRef(2);

  // Keep the newest message in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (sender, text, extra = {}) =>
    setMessages((prev) => [...prev, { id: nextId.current++, sender, text, ...extra }]);

  const handlePinLocation = async () => {
    setPinning(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      const name = await reverseGeocode(lat, lng);
      setOrigin({ lat, lng, name });
      addMessage("bot", `Location pinned: ${name}`);

      // Optional: let the backend know so it can send alerts for this area
      registerLocation({ lat, lng }).catch(() => {});
    } catch (err) {
      addMessage("bot", err.message, { error: true });
    } finally {
      setPinning(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const query = destination.trim();
    if (!query || loading) return;

    addMessage("user", query);
    setDestination("");

    if (!origin) {
      addMessage("bot", "Pin your location first so I can check the route.", { error: true });
      return;
    }

    setLoading(true);
    try {
      const place = await geocodeAddress(query);
      const risk = await getFloodRisk(origin, place);

      addMessage("bot", risk.message, {
        level: risk.level,
        advice: risk.advice,
        destinationName: place.name,
      });
    } catch (err) {
      addMessage("bot", err.message, { error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="chatbox" aria-label="Flood risk chat">
      <div className="chatbox__location">
        <button
          type="button"
          className="chatbox__pin"
          onClick={handlePinLocation}
          disabled={pinning}
        >
          {pinning ? "Finding you..." : origin ? "Update my location" : "Pin my location"}
        </button>
        {origin && <span className="chatbox__origin" title={origin.name}>{origin.name}</span>}
      </div>

      <div className="chatbox__messages" role="log" aria-live="polite">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chatbox__message chatbox__message--${m.sender}${m.error ? " chatbox__message--error" : ""}`}
          >
            {m.level && (
              <span className={`chatbox__badge chatbox__badge--${m.level}`}>
                {m.level} risk
              </span>
            )}
            <p>{m.text}</p>
            {m.destinationName && (
              <p className="chatbox__destination">To: {m.destinationName}</p>
            )}
            {m.advice?.length > 0 && (
              <ul className="chatbox__advice">
                {m.advice.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
            )}
          </div>
        ))}
        {loading && <div className="chatbox__message chatbox__message--bot chatbox__typing">Checking flood risk...</div>}
        <div ref={endRef} />
      </div>

      <form className="chatbox__form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chatbox__input"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Where are you headed? e.g. Kisumu CBD"
          aria-label="Destination"
          disabled={loading}
        />
        <button type="submit" className="chatbox__send" disabled={loading || !destination.trim()}>
          Check route
        </button>
      </form>
    </section>
  );
}
