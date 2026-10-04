import { useCallback, useMemo } from 'react'
import {
  AttributionControl, CircleMarker, GeoJSON, MapContainer, Pane, TileLayer, Tooltip, ZoomControl,
} from 'react-leaflet'
import { basemapById } from '../../lib/basemaps'
import { HOUSEHOLD_COLORS, WHATSAPP_RING, humanize, riskStyle, stateColor } from '../../lib/theme'
import FitToZones from './FitToZones'

// Household dot colour: alert state once one exists, otherwise registered/vulnerable.
// WhatsApp households (e.g. judges who joined live) get a green ring.
function householdStyle(h) {
  const fill = h.state ? stateColor(h.state) : h.vulnerable > 0 ? HOUSEHOLD_COLORS.vulnerable : HOUSEHOLD_COLORS.registered
  const whatsapp = h.channel === 'WHATSAPP'
  return { color: whatsapp ? WHATSAPP_RING : fill, fillColor: fill, fillOpacity: 0.85, weight: whatsapp ? 3 : 1 }
}

function householdRadius(h) {
  if (h.state === 'NEEDS_HELP') return 7
  if (h.channel === 'WHATSAPP') return 6
  return h.vulnerable > 0 ? 5 : 3.5
}

export default function MapView({ zones, households, selectedZoneId, onSelectZone, basemapId }) {
  const basemap = basemapById(basemapId)

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
      maxZoom={basemap.maxZoom}
      preferCanvas
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer key={basemap.id} url={basemap.url} attribution={basemap.attribution} maxZoom={basemap.maxZoom} />
      {basemap.labelsUrl && (
        // Labels sit above zones and dots but ignore clicks
        <Pane name="labels" style={{ zIndex: 450, pointerEvents: 'none' }}>
          <TileLayer key={`${basemap.id}-labels`} url={basemap.labelsUrl} maxZoom={basemap.maxZoom} />
        </Pane>
      )}
      <ZoomControl position="topleft" />
      <AttributionControl position="bottomleft" prefix={false} />

      <GeoJSON key={zonesKey} data={zones} style={zoneStyle} onEachFeature={bindZone} />

      {households.features.map(({ geometry, properties: h }) => (
        <CircleMarker
          key={h.id}
          center={[geometry.coordinates[1], geometry.coordinates[0]]}
          radius={householdRadius(h)}
          pathOptions={householdStyle(h)}
        >
          <Tooltip className="glass-tooltip">
            <div className="text-xs">
              <div className="font-semibold">{h.head_name ?? `Household #${h.id}`}</div>
              <div>{h.members} people{h.vulnerable > 0 ? ` · ${h.vulnerable} vulnerable` : ''}</div>
              <div className="text-slate-400">Reached by {h.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}</div>
              {h.state && <div className="mt-0.5 capitalize">Status: {humanize(h.state)}</div>}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      <FitToZones zones={zones} selectedZoneId={selectedZoneId} />
    </MapContainer>
  )
}
