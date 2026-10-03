import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

const DESKTOP_MIN_WIDTH = 768

// Leave room for the glass panel: on the right on desktop, at the bottom on phones
function panelPadding() {
  if (window.innerWidth >= DESKTOP_MIN_WIDTH) {
    return { paddingTopLeft: [60, 40], paddingBottomRight: [440, 40] }
  }
  return { paddingTopLeft: [20, 20], paddingBottomRight: [20, Math.round(window.innerHeight * 0.5)] }
}

// Frame the map on whatever zones the API returns (or the selected one), so no coordinates are hard-coded
export default function FitToZones({ zones, selectedZoneId }) {
  const map = useMap()

  useEffect(() => {
    const features = selectedZoneId
      ? zones.features.filter((f) => f.properties.id === selectedZoneId)
      : zones.features
    if (features.length === 0) return

    const bounds = L.geoJSON({ type: 'FeatureCollection', features }).getBounds()
    if (selectedZoneId) {
      map.flyToBounds(bounds, { ...panelPadding(), duration: 0.8 })
    } else {
      map.fitBounds(bounds, panelPadding())
    }
  }, [map, zones, selectedZoneId])

  return null
}
