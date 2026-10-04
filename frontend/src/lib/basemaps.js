// Keyless basemaps. CARTO now requires an API key and OSM's volunteer servers
// block heavy use, so Esri's public tile services are the default.
// Each basemap = a background layer + an optional transparent labels layer.

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const ESRI_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com">Esri</a>'

export const BASEMAPS = [
  {
    id: 'dark',
    name: 'Dark',
    url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labelsUrl: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    attribution: `${ESRI_ATTRIBUTION} &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors`,
    maxZoom: 16,
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    labelsUrl: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    attribution: `${ESRI_ATTRIBUTION} &mdash; Esri, Maxar, Earthstar Geographics`,
    maxZoom: 18,
  },
  {
    id: 'streets',
    name: 'Streets',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    labelsUrl: null,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
]

export const DEFAULT_BASEMAP_ID = import.meta.env.VITE_BASEMAP || 'dark'

export const basemapById = (id) => BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0]
