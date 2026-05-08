/// <reference types="jqueryui" />
/// <reference path="./leaflet-offline.d.ts" />
interface OfflineTileLayerOptions extends L.TileLayerOptions {
    mapname?: string;
}
interface DebugCoords {
    z: number;
    x: number;
    y: number;
}
interface autoObject {
    value: string;
    label: string;
}
interface LeafletGridPosition {
    x: number;
    y: number;
}
interface MapBounds {
    n: number;
    w: number;
    s: number;
    e: number;
}
interface TrackPoint {
    lat: number;
    lng: number;
    elevation: number;
  }
  
import $ from 'jquery';
import 'jquery-ui/ui/widgets/autocomplete';
import 'jquery-ui/themes/base/all.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as bootstrap from "bootstrap";
import 'bootstrap/dist/css/bootstrap.min.css';
import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { tileDownloader } from './tileDownloader';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { Geolocation } from '@capacitor/geolocation';
import { BackgroundGeolocation, Location, CallbackError, StartOptions } from '@capgo/background-geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { type ReadFileResult } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
/**
 * @fileoverview The code herein is largely ported from the v1.0 ktesa_app
 * which utilized osm tiles. V2.0 relies on the usgs arcgis topo/contour
 * tiles for a better hike experience, **BUT** the USGS schema swaps the
 * x and y (row/col) coordinates when fetching tiles. The code was 'massaged' to 
 * accommodate the new usgs tile fetching while retaining the osm coordinate
 * method to calculate rectangles, resulting in less rework.
 * 
 * @version 2.0 Replaces osm method with topo tile from USGS
 */

/**
 *  ----------------- Phone Specific Actions -----------------
 */
// Back navigation: iOS swipe-back gesture works automatically via browser history
if (Capacitor.getPlatform() === 'android') {
    let backPressedOnce = false;
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        backPressedOnce = false; // reset if they navigated away
      } else {
        if (backPressedOnce) {
          App.exitApp();
        } else {
          backPressedOnce = true;
          setTimeout(() => (backPressedOnce = false), 2000); // reset after 2s
        }
      }
    });
}
if (screen.orientation) {
    screen.orientation.addEventListener('change', () => {
        map.invalidateSize();
    });
} else {
    // allow for limited browser testing
    $(window).on('resize', () => {
        map.invalidateSize();
    });
}
// Android requires certain priveleges
const isAndroid = () => {
    return /Android/i.test(navigator.userAgent);
}
async function androidReadWrite() {
    if (await tileDownloader.androidPermissions() === 'denied') {
        notice("This phone is not granting permission to write certain data");
    }
}
if (isAndroid()) {
    androidReadWrite();
} else { // testing only:
    androidReadWrite();
}

/**
 * ----------------- Icon Settings -----------------
 */
const internetIcon = (state:string) => {
    if (state === 'on') {
        $('#won').css('display', 'table-row');
        $('#woff').css('display', 'none');
    } else {
        $('#won').css('display', 'none');
        $('#woff').css('display', 'table-row');
    }
};
// On page load:
if (navigator.onLine) {
    internetIcon('on');
} else {
    internetIcon('off');
}
// Polling after load:
async function checkConnectivity() {
    const url = "https://nmhikes.com/images/geoloc.png";
    try {
        // Use a short timeout to avoid hanging
        const response = await fetch(url, { 
            method: 'HEAD', // HEAD only fetches headers, saving bandwidth
            cache: 'no-store', // Ensure we aren't getting a cached result
            signal: AbortSignal.timeout(4000) 
        });
        if (response.ok) {
            internetIcon('on');
            return true;
        } else {
            internetIcon('off');
            return false;
        }
    } catch (error) {
        console.log("Status: Offline (Request failed or timed out)");
        return false;
    }
}
setInterval(checkConnectivity, 20000);

const useOfflineIcon = (state: string) => {
    if (state === 'online') {
        $('#go_offline').css('display', 'table-row');
        $('#exit_offline').css('display', 'none');
    } else {
        $('#go_offline').css('display', 'none');
        $('#exit_offline').css('display', 'table-row');
    }
}
useOfflineIcon('online'); // initial load state

/**
 * The notification dialog box is a substitute for the window.alert()
 * which can be problematic.
 */
const ok = document.getElementById('ok') as HTMLButtonElement;
const notifier = document.getElementById('notifier') as HTMLDialogElement;
const msg = document.getElementById('msg') as HTMLParagraphElement;
const notice = (message: string) => {
    msg.textContent = message;
    notifier.showModal();
    return;
};
ok.addEventListener('click', () => {
    notifier.close();
    return;
});

/**
 * MODALS
 */
const saverDiv = document.getElementById('save_type') as HTMLDivElement;
var save_type_modal = new bootstrap.Modal(saverDiv);
const mapSave = document.getElementById('om_save') as HTMLDivElement;
var  save_om_map_modal = new bootstrap.Modal(mapSave);

// Designate the tile server for identifying fetch strings
const tile_server = "usgs";

/**
 * ----------------- Main display page -----------------
 */

