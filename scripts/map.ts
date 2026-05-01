interface GeolocationState {
    watchId: number | null;
    hasInitialFix: boolean;
}
/**
 * map.ts
 * Initializes MapLibre GL JS with a local PMTiles vector-tile source,
 * registers the PMTiles protocol handler, and places an animated
 * geolocation marker on first launch.
 */
import maplibregl, {
    Map,
    MapOptions,
    GeoJSONSource,
    LngLatLike,
} from "maplibre-gl";
import { Protocol, PMTiles, Source, RangeResponse } from "pmtiles";
import styleJson from '../../assets/style.json';

// Attempting to find a way to acutally fetch pmtiles...
class CapacitorAssetSource implements Source {
    private url: string;
  
    constructor(assetPath: string) {
        // Capacitor serves public/ assets at https://localhost/
        this.url = `https://localhost/assets/${assetPath}`;
    }
    async getBytes(offset: number, length: number): Promise<RangeResponse> {
        const response = await fetch(this.url, {
            headers: {
                Range: `bytes=${offset}-${offset + length - 1}`,
            },
        });
      
        if (!response.ok && response.status !== 206) {
            throw new Error(`HTTP ${response.status}`);
        }
      
        const data = await response.arrayBuffer();
        return { data };
    }
    getKey(): string {
        return this.url;
    }
}

export interface MapController {
    map: Map;
    /** Move the geolocation dot to a new position. */
    updateGeolocation: (coords: GeolocationCoordinates) => void;
    /** Remove the geolocation dot and stop watching position. */
    destroyGeolocation: () => void;
}

// The following const is used to provide debug output
const PMTILES_URL = `${window.location.origin}/assets/us-z5-z7.pmtiles`;

/** GeoJSON source / layer IDs for the geolocation dot. */
const GEO_SOURCE_ID = "geolocation-source";
const GEO_DOT_LAYER_ID = "geolocation-dot";
const GEO_PULSE_LAYER_ID = "geolocation-pulse";
const GEO_ACCURACY_LAYER_ID = "geolocation-accuracy";
/** Default map center (contiguous US centroid) used before GPS fix. */
const DEFAULT_CENTER: LngLatLike = [-106.63, 35.1];
const DEFAULT_ZOOM = 5;
const LOCATED_ZOOM = 7;


/**
 * Registers the "pmtiles://" protocol with MapLibre exactly
 * once on load.
 */
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);
const source = new CapacitorAssetSource('us-z5-z7.pmtiles');
const pmtiles = new PMTiles(source);  // wrap the source
protocol.add(pmtiles);  

/**
 * Builds an empty GeoJSON Feature for the user dot.
 * The geometry is null until we have a real fix.
 */
function makeEmptyPointFeature(): GeoJSON.Feature<GeoJSON.Point> {
    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {},
    };
}
/** Converts a GeolocationCoordinates object to a GeoJSON point feature. */
function coordsToFeature(
    coords: GeolocationCoordinates
): GeoJSON.Feature<GeoJSON.Point> {
    return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [coords.longitude, coords.latitude],
        },
        properties: {
          accuracy: coords.accuracy,
        },
    };
}

/**
 * Adds the three geolocation layers to the map:
 *   1. accuracy circle  – semi-transparent fill showing GPS uncertainty radius
 *   2. pulse ring       – animated expanding ring (CSS keyframe via paint property)
 *   3. dot              – solid filled circle
 *
 * Layers are added on top of everything already in style.json.
 */
function addGeolocationLayers(map: Map): void {
    // Source – starts empty; updated by updateGeolocation()
    map.addSource(GEO_SOURCE_ID, {
        type: "geojson",
        data: makeEmptyPointFeature(),
    });

    // 1 · Accuracy radius circle
    map.addLayer({
        id: GEO_ACCURACY_LAYER_ID,
        type: "circle",
        source: GEO_SOURCE_ID,
        paint: {
            // accuracy (metres) → pixel radius via camera projection helper
            "circle-radius": [
                "interpolate",
                ["exponential", 2],
                ["zoom"],
                // At zoom 0 accuracy metres → ~0 px; at zoom 22 accuracy metres → full px
                // We bake in a scaling factor; MapLibre doesn't expose metresToPixels
                // directly in expressions, so we approximate with a zoom-based curve.
                0, 0,
                22, ["*", ["get", "accuracy"], 0.02],
            ],
            "circle-color": "#4A90E2",
            "circle-opacity": 0.15,
            "circle-stroke-color": "#4A90E2",
            "circle-stroke-width": 1,
            "circle-stroke-opacity": 0.4,
            "circle-pitch-alignment": "map",
        },
    });

    // 2 · Pulse ring – a larger, fading circle for the "heartbeat" effect.
    //     True CSS animation isn't available in GL paint; we'll drive this with
    //     requestAnimationFrame in animatePulse() below.
    map.addLayer({
        id: GEO_PULSE_LAYER_ID,
        type: "circle",
        source: GEO_SOURCE_ID,
        paint: {
            "circle-radius": 14,
            "circle-color": "transparent",
            "circle-stroke-color": "#4A90E2",
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.8,
            "circle-pitch-alignment": "map",
        },
    });

    // 3 · Solid dot
    map.addLayer({
        id: GEO_DOT_LAYER_ID,
        type: "circle",
        source: GEO_SOURCE_ID,
        paint: {
            "circle-radius": 7,
            "circle-color": "#4A90E2",
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": 2,
            "circle-pitch-alignment": "map",
        },
    });
}

