/// <reference types="jqueryui" />
/// <reference path="../types/leaflet-offline.d.ts" />
interface LeafletHTMLElement extends HTMLElement {
    _leaflet_id?: number | null;
  }
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
import { Filesystem, Directory, Encoding, WriteFileResult, type ReadFileResult } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Preferences } from '@capacitor/preferences';
/**
 * @fileoverview This app has ported some code from the v1.0 ktesa_app
 * which utilized osm tiles. V2.0 relies on the USGS ArcGIS topo/contour
 * tiles for a better hike experience. Note that the USGS schema swaps the
 * x and y (row/col) coordinates when fetching tiles. The User Interface
 * has been significantly modified to provide the user a better view of
 * options via the new menu system. Owing to file size, some exports are
 * utilized and use of arrow functions is reduced to force typescript to
 * handle them properly.
 * 
 * @version 2.0 Replaces osm method with topo tile from USGS
 */

/**
 *  ----------------- Phone Specific Actions -----------------
 */
async function androidReadWrite() {
    if (await tileDownloader.androidPermissions() === 'denied') {
        notice("This phone is not granting permission to write certain data");
    }
    return;
}
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
    androidReadWrite();
}
// Landscape/Portrait
if (screen.orientation) {
    screen.orientation.addEventListener('change', () => {
        map.invalidateSize();
    });
}

// Prevent pinch-zoom on document
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

/**
 * ----------------- Icon Settings -----------------
 */
var internetConnected: boolean;
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
    internetConnected = true;
    internetIcon('on');
} else {
    internetConnected = false;
    internetIcon('off');
}

export async function checkConnectivity() {
    try {
        const response = await CapacitorHttp.request({
            method: 'HEAD',
            url: 'https://nmhikes.com/images/geoloc.png',
            headers: {
            'Cache-Control': 'no-store'
            }
        });
        const ok = response.status >= 200 && response.status < 300;
        internetConnected = ok ? true : false
        return;
    } catch (error) {
        console.log("Status: Offline (Request failed or timed out)");
        internetConnected = false;
        return;
    }
}
setInterval(checkConnectivity, 20000);

function followIcon(state: boolean) {
    if (state) {
        $('#no_follow_map').css('display', 'none');
        $('#follow_map').css('display', 'table-row')
    } else {
        $('#no_follow_map').css('display', 'table-row');
        $('#follow_map').css('display', 'none')
    }
};
// page load state:
var following = false;
followIcon(true);

function trackingState(state: string) {
    if (state === 'off') {
        $('#start_tracking').css('display', 'table-row');
        $('#tracking_on').css('display', 'none');
        $('#tracking_off').css('display', 'table-row');
        $('#stop_tracking').css('display', 'none');
    } else {
        $('#start_tracking').css('display', 'none');
        $('#tracking_on').css('display', 'table-row');
        $('#tracking_off').css('display', 'none');
        $('#stop_tracking').css('display', 'table-row');
    }
}
// page load state:
trackingState('off');

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
 * ----------------- Modals -----------------
 */
const saverDiv = document.getElementById('save_type') as HTMLDivElement;
const save_type_modal = new bootstrap.Modal(saverDiv);
const drawingRect = document.getElementById('draw_setup') as HTMLDivElement;
const drawModal = new bootstrap.Modal(drawingRect);
const start_modal = document.getElementById('maps_available') as HTMLDivElement;
const maps_available = new bootstrap.Modal(start_modal);
const mapSave = document.getElementById('om_save') as HTMLDivElement;
const save_om_map_modal = new bootstrap.Modal(mapSave);
const map_not_saved = document.getElementById('unsaved') as HTMLDivElement;
const unsaved = new bootstrap.Modal(map_not_saved);
const marker_text = document.getElementById('marker_text') as HTMLDivElement;
const textModal = new bootstrap.Modal(marker_text);
const downloadDiv = document.getElementById('save_gpx') as HTMLDivElement;
const downloadModal = new bootstrap.Modal(downloadDiv);
const restore_data = document.getElementById('restore') as HTMLDivElement;
const restoreModal = new bootstrap.Modal(restore_data);

/**
 * ----------------- Main display page -----------------
 */

// Map Globals and Initialization
/**
 * It is necessary to completely destroy any existing map in order to
 * display a new offline map: Note this routine apparently is no longer
 * needed as 'map.remove()' and 'map = null' seem to solve any issues...
 * Leaving code in case a situation arises later.
 */