// Menu operation
const menu_close = () => {
    $('#disp').text("Closed");
    $('#menu').animate({ left: "-=230"}, 500);
}
$('#menu_trigger').on('click', () => {
    if ($('#disp').text() === 'Closed') {
        $('#disp').text("Open");
        $('#menu').animate({ left: "0" }, 500)
    } else {
        menu_close();
    }
});
$('#save_display').on('click', () => {
    menu_close();
    save_type_modal.show();
});

$('body').on('click', '#off_goto', () => {
    useOfflineIcon('offline');
    offlineSelect();
});
$('body').on('click', '#use_map', () => {
    const user_map = $('#select_map').val() as string;
    if (user_map === '') {
        notice("Please select an offline map");
        return false;
    }
    switchTileLayer(map, true, user_map);
    return;
})
$('body').on('click', '#off_exit', () => {
    useOfflineIcon('online');
    switchTileLayer(map, false);
});

$('#play').on('click', () => {
    // turn on track recording
});
$('#pause').on('click', () => {
    // stop track recording temporarily (do not terminate gpx track)
});
$('#stop').on('click', () => {
    // finish track routine: if continuing, start new track
});
$('#dwnld').on('click', () => {
    // download existing gpx data
});
$('#marker').on('click', () => {
    // add a marker at the current location
});
$('#locate').on('click', () => {
    // center the map on the user's location
});
$('#follow').on('click', () => {
    // keep re-centering map or not
});
// Secondary Buttons:
$('#map_save').on('click', () => {
    save_om_map_modal.show();
});
$('#save_om').on('click', () => {
    mapName = $('#map_name').val() as string;
    if (mapName == '') {
        notice("You must supply a name for the map");
        return false;
    }
    tile_save();
    return;
});
/**
 *  --------- initMap ------------
 */
var map: L.Map;
var zoom_level = 7;  // initial display value
const ONLINE_LAYER_OPTIONS: L.TileLayerOptions = {
    attribution: 'USGS The National Map',
    maxNativeZoom: 16,
    maxZoom: 18  // Leaflet will upscale z16 tiles beyond this
};
const ONLINE_TILE_URL = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}';

async function initMap() { 
    // DISPLAY THE MAP:
    var latlng = L.latLng(35.2, -106.345);
    map = L.map('map', {
        center: latlng,
        minZoom: 6,
        maxZoom: 16,
        zoom: zoom_level,
        zoomSnap: 1 // no fractional zooms for zoomOptimizer
    });
    currentTileLayer = L.tileLayer(ONLINE_TILE_URL, ONLINE_LAYER_OPTIONS).addTo(map);

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
    // track the zoom level on map
    const zctrl = document.createElement("DIV");
    const zsym  = document.createTextNode("Z: ");
    zctrl.style.marginLeft = "8px";
    zctrl.style.fontSize = "18px";
    zctrl.style.color = "brown";
    zctrl.style.fontWeight = "bold";
    const zval  = document.createElement("SPAN");
    zval.id = "zval";
    zval.textContent = zoom_level.toString();
    zctrl.append(zsym, zval);
    $('.leaflet-top.leaflet-left').append(zctrl);
    map.addEventListener("zoomend", () => {
        zoom_level = map.getZoom();
        $('#zval').text(" " + zoom_level);
        if (zoom_level < 13) {
            $('#setzoom').removeClass('btn-secondary');
            $('#setzoom').addClass('btn-primary');
        } else {
            $('#setzoom').removeClass('btn-primary');
            $('#setzoom').addClass('btn-secondary');
        }
});
    /**
     * This layer provides a map grid of tiles with the tile id's
     * supplied in each tile. This is primarily used for debug in order
     * to identify tiles within the area selected for saving offline.
     * ---- NOTE: 'z,x,y' is utilized to display USGS tiles ----
     * This allows prior 'osm' method of defining rectangle, where the 
     * coords reflect a 'zoom/column/row' system.
     */
    class GridDebug extends L.GridLayer {
        createTile(coords: DebugCoords) {
            var tile = document.createElement("DIV");
            tile.style.outline = '1px solid azure'; //#e6e6e6
            tile.style.fontSize = '14pt';
            tile.style.color = "azure";
            tile.innerHTML = [coords.z, coords.x, coords.y].join('/');
            return tile;
        }
    }
    map.addLayer(new GridDebug());
    const marker = L.marker(latlng, { icon: pulseIcon }).addTo(map);
}
initMap();

/** 
 * ----------------- Menu Options -----------------
 */

// ------- OFFLINE MAP SAVE OPTIONS -------
var save_type: string;
var map_center: L.LatLng;
var track_string: string;

/**
 * 1. Import a site hike (imports map center, bounds, and gpx file)
 */
