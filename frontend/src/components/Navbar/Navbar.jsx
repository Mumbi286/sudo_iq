import { useEffect, useRef, useState } from "react";
import "./Navbar.css";

const DEFAULT_CONTACTS = [
  { label: "Emergency (Police, Fire, Ambulance)", value: "999", href: "tel:999" },
  { label: "Emergency (alternative)", value: "112", href: "tel:112" },
  { label: "Kenya Red Cross", value: "1199", href: "tel:1199" },
  { label: "MajiMvua support", value: "support@majimvua.example", href: "mailto:support@majimvua.example" },
];

export default function Navbar({ contacts = DEFAULT_CONTACTS }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close the contacts panel when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;

    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="navbar">
      <a className="navbar__brand" href="/" aria-label="MajiMvua home">
        <svg className="navbar__logo" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3C16 3 6 14.5 6 20a10 10 0 0 0 20 0C26 14.5 16 3 16 3Z" fill="currentColor" />
          <path d="M11 21c1.5 1.8 3 2.5 5 2.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
        <span className="navbar__name">MajiMvua</span>
      </a>

      <div className="navbar__contacts" ref={wrapperRef}>
        <button
          type="button"
          className="navbar__button"
          aria-expanded={open}
          aria-controls="contacts-panel"
          onClick={() => setOpen((o) => !o)}
        >
          Contacts
        </button>

        {open && (
          <div id="contacts-panel" className="navbar__panel" role="dialog" aria-label="Emergency contacts">
            <h2 className="navbar__panel-title">Who to call</h2>
            <ul className="navbar__list">
              {contacts.map((c) => (
                <li key={c.label}>
                  <a href={c.href} className="navbar__contact">
                    <span className="navbar__contact-label">{c.label}</span>
                    <span className="navbar__contact-value">{c.value}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
