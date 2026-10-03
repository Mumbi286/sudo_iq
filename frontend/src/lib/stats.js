// Derive panel numbers from the raw GeoJSON so nothing is hard-coded
export function summarize(zones, households) {
  const byZone = {}
  for (const zone of zones.features) {
    byZone[zone.properties.id] = { households: 0, people: 0, vulnerable: 0 }
  }

  let people = 0
  let vulnerable = 0
  for (const { properties: h } of households.features) {
    people += h.members
    if (h.vulnerable > 0) vulnerable += 1
    const zone = byZone[h.zone_id]
    if (zone) {
      zone.households += 1
      zone.people += h.members
      if (h.vulnerable > 0) zone.vulnerable += 1
    }
  }

  return {
    zones: zones.features.length,
    households: households.features.length,
    people,
    vulnerable,
    byZone,
  }
}
