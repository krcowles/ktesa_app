import L from 'leaflet'

declare global {
    interface Window {
        _leafletMap?: L.Map | null;
        _geoMarker?: L.Marker;
        _geoPolyline?: L.Polyline;
    }
}