$('#site').on('click', () => {
    let hikename = $('#search').val() as string;
    if (hikename == '') {
        notice("Please select a hike");
        return false;
    }
    importHike(hikename);
    return;
});
const importHike = async (hike: string) => {
    // NOTE: headers required for post (otherwise expects json)
    const site_data = await CapacitorHttp.post({
        url: 'https://nmhikes.com/ktesa_app/importHike.php',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: { 
            hike: hike
        },
        responseType: 'text'
    });
    var map_string = site_data.data;
    save_type = "import";
    $('#search').val("");
    $('#site').prop('diabled', true);
    siteHike(map_string);
};
const ui_sources = async () => {
    var hikeSources: autoObject[];
    const autosources = await CapacitorHttp.get({
        url: 'https://nmhikes.com/ktesa_app/appSiteHikes.php',
        responseType: 'text'
    });
    hikeSources = JSON.parse(autosources.data);
    ($('#search') as JQuery<HTMLInputElement>).autocomplete({
        appendTo: '.modal-body',
        source: hikeSources,
        minLength: 2
    });
    $('#search').on("autocompleteselect", function (event, ui) {
        event.preventDefault();
        var hike = ui.item.value;
        $('#search').val(hike);
        $('#site').prop('disabled', false);
    });
    $('body').on('click', '#clear', function () {
        $('#search').val("").trigger("focus");
    });
}
ui_sources();
function siteHike(map_data: string) {
    if (map_data === 'Upload') {
        notice("File upload error - please check the selected file");
        return false;
    } else if (map_data === 'Extension') {
        notice("Selected file does not have a gpx extension");
        return false;
    } else if (map_data.indexOf("There is an error") !== -1) {
        notice(map_data);
        return false;
    } else {
        var result_array = JSON.parse(map_data);
        var ul = result_array[0];
        var lr = result_array[1];
        var import_nw = ul.map(Number) as number[]; // convert to number
        var import_se = lr.map(Number) as number[];
        var nw = L.latLng(import_nw[0], import_nw[1]);
        var se = L.latLng(import_se[0], import_se[1]);
        var lat = result_array[2][0] as number;
        var lng = result_array[2][1] as number;
        map_center = L.latLng(lat, lng);
        var track_poly = result_array[3] as L.LatLng[];
        displayImportedTrack(nw, se, map_center, track_poly)
        return;
    }
}

/** 
 * 2. Import a GPX file (same imports a site hike)
 */
var gpximport = document.getElementById('gpxfile') as HTMLInputElement;
var gpx_btn = document.getElementById('gpx') as HTMLButtonElement;
var file2import: File;
var xml: string;
gpx_btn.onclick = function () {
    gpximport.value = "";
    gpx_btn.disabled = true;
    gpximport.style.setProperty('--btn-color', 'mediumseagreen');
    processGpxFile(xml);
};
gpximport.addEventListener('change', (ev: Event) => {
    const target = ev.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
        file2import = files[0];
        const ext = file2import.name.split('.').pop() as string;
        if (ext.toLowerCase() !== 'gpx') {
            notice("You must supply a legitimate gpx file (e.g. myfile.gpx)");
            return false;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const rdr_target = ev.target;
            xml = rdr_target?.result as string;
            $('#gpx').prop('disabled', false);
            gpximport.style.setProperty('--btn-color', 'darkgray');
        }
        reader.readAsText(file2import);
    } else if (typeof files === null) {
        notice("A gpx file has not been selected");
        return false;
    }
    return;
});
function extractTrackPoints(gpxString: string): TrackPoint[] {
    const parser = new XMLParser({
        ignoreAttributes: false,    // Must be false to read lat/lon attributes
        attributeNamePrefix: "@_",  // Prefix for XML attributes in the parsed object
    });
    const parsed = parser.parse(gpxString);
    // only use the first track when there are multiple
    const firstTrk = parsed?.gpx?.trk;
    const trk = Array.isArray(firstTrk) ? firstTrk[0] : firstTrk;
    if (!trk) {
      throw new Error("No track found in GPX file");
    }
    const trksegs = Array.isArray(trk.trkseg) ? trk.trkseg : [trk.trkseg];

    return trksegs.flatMap((trkseg: any) => {
        const trkpts = Array.isArray(trkseg.trkpt) ? trkseg.trkpt : [trkseg.trkpt];
        return trkpts.map((pt: any): TrackPoint => ({
            lat: parseFloat(pt["@_lat"]),
            lng: parseFloat(pt["@_lon"]),
            elevation: parseFloat(pt.ele),
        }));
    });
}
function processGpxFile(xml: string) {
        const valid = XMLValidator.validate(xml, {
            allowBooleanAttributes: true
        });
        if (!valid) {
            notice("GPX file cannot be validated");
        }
        const points = extractTrackPoints(xml);
        save_type = "import";
        let all_lats = [] as number[];
        let all_lngs = [] as number[];
        let poly_pt: L.LatLng;
        let poly = [] as L.LatLng[];
        for (let j=0; j<points.length; j++) {
            all_lats.push(points[j].lat);
            all_lngs.push(points[j].lng);
            poly_pt = L.latLng(points[j].lat, points[j].lng);
            poly.push(poly_pt);
        }
        const minlat = Math.min(...all_lats);
        const maxlat = Math.max(...all_lats);
        const minlng = Math.min(...all_lngs);
        const maxlng = Math.max(...all_lngs);
        const nw = L.latLng(minlat, minlng);
        const se = L.latLng(maxlat, maxlng);
        const lat_ctr = (maxlat - minlat)/2 + minlat;
        const lng_ctr = (maxlng - minlng)/2 + minlng;
        map_center = L.latLng(lat_ctr, lng_ctr);
        displayImportedTrack(nw, se, map_center, poly);
        return;
}