/**
 * Drives the pulsing animation on the geolocation ring.
 * Returns a cancel function.
 */
function animatePulse(map: Map): () => void {
    let rafId: number;
    let startTime: number | null = null;
    const PERIOD_MS = 1800; // one full pulse cycle

    function frame(ts: number): void {
        if (startTime === null) {
            startTime = ts;
        }
        const elapsed = (ts - startTime) % PERIOD_MS;
        const t = elapsed / PERIOD_MS; // 0 → 1

        // Radius grows from 7 → 22 px, opacity 0.8 → 0
        const radius = 7 + t * 15;
        const opacity = 0.8 * (1 - t);

        if (map.getLayer(GEO_PULSE_LAYER_ID)) {
            map.setPaintProperty(GEO_PULSE_LAYER_ID, "circle-radius", radius);
            map.setPaintProperty(
                GEO_PULSE_LAYER_ID,
                "circle-stroke-opacity",
                opacity
            );
        }

        rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
}

// --------------- initMap -----------------

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
export async function initMap(
    containerId = "map",
): Promise<MapController> {
    /**
     * -------- SECTION OF TESTS -------
     */
    console.log('[map] PMTILES_URL:', PMTILES_URL);
    console.log('[map] registered protocols:', Object.keys(maplibregl.config.REGISTERED_PROTOCOLS));
    
    // Test PMTiles file
    try {
        const test = await fetch(PMTILES_URL, { method: 'HEAD' });
        console.log("[map] PMTiles fetch status:", test.status);
    } catch (e) {
        console.error("[map] PMTiles fetch failed:", e);
    }
    /*
    try {
        const test = await fetch(`https://localhost/assets/sprites/osm-liberty.json`);
        const text = await test.text();
        //console.log("[map] sprite content preview:", text.slice(0, 50));
    } catch (e) {
        console.error("[map] sprite fetch failed:", e);
    }
    
    // Test a glyph
    try {
        const glyphUrl = `https://localhost/assets/fonts/Noto Sans Regular/0-255.pbf`;
        const test = await fetch(glyphUrl);
        //console.log("[map] glyph fetch status:", test.status);
    } catch (e) {
        console.error("[map] glyph fetch failed:", e);
    }
    */
    // -------------- END TESTING SECTION ---------

    /**
     * 2  Validate the PMTiles file is reachable (non-fatal; warn + continue).
     *    Capacitor bundles www/ into the app bundle; the file is always present
     *    after a successful build, but this helps during development.
     */ 
    try {
        const probe = await fetch(PMTILES_URL, {
            method: "HEAD",
            cache: "no-store",
        });
        if (!probe.ok) {
            console.warn(
              `[map] PMTiles probe returned ${probe.status} for "${PMTILES_URL}". ` +
                "Tiles may not render correctly."
            );
        } else {
            console.debug(`[map] PMTiles file confirmed: ${PMTILES_URL}`);
        }
    } catch (err) {
        console.warn("[map] PMTiles probe failed (network/file error):", err);
    }

    /**
     * 3   Build the map options. transformRequest rewrites any relative
     *     pmtiles:// URL so the Protocol handler can open it correctly.
     *     ----- NOTE: style expects absolute urls, so the 'patchedStyle' was added
     */    
    const patchedStyle = {
        ...styleJson,
        sprite: `${window.location.origin}/assets/sprites/osm-liberty`,
        glyphs: `${window.location.origin}/assets/fonts/{fontstack}/{range}.pbf`,
        sources: {
            ...styleJson.sources,
            openmaptiles: {
                ...(styleJson.sources as any).openmaptiles,
                url: `pmtiles://us-z5-z7.pmtiles`,
            },
        },
        layers: styleJson.layers.map(layer => {
            if (layer.layout?.['text-font']) {
                // TEST:
                //console.log('[map] remapping font on layer:', layer.id, layer.layout['text-font']);
                return {
                    ...layer,
                    layout: {
                      ...layer.layout,
                      'text-font': ['Noto Sans Regular'],
                    },
                };
            }
            return layer;
        }),
    } as unknown as maplibregl.StyleSpecification;
    // TEST:
    /*
    styleJson.layers.forEach(layer => {
        if (layer.layout?.['text-font']) {
          console.log('[map] text-font value:', JSON.stringify(layer.layout['text-font']));
        }
    });
    */
    //console.log("[map] origin:", window.location.origin);
    //console.log("[map] sprite URL:", patchedStyle.sprite);
    // EOT
    const options: MapOptions = {
        container: containerId,
        style: patchedStyle,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false, // add a compact one below
        maxPitch: 60,
        // Offline – no network tiles allowed outside the bundled file.
        // (Add networkRestriction or maxBounds here if desired.)
    };
  
    const map = new Map(options);

    /**
     *  Compact attribution so it doesn't clutter the hiking UI.
     */ 
    map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
    );

    // Navigation (zoom / rotate) control.
    map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        "top-right"
    );

    // 4 · Wait for the style to fully load before adding our layers.
    await new Promise<void>((resolve, reject) => {
        map.once("load", resolve);
        map.once("error", (e) => {
            console.error("[map] Map load error full:", JSON.stringify(e.error));
            console.error("[map] Map load error message:", e.error?.message);
            console.error("[map] Map load error stack:", e.error?.stack);
            console.error("[map] Map load error:", e);
            reject(e.error ?? new Error("Map failed to load"));
        });
    });

    // TEST:
    console.debug("[map] Style loaded. Adding geolocation layers…");

    addGeolocationLayers(map);
    const cancelPulse = animatePulse(map);

    // 5 · Geolocation state
    const geoState: GeolocationState = {
      watchId: null,
      hasInitialFix: false,
    };

    /**
     * Updates the GeoJSON source with new coordinates and, on the very first
     * fix, flies the camera to the user's position.
     */
    function updateGeolocation(coords: GeolocationCoordinates): void {
        const source = map.getSource(GEO_SOURCE_ID) as GeoJSONSource | undefined;
        if (!source) return;

        source.setData(coordsToFeature(coords));

        if (!geoState.hasInitialFix) {
            geoState.hasInitialFix = true;
            map.flyTo({
              center: [coords.longitude, coords.latitude],
              zoom: LOCATED_ZOOM,
              speed: 1.4,
              curve: 1.42,
              essential: true,
            });
            console.debug(
              `[map] Initial GPS fix → ${coords.latitude.toFixed(5)}, ` +
                `${coords.longitude.toFixed(5)} ±${Math.round(coords.accuracy)}m`
            );
        }
    }

    function destroyGeolocation(): void {
        if (geoState.watchId !== null) {
            navigator.geolocation.clearWatch(geoState.watchId);
            geoState.watchId = null;
        }
        cancelPulse();
        if (map.getLayer(GEO_DOT_LAYER_ID)) map.removeLayer(GEO_DOT_LAYER_ID);
        if (map.getLayer(GEO_PULSE_LAYER_ID)) map.removeLayer(GEO_PULSE_LAYER_ID);
        if (map.getLayer(GEO_ACCURACY_LAYER_ID))
            map.removeLayer(GEO_ACCURACY_LAYER_ID);
        if (map.getSource(GEO_SOURCE_ID)) map.removeSource(GEO_SOURCE_ID);
    }

    // 6 · Start watching geolocation (Capacitor Geolocation plugin or browser API).
    //     The Geolocation Web API is available in Capacitor WebViews; swap for
    //     @capacitor/geolocation if you need background tracking.
    if ("geolocation" in navigator) {
        geoState.watchId = navigator.geolocation.watchPosition(
            (position) => updateGeolocation(position.coords),
            (err) => {
                console.warn("[map] Geolocation error:", err.message);
                // Non-fatal – map still renders, dot just won't appear.
            },
            {
                enableHighAccuracy: true,
                timeout: 10_000,
                maximumAge: 5_000,
            }
        );
    } else {
        console.warn("[map] Geolocation API unavailable in this WebView.");
  }

  return { map, updateGeolocation, destroyGeolocation };
}