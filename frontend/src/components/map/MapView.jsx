import { useCallback, useMemo } from 'react'
import {
  AttributionControl, CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, ZoomControl,
} from 'react-leaflet'
import { HOUSEHOLD_COLORS, riskStyle, stateColor } from '../../lib/theme'
import FitToZones from './FitToZones'

const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Household dot colour: alert state once one exists, otherwise registered/vulnerable
function householdStyle(h) {
  const color = h.state ? stateColor(h.state) : h.vulnerable > 0 ? HOUSEHOLD_COLORS.vulnerable : HOUSEHOLD_COLORS.registered
  return { color, fillColor: color, fillOpacity: 0.85, weight: 1 }
}

export default function MapView({ zones, households, selectedZoneId, onSelectZone }) {
  // Re-create the zones layer only when the zone set itself changes
  const zonesKey = useMemo(() => zones.features.map((f) => f.properties.id).join(','), [zones])

  const zoneStyle = useCallback(
    (feature) => {
      const { color } = riskStyle(feature.properties.risk_level)
      const selected = feature.properties.id === selectedZoneId
      return {
        color,
        weight: selected ? 3 : 1.5,
        fillColor: color,
        fillOpacity: selected ? 0.25 : 0.1,
        dashArray: selected ? null : '6 6',
      }
    },
    [selectedZoneId],
  )

  const bindZone = useCallback(
    (feature, layer) => {
      layer.bindTooltip(feature.properties.name, { className: 'glass-tooltip', sticky: true })
      layer.on('click', () => onSelectZone(feature.properties.id))
    },
    [onSelectZone],
  )

  return (
    <MapContainer
      className="absolute inset-0 z-0"
      center={[0, 34]}
      zoom={12}
      preferCanvas
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <ZoomControl position="topleft" />
      <AttributionControl position="bottomleft" prefix={false} />

      <GeoJSON key={zonesKey} data={zones} style={zoneStyle} onEachFeature={bindZone} />

      {households.features.map(({ geometry, properties: h }) => (
        <CircleMarker
          key={h.id}
          center={[geometry.coordinates[1], geometry.coordinates[0]]}
          radius={h.vulnerable > 0 ? 5 : 3.5}
          pathOptions={householdStyle(h)}
        >
          <Tooltip className="glass-tooltip">
            <div className="text-xs">
              <div className="font-semibold">{h.head_name ?? `Household #${h.id}`}</div>
              <div>{h.members} people{h.vulnerable > 0 ? ` · ${h.vulnerable} vulnerable` : ''}</div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      <FitToZones zones={zones} selectedZoneId={selectedZoneId} />
    </MapContainer>
  )
}