/**
 * For imports (site hike or gpx file), this function renders the captured data
 * as a track on the map. From this point, the relevant data can be saved.
 */
function displayImportedTrack(
    nw: L.LatLng, se: L.LatLng, mapctr: L.LatLng, polyline: L.LatLng[]
): void {
    save_type_modal.hide();
    /**
     * Negative numbers can be confusing, so here I use
     * absolute values and convert back for longitudes
     * NOPTE: array [0] is lat value, [1] is lng value
     */
    var latmarg = 0.10*(nw.lat - se.lat)/2;
    var abslng_west = Math.abs(nw.lng);
    var abslng_east = Math.abs(se.lng);
    var absmarg = 0.20*(abslng_west - abslng_east)/2
    var lngmarg = -absmarg;
    // leaflet expects bounds expressed as ne, sw
    const ne = L.latLng(nw.lat+latmarg, se.lng-lngmarg);
    const sw = L.latLng(se.lat-latmarg, nw.lng+lngmarg);
    const track_bounds = L.latLngBounds(ne, sw);
    // my upper left to lower right box
    nw = L.latLng(nw.lat+latmarg, nw.lng+lngmarg);
    se = L.latLng(se.lat-latmarg, se.lng-lngmarg);
    
    L.rectangle(track_bounds, {color:'darkgreen', fill: false, weight: 2}).addTo(map);
    //let n = 0;  // color pointer NO LONGER ACCEPTING MULTIPLE TRACKS PER IMPORT...
    L.polyline(polyline, {color: 'blue'}).addTo(map);

    // tracks & bounds rectangle are added, now pan to center of map
    map.flyTo(mapctr, 13, {duration: 1.5});
    setTimeout( () => {
        map.invalidateSize();
        zoomOptimizer();
    }, 2000);
    track_string = JSON.stringify(polyline);
    startX = nw.lat;
    startY = nw.lng;
    endX   = se.lat;
    endY   = se.lng;
    save_type = "import";
    $('#map_save').css('display', 'inline');
    return;
}
/**
 * After a map area is specified, there may actually be sufficient
 * space to zoom in, which reduces memory load.
 */
function zoomOptimizer() {
    const nw = L.latLng(startX, startY);
    const se = L.latLng(endX, endY);
    const rectBounds = L.latLngBounds(nw, se);
    map.fitBounds(rectBounds, {
        padding: [6,6],
        maxZoom: 18,
        animate: false
    });
    const new_zoom = map.getZoom();
    if (new_zoom > 16) {
        map.setZoom(16);
    }
    return;
}
/**
 *  3. User can draw a rectangle on the map and save it (without a gpx track).
 * Later, the map can be used and a track can be captured if desired.
 */
var bounds: MapBounds;  // supplied to the tileDownloader for downloading regions
var rect: L.Rectangle;
var startX: number;  // lat of upper-left tile; ul[0]
var startY: number;  // lng of upper-left tile; ul[1]
var endX: number;    // lat of lower-right tile; lr[0]
var endY: number;    // lng of lower-right tile; lr[1]
// tile positions as object {x:tilex, y:tiley}:
var tile_coords = [] as LeafletGridPosition[][];
tile_coords[10] = [];
tile_coords[11] = [];
tile_coords[12] = [];
tile_coords[13] = []; 
tile_coords[14] = [];
tile_coords[15] = [];
$('body').on('click', '#rect', function () {
    const zlevel = map.getZoom();
    if (zlevel < 13) {
        notice("Minimum zoom level is 13");
        return false;
    }
    $(this).removeClass('btn-primary');
    $(this).addClass('btn-secondary');
    $(this).prop("disabled", true);
    if (typeof rect !== 'undefined') {
        rect.remove();
    }

    // Setup touch event handling
    map.dragging.disable();
    var container = map.getContainer();
    L.DomEvent.on(container, 'touchstart', function(e) {
        L.DomEvent.preventDefault(e);
        save_type = "draw";
        start_rect(e);
    });
    L.DomEvent.on(container, 'touchmove', function(e) {
        L.DomEvent.preventDefault(e);
        draw_rect(e)
    });
    L.DomEvent.on(container, 'touchend', function(e) {
        L.DomEvent.preventDefault(e);
        end_rect(e)
    });
    function start_rect(ev: any) {
        var touch = ev.touches[0];
        //var startRect = map.mouseEventToLatLng(ev.originalEvent);
        var startRect = map.mouseEventToLatLng(touch);
        startX = startRect.lat;
        startY = startRect.lng;
        var rectX = startX + 0.005;
        var rectY = startY + 0.005;
        var crnr1 = L.latLng(startX, startY);
        var crnr2 = L.latLng(rectX, rectY);
        var latlngs = L.latLngBounds(crnr1, crnr2); //[[startX, startY], [rectX, rectY]];
        var rectOpts = { color: 'Green', weight: 1 };
        rect = L.rectangle(latlngs, rectOpts);
        rect.addTo(map);
        //click_cnt = 1;
    }
    function draw_rect(ev: any) {
        rect.removeFrom(map);
        var touch = ev.touches[0];
        var newRect = map.mouseEventToLatLng(touch);
        //var newRect = map.mouseEventToLatLng(ev.originalEvent);
        var rectX = newRect.lat;
        var rectY = newRect.lng;
        var crnr1 = L.latLng(startX, startY);
        var crnr2 = L.latLng(rectX, rectY);
        var latlngs = L.latLngBounds(crnr1, crnr2); //[[startX, startY], [rectX, rectY]];
        var rectOpts = { color: 'Green', weight: 1 };
        rect = L.rectangle(latlngs, rectOpts);
        rect.addTo(map);
    }
    function end_rect(ev: any) {
        var touchlist = ev.changedTouches;
        var items = touchlist.length;
        var touch = touchlist.item(items-1);
        var endRect = map.mouseEventToLatLng(touch);
        //var endRect = map.mouseEventToLatLng(ev.originalEvent);
        endX = endRect.lat;
        endY = endRect.lng;
        var lat_ctr = startX - (startX - endX)/2;
        var lng_ctr = startY + (endY - startY)/2;
        map_center = L.latLng(lat_ctr, lng_ctr);
        //map.dragging.enable();
        bounds = getRectBounds();
        $('#map').off();
    }
    return;
});
/**
 * This function identifies tile bounds for the user-selected region.
 * For this app, the 'main' region is the user's map at zoom level and up;
 * The tile manager expects bounds to have numeric lat/lng values:
 * also required are lower zoom levels from zoom down to 10 - which are
 * calculated and loaded separately. Each of the lower zooms comprises a
 * 16x16 matrix of tiles.
 */
