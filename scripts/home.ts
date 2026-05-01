interface DebugCoords {
    z: number;
    x: number;
    y: number;
}
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as bootstrap from "bootstrap";
//import { VoidExpression } from 'typescript';

const saverDiv = document.getElementById('save_type') as HTMLDivElement;
var saverModal = new bootstrap.Modal(saverDiv)
// --------------- initMap -----------------
async function initMap() { 
    // DISPLAY THE MAP:
    var latlng = L.latLng(35.2, -106.345);
    
    var map = L.map('map', {
        center: latlng,
        minZoom: 6,
        maxZoom: 16,
        zoom: 6,
        zoomSnap: 1 // no fractional zooms for zoomOptimizer
    });
    L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'USGS The National Map',
        maxNativeZoom: 16,
        maxZoom: 18  // Leaflet will upscale z16 tiles beyond this
    }).addTo(map);
    map.locate({enableHighAccuracy: true, watch: false});
    map.on('locationfound', function (e) {
        latlng = e.latlng;
        map.panTo(latlng);
        marker.setLatLng(latlng);
    });
    // Create pulsing geolocation dot
    const pulseIcon = L.divIcon({
        className: '',
        html: `
          <div class="pulse-container">
            <div class="pulse-ring"></div>
            <div class="pulse-dot"></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    /**
     * This layer provides a map grid of tiles with the tile id's
     * supplied in each tile. This is primarily used for debug in order
     * to identify tiles within the area selected for saving offline.
     */
    class GridDebug extends L.GridLayer {
        createTile(coords: DebugCoords) {
            var tile = document.createElement("DIV");
            tile.style.outline = '1px solid azure'; //#e6e6e6
            tile.style.fontSize = '14pt';
            tile.style.color = "azure";
            tile.innerHTML = [coords.z, coords.y, coords.x].join('/');
            return tile;
        }
    }
    map.addLayer(new GridDebug());
    const marker = L.marker(latlng, { icon: pulseIcon }).addTo(map);
}
initMap();
