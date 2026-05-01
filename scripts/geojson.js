import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FeatureCollection, Point } from 'geojson';

/**
 * Adds the three geolocation layers to the map:
 *   1. accuracy circle  – semi-transparent fill showing GPS uncertainty radius
 *   2. pulse ring       – animated expanding ring (CSS keyframe via paint property)
 *   3. dot              – solid filled circle
 *
 * Layers are added on top of everything already in style.json.
 */
var initial_location: FeatureCollection<Point, GeoJsonProperties> = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [-106.2756, 35.2]
            },
            "properties": {
                "name": "Your Location"
            }
        }
    ]
}
L.geoJSON(initial_location, {
    pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
            radius: 12,
            fillColor: 'blue',
            color: 'blue',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.5
        })
    }
}).addTo(map);
/*
export interface MapController {
    map: L.Map;
    // Move the geolocation dot to a new position.
    updateGeolocation: (coords: GeolocationCoordinates) => void;
    // Remove the geolocation dot and stop watching position.
    destroyGeolocation: () => void;
}
*/
/**
 * Initializes the MapLibre map inside `container`, registers PMTiles,
 * and starts geolocation watching.
 *
 * @param containerId  ID of the <div> that will host the map (default: "map").
 * @returns            A MapController with the map instance and helpers.
 *
 * @example
 *   import { initMap } from "./map";
 *   const { map } = await initMap("map");
 */