function getRectBounds(): MapBounds {
    var north, south, east, west;
    if (startX > endX) {
        north = startX;
        south = endX;
    } else {
        north = endX;
        south = startX;
    }
    if (Math.abs(startY) > Math.abs(endY)) {
        west = startY;
        east = endY;
    } else {
        west = endY;
        east = startY;
    }
    var map_bounds = {n: north, w: west, s: south, e: east};
    return map_bounds;
}

/*
 * ----------------- SAVE OFFLINE MAP -----------------
 */
var ul_tile = [] as number[];
var lr_tile = [] as number[];
var mapName: string;
const save_progress = document.getElementById('stat') as HTMLDivElement;
const save_status = new bootstrap.Modal(save_progress);

/**
 * User may draw from any corner, so establish matrix as if it were
 * drawn from upper left to lower right to simplify processing;
 * ul_tile, lr_tile are [row, col] arrays for upper left tile and lower
 * right tile. [Note: arranging may be somewhat redundant since the 
 * change to 'getRectBounds', but converting lat/lng to tile row/col is 
 * necessary] Use the standard [row, col] designation independent of
 * tile fetching.
 */
function getTileURL(lat: number, lng: number, zoom: number) {
    var latrad = lat * Math.PI / 180;
    var tileX = Math.floor((lng + 180) / 360 * (1 << zoom));
    var tileY = Math.floor((1 - Math.log(Math.tan(latrad)
        + 1 / Math.cos(latrad)) / Math.PI) / 2 * (1 << zoom));
    return [tileX, tileY];  // [row, column]
}
function idTileCorners() {
    var corner1XY = getTileURL(startX, startY, zoom_level); // user 'start' tile array
    var corner2XY = getTileURL(endX, endY, zoom_level);     // user 'end' tile array
    ul_tile = []; // UPPER_LEFT  => [ul_row, ul_col];
    lr_tile = []; // LOWER RIGHT => [lr_row, lr_col];
    if (corner1XY[0] < corner2XY[0]) { // row check
        ul_tile[0] = corner2XY[0];
        lr_tile[0] = corner1XY[0];
    }
    else { 
        ul_tile[0] = corner1XY[0];
        lr_tile[0] = corner2XY[0];
    }
    if (corner1XY[1] < corner2XY[1]) { // col check
        ul_tile[1] = corner1XY[1];
        lr_tile[1] = corner2XY[1];
    }
    else {
        ul_tile[1] = corner2XY[1];
        lr_tile[1] = corner1XY[1];
    }
    return;
}
function loadZoomOutTiles(ul_corner: number[], maxz: number, minz: number) {
    /**
     * Assumption: the most tiles in a portrait display will be 4x2, but when
     * rotated the display will contain 2x4. Only the 2 in each display are common.
     * [Refer to the diagram 'ZoomOutTiles.html'. A base set of four tiles [appearing 
     * in both landscape and portrait] forms the core of the next lower level.
     * Horizontal & portrait displays can be completely covered by a matrix of
     * 16 tiles at the next lower level ['Gang of 16']. All tiles can be derived from
     * one: the upper-left corner of the saved map. The upper left corner will always
     * be in the same position at each zoom level. For each zoomout level, 16 tiles
     * are store in tile_coords.
     */
    var row = ul_corner[0];
    var col = ul_corner[1];
    for (let k=maxz; k>minz-1; k--) { 
        var zoom_minus1 = zoom_out_tile(row, col);
        row = zoom_minus1.x - 1;  // go from row-1 to row+2
        col = zoom_minus1.y - 1;  // go from col-1 to col+2
        // Fill out the Gang of 16:
        for (let i=0; i<4; i++) {
            for (let j=0; j<4; j++) {
                var loc = { x: row+j, y: col+i };
                tile_coords[k].push(loc);
            }
        }
    }
}
function zoom_out_tile(row: number, col: number) {  // for all cases, (currZoom, outZoom, col, row)
    //const zoomDiff = currZoom - outZoom;
    //const divisor = Math.pow(2, zoomDiff);
    const divisor = 2; // for this routine only
    return {
        x: Math.floor(row / divisor),
        y: Math.floor(col / divisor),
        //zoom: outZoom
    };
};