export function resetMap(containerId = 'map'): L.Map {
    if (window._leafletMap) {
        window._leafletMap.off();
        window._leafletMap.remove();
        window._leafletMap = undefined;
    }
    const container = document.getElementById(containerId) as LeafletHTMLElement | null;
    if (container) {
        container._leaflet_id = null;
    }
    const map = L.map(containerId);
    window._leafletMap = map;
    return map;
}
/**
 * This function will destroy any currently implemented map and
 * then display the offline map selected by the user. Also
 * destroyed are all map objects: markers, polyline, rectangle, etc.
 */
async function loadSelectedMap(mapname: string):Promise<void>  {
    if (online_loaded || offline_loaded) {
        // only one type of map can be loaded at a time
        map.remove();
        // typescript non-null assertion: elminates redeclaring (map as L.Map)
        map = null!;
        online_loaded = offline_loaded = false;
    }
    tileDownloader.writeUnsavedData('sessionMap.txt', mapname);
    displayMap(mapname); // will set offline_loaded via offlineMap()
}

/**
 * Module-level globals including functions
 */
var map: L.Map;
var permissions_requested = false;
var sessionChecked = false;
tileDownloader.writeUnsavedData('sessionMap.txt', '');
const tile_server = "usgs"; // current tile server for ktesa_app
const ONLINE_LAYER_OPTIONS: L.TileLayerOptions = {
    attribution: 'USGS The National Map',
    maxNativeZoom: 16,
    maxZoom: 18  // Leaflet will upscale z16 tiles beyond this
};
const ONLINE_TILE_URL = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}';
const pulseIcon = L.divIcon({  // Create pulsing geolocation dot
    className: '',
    html: `
      <div class="pulse-container">
        <div class="pulse-ring"></div>
        <div class="pulse-dot"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});
var zoom_level = 7;  // initial display value
var marker: L.Marker; // global for geolocation marker only
var zooming = false;
var online_loaded  = false;
var offline_loaded = false;
var zctrl: HTMLElement;
// 'zoomend' isn't working, use this debouncer for 'zoom' listener
const zoom_handler = () => {
    if (!zooming) {
        zooming = true;
        setTimeout(() => {
            var moving_zoom = (map as L.Map).getZoom();
            $('#zval').text(" " + moving_zoom);
            zooming = false;
        }, 200);
    }
    return;
};
var dropMarker = L.icon({
    iconUrl: 'images/app_marker.png',
    iconSize: [32, 32],
    iconAnchor: [15, 32]
});
function zoomctl_setup(start_zoom: number) {
    zctrl = document.createElement("DIV");
    zctrl.id = 'zoomval';
    const zsym  = document.createTextNode("Z: ");
    zctrl.style.marginLeft = "8px";
    zctrl.style.fontSize = "18px";
    zctrl.style.color = "brown";
    zctrl.style.fontWeight = "bold";
    const zval  = document.createElement("SPAN");
    zval.id = "zval";
    zval.textContent = start_zoom.toString();
    zctrl.append(zsym, zval);
    $('.leaflet-top.leaflet-left').append(zctrl);
    map.addEventListener("zoom", zoom_handler);
    return;
}

export async function initMap() { 
    // DISPLAY THE MAP:
    var latlng = L.latLng(35.2, -106.345);
    map = L.map('map', {
        center: latlng,
        minZoom: 5,
        maxZoom: 17,
        zoom: zoom_level,
        zoomSnap: 1 // no fractional zooms for zoomOptimizer
    });
    L.tileLayer(ONLINE_TILE_URL, ONLINE_LAYER_OPTIONS)
        .addTo(map);
    marker = L.marker(latlng, { icon: pulseIcon }).addTo(map);
    map.locate({enableHighAccuracy: true, watch: false});
    map.once('locationfound', function (e) {
        latlng = e.latlng;
        map.panTo(latlng);
        marker.setLatLng(latlng);
    });
    // track the zoom level on map
    zoomctl_setup(zoom_level);
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
    online_loaded = true;
    if (!permissions_requested) {
        requestNotificationPermission()
    } 
    if (!sessionChecked) {
        checkLastSession();
        sessionChecked = true;
    }
    return;
}

// Create modal offline map selections for user
async function prepareMapNames() {
    $('#select_map').empty();
    const mapnamesFile = await tileDownloader.docFileExists('mapnames.txt');
    if (mapnamesFile) {
        const savedMaps = await tileDownloader.readMapnames() as string;
        const userMaps = savedMaps.split(",");
        for (const map of userMaps) {
            const option = `<option value="${map}">${map}</option>`;
            $('#select_map').append(option);
        }
    } else {
        const option = "<option value='No Maps'>No Maps</option>";
        $('#select_map').append(option);
        $('#available').css('display', 'none');//
        $('#no_maps').css('display', 'block');
        $('#use_map').prop('disabled', true);
    }  
    return;
}
async function offlineSelect() {
    await prepareMapNames();
    menu_close();
    maps_available.show();
}
if (internetConnected) { // after page load
    initMap(); // normal situation
} else {
    offlineSelect();
} 

/**
 * ----------------- Menu Actions -----------------
 */
function clearPrevious(): void {
    if (onlineRectangle) {
        map.removeLayer(onlineRectangle);
        map.removeLayer(onlineTrack);
    }
}
function menu_close(): void {
    //enusure any 'left over' buttons are hidden:
    $('#map_save, #clear_rect, #rect').css('display', 'none');
    $('#disp').text("Closed");
    $('#menu').animate({ left: "-=230"}, 1500);
    return;
}
let menu = document.getElementById('menu') as HTMLDivElement;
let menuHt = menu.offsetHeight;
let displayHt = menuHt + 30;
$('#menu').height(displayHt);

$('#menu_trigger').on('click', () => {
    if ($('#disp').text() === 'Closed') {
        $('#disp').text("Open");
        $('#menu').animate({ left: "0" }, 500)
    } else {
        menu_close();
    }
    return;
});
$('body').on('click', '.save_display', () => {
    if (internetConnected) {
        menu_close();
        maps_available.hide();
        if (offline_loaded) {
            map.remove();
            map = null!;
            offline_loaded = false;
            initMap();
        }
        save_type_modal.show();
    } else {
        notice("Cannot save maps when internet is not connected");
    }
    return;
});
$('body').on('click', '#off_goto', () => {
    // #off_goto won't be shown if not connected to internet
    clearPrevious();
    menu_close();
    offlineSelect();
    return;
});
$('body').on('click', '#play', () => {
    tracking = true;
    $('#info').css('display', 'block');
    trackingState('on');
    menu_close();
});
$('body').on('click', '#stop', () => {
    tracking = false;
    $('#info').css('display', 'none');
    trackingState('off');
    menu_close();
});
$('body').on('click', '#dwnld', () => {
    menu_close();
    $('#save_clear').css('display', 'inline');
    downloadModal.show();
});
$('body').on('click', '#trash', () => {
    menu_close()
    let resume = tracking;
    tracking = false;
    miles = 0;
    gpx_pts = [];
    waypts = [];
    if (typeof hike !== 'undefined') {
        map.removeLayer(hike);
    }
    for (let i=0; i<wayMrkrs.length; i++) {
        map.removeLayer(wayMrkrs[i]);
    }
    tracking = resume;
    markSessionClean();
});
$('body').on('click', '#marker', () => {
    menu_close();
    map.locate({enableHighAccuracy: true, watch: false});
    map.once('locationfound', function (e) {
        const myloc = e.latlng;
        const waypt = [myloc.lat, myloc.lng] as number[];
        waypts.push(waypt);
        const wmrkr = L.marker(myloc, {icon: dropMarker}).addTo(map);
        wmrkr.on('click', () => {
            map.setView(myloc);
        });
        wayMrkrs.push(wmrkr);
        let indx = wayMrkrs.length;
        $('#mrkr_indx').text(indx);
        textModal.show();
        markSessionDirty();
        saveSessionState();
    });
});
$('body').on('click', '#locate', () => {
    map.locate({enableHighAccuracy: true, watch: false});
    map.once('locationfound', function(e) {
        let myloc = e.latlng;
        map.setView(myloc);
    });
    menu_close();
});
$('body').on('click', '#follows', () => {
    following = true;
    followIcon(false); // show available next state
    menu_close();
});
$('body').on('click', '#no_follows', () => {
    following = false;
    followIcon(true);
    menu_close();
});

// Modal/Secondary Buttons
$('body').on('click', '#use_map', () => {
    const user_map = $('#select_map').val() as string;
    if (user_map == '') {
        notice("Please select an offline map");
        return false;
    }
    maps_available.hide();
    loadSelectedMap(user_map);
    return;
});

// --- multiple items associated with saving maps ---
var isSaved = false;
function saveUserMap() {
    if (rect_complete) {
        $('#map_save').css('display', 'none');
        $('#clear_rect').css('display', 'none');
        $('#rect').css('display', 'none');
        rect_complete = false;
        $('#map').off(); // DOM events only
        map.dragging.enable();
    }
    isSaved = true;
    tile_save();
    return;
}
$('body').on('click', '#map_save', () => {
    save_om_map_modal.show();
});
$('body').on('click', '#save_om', () => {
    mapName = $('#map_name').val() as string;
    if (mapName == '') {
        notice("You must supply a name for the map");
        return false;
    }
    save_om_map_modal.hide();
    saveUserMap();
    return;
});
mapSave.addEventListener('hidden.bs.modal', () => {
    if (!isSaved) {
        unsaved.show();
    }   
});
$('body').on('click', '#resave', () => {
    mapName = $('#resave_as').val() as string;
    if (mapName == '') {
        notice("You must supply a name for the map");
        return false;
    }
    unsaved.hide();
    saveUserMap();
    return;
});
$('body').on('click', '#ignore_save', () => {
    unsaved.hide();
});
// --- end map saving items ---

$('body').on('click', '#begin_draw', () => {
    clearPrevious();
    save_type_modal.hide();
    drawModal.show();
});
$('body').on('click', '#draw_routine', () => {
    drawModal.hide();
    $('#rect').prop('disabled', false);
    $('#map_save').css('display', 'inline');
    $('#clear_rect').css('display', 'inline');
    $('#rect').css('display', 'inline');
});
$('body').on('click', '#clear_rect', () => {
    map.removeLayer(rect);
    rect_complete = false;
});
$('body').on('click', '#add_marker_text', () => {
    let tooltip = $('#id_text').val() as string;
    let indx = parseInt($('#mrkr_indx').text()) - 1;
    if (tooltip === '') {
        notice('Please enter tooltip text');
        return false;
    }
    wayMrkrs[indx].bindTooltip(tooltip, {
        permanent: true,
        direction: 'right',
    });
    textModal.hide();
    return
});
$('body').on('click', '#save_dwnld', () => {
    downloadRoutine();    
});
$('body').on('click', '#save_clear', () => {
    clear_track = true;
    downloadRoutine(); 
});
function downloadRoutine() {
    const gpx_name = $('#dwnld_name').val() as string;
    if (gpx_name == '') {
        notice("Please supply a name for the download file");
        return false;
    }
    createAndDownloadGPX(gpx_name);
    return;
}


// ----------------- Defining Offline Map -----------------
var save_type: string;
var map_center: L.LatLng;
var track_string: string;
var onlineTrack: L.Layer;
var onlineRectangle: L.Layer;

/**
 * 1. Import a site hike (imports map center, bounds, and gpx file)
 */
$('body').on('click', '#site', () => {
    clearPrevious();
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
    $('#site').prop('disabled', true);
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
    clearPrevious();
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
    
    onlineRectangle = L.rectangle(track_bounds, {color:'darkgreen', fill: false, weight: 2}).addTo(map);
    //let n = 0;  // color pointer NO LONGER ACCEPTING MULTIPLE TRACKS PER IMPORT...
    onlineTrack = L.polyline(polyline, {color: 'blue'}).addTo(map);

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
var rect: L.Rectangle;  // user-define rectangular area to save
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
var rect_complete = false;
$('body').on('click', '#rect', function () {
    $('#rect').prop('disabled', true);
    rect_complete = false;
    $(this).removeClass('btn-primary');
    $(this).addClass('btn-secondary');
    $(this).prop("disabled", true);
    if (typeof rect !== 'undefined') {
        map.removeLayer(rect);
    }

    // Setup touch event handling
    map.dragging.disable();  // restored after save
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
        if (!rect_complete) {
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
    }
    function draw_rect(ev: any) {
        if (!rect_complete) {
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
    }
    function end_rect(ev: any) {
        if (!rect_complete) {
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
            bounds = getRectBounds();
            rect_complete = true;
        }
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
 * ----------------- Save Offline Map -----------------
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
    // parameter validation:
    zoom_level = map.getZoom();
    if (zoom_level < 13) {
        notice("Please use a minimum of zoom 13");
        return false;
    }
    var stored_zoom = zoom_level.toString();
    var names_list = [] as string[];
    const fileExists = await tileDownloader.docFileExists("mapnames.txt");
    if (!fileExists) {
        names_list = [];
    } else {
        const saved_names = await tileDownloader.readMapnames() as string;
        names_list = saved_names.split(",");
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
    // clear out any previous save data:
    $('#complete').css('dsiplay', 'none');
    $('#out_bar').css('width', '2px');
    $('#bar').css('width', '2px');
    $('#base').text("Saving Base Map...");
    $('#base').css('display', 'inline');
    await tileDownloader.createNoMedia(mapName);
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
    $('#base').text("Base map saved...")
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
    isSaved = false; // reset for the next event
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
 * ----------------- Use Offline Map -----------------
 */
var track_poly: string;
var tracking = false; // initial load
var hike: L.Polyline;
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
//L.tileLayer.offline = (url, options) => new L.TileLayer.Offline(url, options);

// Create Hybrid to allow for online occurrences by extending L.TileLayer.Offline:
L.TileLayer.Hybrid = L.TileLayer.Offline.extend({
    createTile: function (coords: L.Coords) {
        // ----- Repeat L.TileLayer.Offline 'createTile' up to 'docFileExist'...
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
        // ----- end repeat
        tileDownloader.docFileExists(url)
            .then((found) => found ? tileDownloader.getTile(url) : false)
            .then((mapTile) => {
                if (mapTile) {
                    // ✅ Offline hit — same as before
                    tile.src = `data:image/png;base64,${mapTile.data ?? mapTile}`;
                } else {
                    // 🌐 Offline miss — try network if online
                    return this._fetchAndCacheOnlineTile(coords, nativeZoom, tile);
                }
            })
            .catch((err) => {
                console.error('Tile error:', err);
            });
        return tile;
    },
    _fetchAndCacheOnlineTile: async function (
        coords: L.Coords,
        nativeZoom: number,
        tile: HTMLImageElement
      ) {
            if (!internetConnected) return;
            try {
                const options = this.options as OfflineTileLayerOptions;
                const mapname = options.mapname!;
                const success = await tileDownloader.downloadTile(
                    nativeZoom, coords.x, coords.y, 'usgs', mapname
                );
                if (!success) return;
            
                // Read it back the same way the offline path does
                const tilePath = tileDownloader.getTilePath(
                    mapname, nativeZoom, coords.x, coords.y, 'usgs'
                ) as string;
                const mapTile = await tileDownloader.getTile(tilePath);
                if (mapTile) {
                    tile.src = `data:image/png;base64,${mapTile.data ?? mapTile}`;
                }
            } catch (err) {
                console.error('Online tile fetch/cache failed:', err);
            }
      }
  }) as unknown as L.HybridTileLayerClass;
  
  L.tileLayer.hybrid = function (url: string, options?: OfflineTileLayerOptions) {
    return new L.TileLayer.Hybrid(url, options);
  };

async function displayMap(map_name: string) {
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
    if (!permissions_requested) {
        requestNotificationPermission();
    }
    return;
}
// Instantiate the offline map: arguments obtained when user selects map
function offlineMap (mapname: string, map_ctr: L.LatLng, map_zoom: number, track: string) {
    map = L.map('map', {
        center: map_ctr,
        minZoom: 10,
        maxZoom: 18,
        zoom: map_zoom,
    });
    L.tileLayer.hybrid('', {
        mapname,
        maxNativeZoom: 16,
        maxZoom: 18,
        } as OfflineTileLayerOptions
    ).addTo(map);
    L.tileLayer.hybrid('', {
        attribution: 'USGS The National Map'
    }).addTo(map);
    // Geolocation dot
    map.locate({enableHighAccuracy: true, watch: false});
    map.once('locationfound', function (e) {
        let loc_now = e.latlng;
        marker = L.marker(loc_now, { icon: pulseIcon }).addTo(map);
    });
    // point to the starting zoom level
    zoomctl_setup(map_zoom);
    if (track !== '') {
        const latlng_arr = JSON.parse(track);
        offline_track = L.polyline(latlng_arr, {color: 'blue'}).addTo(map);
    }
    map.invalidateSize();
    offline_loaded = true;

    if (!sessionChecked) { // timing doesn't matter here for async fct
        checkLastSession();
        sessionChecked = true;
    }
    return;
}

/**
 * Once set, Geolocation is not affected by switching online/offline maps
 * 'marker' must be defined before calling this routine
 */ 
async function requestNotificationPermission() {
    permissions_requested = true;
    // Check the current status
    let permStatus = await LocalNotifications.checkPermissions();
    // If not already granted, request it
    if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
    }
    if (permStatus.display === 'granted') {
        // Setup Geolocation...
        (async () => {
            try {
                const initial = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 5000
                });
                const lat = initial.coords.latitude;
                const lng = initial.coords.longitude;
                const latlng = [lat, lng] as L.LatLngExpression;
                marker.setLatLng(latlng);
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
                const latlng = [lat, lng] as L.LatLngExpression
                marker.setLatLng(latlng);
                if (following) {
                    map.setView(latlng);
                }
                if (tracking) tracker(lat, lng, ele);
                return;
            };
            await BackgroundGeolocation.start(config, onPosition);
        })();    
    } else {
        let msg = "Notification permission denied: Tracking will be disabled";
        notice(msg);
    }
};
function distInMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    var rads = Math.PI/180;
    var R = 6371; // Radius of the earth in km
    var dLat = (lat2-lat1) * rads;  // convert to radians
    var dLon = (lon2-lon1) * rads;
    var rlat1 = lat1 * rads;
    var rlat2 = lat2 * rads;
    var a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(rlat1) * Math.cos(rlat2) * 
        Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
    var b = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var kilos = R * b; 
    var miles = kilos / 1.609344
    return miles;
}
/**
 * ----------------- Tracking/Download -----------------
 */
var track_pt: TrackPoint;
var miles = 0;
var gpx_pts = [] as TrackPoint[];
var map_pt: L.LatLng;
var map_line = [] as L.LatLng[];
var waypts = [] as number[][];
var wayMrkrs: L.Marker<L.MarkerOptions>[] = [];
var offline_track: L.Polyline;
var clear_track = false;
function tracker(lat: number, lng: number, ele: number) {
    track_pt = {lat: lat, lng: lng, elevation: ele} as TrackPoint;
    gpx_pts.push(track_pt);
    map_pt = L.latLng(lat, lng); // => {lat: lat, lng: lng}
    map_line.push(map_pt);
    let altitude = track_pt.elevation * 3.28084
    $('#feet').text(altitude.toFixed(0));
    let pts = map_line.length;
        if (pts > 1) {
            let dist_incr = distInMiles(
                map_line[pts-1].lat, map_line[pts-1].lng,
                map_line[pts-2].lat, map_line[pts-2].lng
            )
            miles += dist_incr;
            $('#distance').text(miles.toFixed(2));
            if (pts > 2) {
                map.removeLayer(hike);
            }
            hike = L.polyline(map_line, {color: 'red'}).addTo(map);
        }
    saveSessionState();
    markSessionDirty();
    return;
}
// Data for creating GPX File
var gpx_file = '<?xml version="1.0"?>' + "\n";
gpx_file += '<gpx xmlns="http://www.topografix.com/GPX/1/1" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.1" ' +
    'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 ' +
    'http://www.topografix.com/GPX/1/1/gpx.xsd" creator="nmhikes.com">';
let track_name = "\n  <trk>\n    <name>USER</name>\n    <trkseg>\n";
const gpx_eof = "    </trkseg>\n  </trk>\n</gpx>";

async function createAndDownloadGPX(dwnld_name: string) {
    if (waypts.length === 0 && gpx_pts.length === 0) {
        notice("There is nothing to download");
        $('#dwnld_name').val("");
        return false;
    }
    let wptcnt = waypts.length;
    if (wptcnt > 0) {
        for (let j=0; j<wptcnt; j++) {
            let newpt = "\n  " + '<wpt lat="' + waypts[j][0] + '" lon="' + waypts[j][1] + '"></wpt>';
            gpx_file += newpt;
        }
    }
    var named_string = track_name.replace("USER", dwnld_name);
    var gpx_xml = gpx_file + named_string;
    for (let i=0; i<gpx_pts.length; i++) {
        var next_pt = '      <trkpt lat="' + gpx_pts[i].lat +  
            '" lon="' + gpx_pts[i].lng + '">';
        var elev = "\n        <ele>" + gpx_pts[i].elevation +
            "</ele>\n      </trkpt>\n";
        gpx_xml += next_pt + elev;
    }
    gpx_xml += gpx_eof;
    // Write to Documents, then share (with user options)
    const result = await Filesystem.writeFile({
        path: `${dwnld_name}.gpx`,
        data: gpx_xml,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true
    });
    await saveOrShareGpxFile(result);
    $('#dwnld_name').val("");
    if (clear_track) {
        map.removeLayer(offline_track);
        for (let i=0; i<wayMrkrs.length; i++) {
            const deletion = wayMrkrs[i];
            map.removeLayer(deletion);
        }
        clear_track = false;
    }
    downloadModal.hide();
    markSessionClean();
    async function saveOrShareGpxFile(result: WriteFileResult) {
        const platform = Capacitor.getPlatform();
        if (platform === 'android') {
            try {
                // Request permissions first (required on Android ≤ 10)
                const permResult = await Filesystem.requestPermissions();
                if (permResult.publicStorage !== 'granted') {
                    console.warn('Storage permission denied');
                    // Fallback to share sheet if permission denied
                    await Share.share({
                        title: 'Save GPX File',
                        url: result.uri,
                        dialogTitle: 'Save or share your file',
                    });
                    return;
                }
                alert('File saved to your Files app: (Documents folder).');
            } catch (e) {
                console.error('Error saving file on Android:', e);
                // Fallback to share sheet on error
                await Share.share({
                    title: 'Save GPX File',
                    url: result.uri,
                    dialogTitle: 'Save or share your file',
                });
            }
        } else {  // iOS
            await Share.share({
                title: 'Save GPX File',
                url: result.uri,
                dialogTitle: 'Save or share your file',
            });
        }
    }
    return;
}
/**
 * When a user wishes, he may delete a saved map: Obviously, at least one
 * 'mapname' resides in the 'mapnames.txt' file when 'delmap' is clicked.
 */
$('body').on('click', '#delmap', async function() {
    const map_sel = document.getElementById('select_map') as HTMLSelectElement;
    let optCount = map_sel.options.length;
    if (optCount === 1) {
        const option = "<option value='No Maps'>No Maps</option>";
        $('#select_map').append(option);
    }
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
/**
 * If the app is closed with unsaved track/marker data present,
 * ensure that it can be restored when the app is opened again.
 * Note that there is no explicit mechanism to detect app closure.
 */
const saveSessionState = async () => {
    // Save any track or marker data
    if (gpx_pts.length > 0) {
        let track_json = JSON.stringify(gpx_pts);
        tileDownloader.writeUnsavedData("unsavedTrack.json", track_json);
    }
    if (waypts.length > 0) {
        let marker_json = JSON.stringify(waypts);
        tileDownloader.writeUnsavedData("unsavedMarkers.json", marker_json);
    }
};
// On app start — check if last session ended cleanly
async function checkLastSession() {
    const { value } = await Preferences.get({ key: 'session_dirty' });
    if (value === 'true') {
        let lastMap = await tileDownloader.readUnsavedData('sessionMap.txt') as string;
        if (lastMap.length > 0) {
            $('#usmap').text(lastMap);
        } else {
            $('#usmap').text('Online');
        }
      restoreModal.show();
    }
}
// When unsaved data exists, mark the session as dirty
async function markSessionDirty() {
    await Preferences.set({ key: 'session_dirty', value: 'true' });
}
// When data is saved, clear the flag
async function markSessionClean() {
    await Preferences.set({ key: 'session_dirty', value: 'false' });
}
var prevent_bs_modal_close = false;  // re-initialized every app open
$('body').on('click', '#restore_session', async () => {
    $('#save_clear').css('display', 'none');
    let oldgpx = await tileDownloader.readUnsavedData("unsavedTrack.json") as string;
    gpx_pts = JSON.parse(oldgpx);
    let oldwaypts = await tileDownloader.readUnsavedData("unsavedMarkers.json") as string;
    waypts = JSON.parse(oldwaypts);
    markSessionClean();
    prevent_bs_modal_close = true;
    restoreModal.hide()
    downloadModal.show();
});
restore_data.addEventListener('hidden.bs.modal', () => {
    if (!prevent_bs_modal_close) {
        gpx_pts = [];
        waypts = [];
        markSessionClean();
        restoreModal.hide();
    }
});
