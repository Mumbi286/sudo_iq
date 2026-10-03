// node seed-feed.js
const API = "http://localhost:4000";
const LAT = -1.2610, LON = 36.8560; // Mathare

const POSTS = [
  { platform: "X",         reporterId: "x_wanjiru", text: "Mathare 4A road underwater, matatu can't pass" },
  { platform: "WhatsApp",  reporterId: "wa_otieno", text: "Huruma drain overflow, water entering shops" },
  { platform: "SMS",       reporterId: "sms_2547",  text: "Kibera line 3 flooded, water at knee level" },
  { platform: "Facebook",  reporterId: "fb_akinyi", text: "Waterlogged section, cars stuck near market" },
  { platform: "X",         reporterId: "x_mwangi",  text: "Mathare water levels rising near the bridge" },
  { platform: "Telegram",  reporterId: "tg_amina",  text: "Road blocked by floodwater, avoid this area" },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (const p of POSTS) {
    const jitter = () => (Math.random() - 0.5) * 0.004;
    const res = await fetch(`${API}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...p,
        source: "social_media",
        consent: true,
        lat: LAT + jitter(),
        lon: LON + jitter(),
      }),
    });
    const d = await res.json();
    console.log(`${p.platform.padEnd(9)} → ${d.score ?? "?"}%  ${d.report?.status ?? d.error}`);
    await wait(4000);
  }
  console.log("feed complete");
})();