const tile_save = async () => {
    save_om_map_modal.hide();
    // parameter validation:
    zoom_level = map.getZoom();
    if (zoom_level < 13) {
        notice("Please use a minimum of zoom 13");
        return false;
    }
    var stored_zoom = zoom_level.toString();
    const fileExists = await tileDownloader.docFileExists("mapnames.txt");
    if (!fileExists) {
        names_list = [];
    } else {
        const saved_names = await tileDownloader.readMapnames() as string;
        var names_list = saved_names.split(",");
    }
    if (names_list.includes(mapName)) {
        notice("This name is already used; please supply a new name");
        $('#map_name').val("");
        return false;
    } else {
        names_list.push(mapName);
        var new_list = names_list.join(",");
        await tileDownloader.writeMapnames(new_list);
    }
    $('#map_name').val("");
    if (save_type === "import") {
        bounds = getRectBounds();
        const trackWrite = await tileDownloader.writeTrack(mapName, track_string);
        if (!trackWrite) {
            notice("Could not save the track for this hike");
            return false;
        }
    }
    var mapZoom = await tileDownloader.writeSavedZoom(mapName, stored_zoom);
    if (!mapZoom) {
        notice(`Failed to save ${mapName} zoom level`);
    }
    var ctr = JSON.stringify(map_center);
    var ctr_write = await tileDownloader.writeCenter(mapName, ctr);
    if (!ctr_write) {
        notice(`Failure to write map_center: ${mapName}`);
        return false;
    }
    // ensure ul and lr are defined and arranged nw to se:
    idTileCorners();
    save_status.show();
    /**
     * In order to fill out phone screens [only at the current zoom] padding
     * around the rectangle is required. The 'bounds' set [without the padding]
     * is still used to generate zoom-in tiles. For the current zoom_level,
     * download each tile in the padding set before doing the bounds zoom-in region.
     * The number of padding tiles generated will be a relatively small number,
     * so time consumed is not much. 
     * NOTE: Construction of the tile url is left to the tileDownloader class
     * which utilizes the tile_server var to form the url.
     */
    const ur = ul_tile[0];
    const uc = ul_tile[1];
    const lr = lr_tile[0];
    const lc = lr_tile[1];
    $('#base').css('display', 'inline');
    // top row
    for (let row = ur-1, i=uc-1; i<=lc+1; i++) {
        await tileDownloader.downloadTile(zoom_level, row, i, tile_server, mapName);
    }
    tile_coords[zoom_level]
    // bottom row
    for (let row=lr+1, j=uc-1; j<=lc+1;j++) {
        await tileDownloader.downloadTile(zoom_level, row, j, tile_server, mapName);
    }
    // left side
    for (let col=uc-1, k=ur; k<=lr; k++) {
        await tileDownloader.downloadTile(zoom_level, k, col, tile_server, mapName);
    }
    // right side
    for (let col=lc+1, n=ur; n<=lr; n++) {
        await tileDownloader.downloadTile(zoom_level, n, col, tile_server, mapName);
    }
    // Prepare to save 'zoom out' tiles:
    var maxZoomout = zoom_level - 1;
    var minZoomout = 10;
    var ul_start = ul_tile.slice();
    var ZoomoutCnt = (maxZoomout - 9) * 16;
    loadZoomOutTiles(ul_start, maxZoomout, minZoomout);
    // download the loadZoomOutTiles
    $('#zot_cnt').text(ZoomoutCnt);
    let pxperTile = 200/ZoomoutCnt;
    var loaded = 0;
    $('#base').css('display', 'none');
    for (let k=minZoomout; k<zoom_level; k++) {
        var level_coords = tile_coords[k].slice();  // [] = {x.row, y.col}
        /**
         * The for loop is critical to performance! I previously used a 
         * forEach, and the download hung, apparently due to the loop
         * causing a flood of requests swamping the Capacitor bridge.
         */
        for (const tile_obj of level_coords) {
            var x = tile_obj.x;
            var y = tile_obj.y;
            var tileStat = await tileDownloader.downloadTile(k, x, y, tile_server, mapName);
            if (!tileStat) {
                notice(`Could not download tile with coords ${k}, ${x}, ${y} for ${mapName}`);
                break;
            }
            loaded++;
            let out_progress = loaded * pxperTile;
            $('#out_bar').css('width', out_progress);
        }
    }
    // dowload the zoom-ins for the 'bounds' region
    await tileDownloader.downloadRegion(mapName, bounds, [zoom_level, 16], tile_server, saveProgress);
    $('#map_save').css('display', 'none');
    return;
};
/**
 * #progress is 200px wide; 
 */
function saveProgress(complete: number, total: number) {
    $('#zin_cnt').text(total);
    let pixelsPerTile = 200/total;
    let progress = complete * pixelsPerTile;
    $('#bar').css('width', progress);
    if (complete === total) {
        $('#complete').css('display', 'block');
    }
    return;
}

/**
 * ----------------- Map Layer Switching ----------------- 
 */
var currentTileLayer: L.TileLayer | null = null;
const getOnlineLayer = () => {
    return L.tileLayer(ONLINE_TILE_URL, ONLINE_LAYER_OPTIONS);
  };
const getOfflineLayer = (mapname: string) => {
    const options: OfflineTileLayerOptions = {
        mapname,
        maxNativeZoom: 16,
        maxZoom: 18,
    };
    return L.tileLayer.offline('', options);
};
const switchTileLayer = (map: L.Map, useOffline: boolean, mapname?: string) => {
    // Remove existing tile layer
    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }
    // Add the appropriate layer
    currentTileLayer = useOffline && mapname
        ? getOfflineLayer(mapname)
        : getOnlineLayer();
    currentTileLayer.addTo(map).bringToBack();
    return;
};

/**
 * ----------------- Use Offline Map -----------------
 */
const start_modal = document.getElementById('use_offline') as HTMLDivElement;
const maps_available = new bootstrap.Modal(start_modal);
var track_poly: string;
var zooming = false;
var marker: L.Marker;
var tracking: boolean;

/**
 * Declare L.TileLayer.Offline and L.tileLayer.offline only once, then simply
 * switch the layers as needed.
 * 
 * Define offline layer object: here, 'createTile' this overrides the normal
 * layer object's method
 */
L.TileLayer.Offline = L.TileLayer.extend({
    createTile: function (coords: L.Coords) {
        const tile = document.createElement('img');
        const options = this.options as OfflineTileLayerOptions;
        const mapname = options.mapname!;
        // use maxNative zoom to clamp tile loads
        const maxNativeZoom = this.options.maxNativeZoom;
        const nativeZoom = maxNativeZoom !== undefined
            ? Math.min(coords.z, maxNativeZoom)
            : coords.z;
        const url = tileDownloader.getTilePath(
            mapname, nativeZoom, coords.x, coords.y, 'usgs'
        ) as string;        
        tileDownloader.docFileExists(url)
            .then((found) => {
                if (found) {
                    return tileDownloader.getTile(url);
                } else {
                    return false;
                }
            })
            .then((mapTile) => {
                if (mapTile) {
                    tile.src = `data:image/png;base64,${mapTile.data ?? mapTile}`;
                }
            })
            .catch((err) => {
                console.error('Tile error:', err);
            });
        return tile;
    }
}) as unknown as L.OfflineTileLayerClass;
L.tileLayer.offline = function(url: string, options?: OfflineTileLayerOptions) {
    return new L.TileLayer.Offline(url, options);
};
// Instantiate the offline map: arguments obtained when user selects map
const offlineMap = (mapname: string, map_ctr: L.LatLng, map_zoom: number, track: string) => {
    map = L.map('map', {
        center: map_ctr,
        minZoom: 10,
        maxZoom: 18,
        zoom: map_zoom
    });
    L.tileLayer.offline('', {
        mapname,
        maxNativeZoom: 16,
        maxZoom: 18,
        } as OfflineTileLayerOptions
    ).addTo(map);
    L.tileLayer.offline('', {
        attribution: 'USGS'
    }).addTo(map);
    // point to the starting zoom level
    const zctrl = document.createElement("DIV");
    const zsym = document.createTextNode("Z: ");
    zctrl.style.marginLeft = "8px";
    zctrl.style.fontSize = "14px";
    zctrl.style.color = "brown";
    zctrl.style.fontWeight = "bold";
    const zval = document.createElement("SPAN");
    zval.id = "zval";
    zval.textContent = map.getZoom().toString();
    zctrl.append(zsym, zval);
    $('.leaflet-top.leaflet-left').append(zctrl);
    // debounce zoom: zoomend isn't working
    map.addEventListener("zoom", () => {
        if (!zooming) {
            zooming = true;
            setTimeout(() => {
                var moving_zoom = (map as L.Map).getZoom();
                $('#zval').text(" " + moving_zoom);
                zooming = false;
            }, 100);
        }
    });
    if (track !== '') {
        const latlng_arr = JSON.parse(track);
        L.polyline(latlng_arr, {color: 'blue'}).addTo(map);
    }
    map.invalidateSize();
    return;
}
// Create modal offline map selections for user
async function prepareMapNames() {
    const mapnamesFile = await tileDownloader.docFileExists('mapnames.txt');
    if (mapnamesFile) {
        $('#select_map').empty();
        const savedMaps = await tileDownloader.readMapnames() as string;
        const userMaps = savedMaps.split(",");
        for (const map of userMaps) {
            const option = `<option value="${map}">${map}</option>`;
            $('#select_map').append(option);
        }
    } else {
        $('#available').css('display', 'none');//
        $('#no_maps').css('display', 'block');
        $('#use_map').prop('disabled', true);
    }  
    return;
}
function offlineSelect() {
    // Presentation to user for offline map selection
    prepareMapNames()
    .then( () => {
        maps_available.show();
    });
}
$('body').on('click', '#use_map', () => {
    let choice = $('#select_map').val() as string;
    if (choice === '') {
        notice("Select a map to display");
        return false;
    }
    maps_available.hide();
    displayMap(choice);
    return;
});
const displayMap = async (map_name: string) => {
    const mapCtr = await tileDownloader.readCenter(map_name) as ReadFileResult;
    if (!mapCtr) {
        const msg = `Could not read map center for ${map_name}`;  
        notice(msg);
        return false;
    }
    const leaflet_ctr = mapCtr.data as string;
    const center = JSON.parse(leaflet_ctr) as L.LatLng;
    const map_track = await tileDownloader.readTrack(map_name) as ReadFileResult;
    if (!map_track) {
        track_poly = '';
    } else {
        track_poly = map_track.data as string;
    }
    var zoomSet: number;
    const savedZoom = await tileDownloader.readSavedZoom(map_name) as any;
    if (!savedZoom) {
        const msg = `Could not retrieve zoom level at which ${map_name} was saved`
        + "\nMap will display at zoom level 10";
        zoomSet = 10;
        notice(msg);
    } else {
        const mapZoom = savedZoom.data as string;
        zoomSet = JSON.parse(mapZoom);
    }
    offlineMap(map_name, center, zoomSet, track_poly);
    requestNotificationPermission(true);
    return;
}
async function requestNotificationPermission(enable: boolean) {
    if (!enable) {
        await BackgroundGeolocation.stop();
    } else {
        // Check the current status
        let permStatus = await LocalNotifications.checkPermissions();
        // If not already granted, request it
        if (permStatus.display !== 'granted') {
            permStatus = await LocalNotifications.requestPermissions();
        }
        if (permStatus.display === 'granted') {
            // Geolocation...
            (async () => {
                // set initial marker location
                try {
                    const initial = await Geolocation.getCurrentPosition({
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 5000
                    });
                    const lat = initial.coords.latitude;
                    const lng = initial.coords.longitude;
                    const latlng = [lat, lng] as L.LatLngExpression;
                    marker = L.marker(latlng, { icon: customIcon }).addTo(map as L.Map);
                    //map?.setView(latlng); // optional: center map immediately
                } catch (e) {
                    console.warn('Initial position failed:', e);
                }

                const config: StartOptions = {
                    backgroundMessage: "",
                    backgroundTitle: "Tracking...",
                    requestPermissions: true,
                    stale: false,  // Always get fresh data
                    distanceFilter: 5  // Highest frequency updates
                };
                const onPosition = (position?: Location | undefined, error?: CallbackError) => {
                    if (error) {
                        if (error.code !== 'ALREADY_STARTED') {
                            if (error.code === "NOT_AUTHORIZED") {
                                if (window.confirm(
                                    "This app needs your location, " +
                                    "but does not have permission.\n\n" +
                                    "Open settings now?"
                                )) {
                                    BackgroundGeolocation.openSettings();
                                }
                            } else {
                                const msg = error.code as string;
                                notice(msg);
                            }
                        }
                        return; 
                    }
                    if (!position) return;
                    // Position logic
                    const lat = position?.latitude as number;
                    const lng = position?.longitude as number;
                    const ele = position?.altitude as number;
                    $('#lat').text(lat.toFixed(5));
                    $('#lng').text(lng.toFixed(5));
                    const latlng = [lat, lng] as L.LatLngExpression
                    if (typeof marker === 'undefined') {
                        marker = L.marker(latlng, {icon: customIcon}).addTo(map as L.Map);
                    }
                    marker.setLatLng(latlng);
                    if (tracking) tracker(lat, lng, ele);
                    return;
                };
                
                await BackgroundGeolocation.start(config, onPosition);
            })();    
        } else {
            //console.error("Notification permission denied. Background tracking may be throttled.");
            let msg = "Notification permission denied: Tracking will be disabled";
            notice(msg);
        }
    }
};
/**
 * When a user wishes, he may delete a saved map: Obviously, at least one
 * 'mapname' resides in the 'mapnames.txt' file when 'delmap' is clicked.
 */
$('body').on('click', '#delmap', async function() {
    const choice = $('#select_map').val() as string;
    const choice_opt = "option[value=" + choice + "]";
    $("#select_map " + choice_opt).remove();
    const stored_mapnames = await tileDownloader.readMapnames() as unknown as string;
    const map_list = stored_mapnames.split(",");
    const indx = map_list.indexOf(choice);
    if (indx !== -1) {
        map_list.splice(indx, 1);
    }
    if (map_list.length === 0) {
        await tileDownloader.deleteFile("mapnames.txt");
    } else {
        const new_map_list = map_list.join(",");
        await tileDownloader.writeMapnames(new_map_list);
    }
    await tileDownloader.removeData(choice);
    return;
});