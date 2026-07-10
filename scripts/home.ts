/// <reference types="jqueryui" />
/// <reference path="../types/leaflet-offline.d.ts" />
interface OfflineTileLayerOptions extends L.TileLayerOptions {
    mapname?: string;
}
/*
interface DebugCoords {
    z: number;
    x: number;
    y: number;
}
*/
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
interface Toggler extends EventTarget {
    checked: boolean;
}
interface HybridSize {
    map: string;
    qty: number;
    size: number;
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
 * @fileoverview V2.2 relies on the USGS ArcGIS topo/contour tiles for a 
 * better hike experience. Note that the USGS schema swaps the x and y 
 * (row/col) coordinates when fetching tiles compared to the 'osm' schema.
 * Owing to file size of this app, some exports are utilized and use of arrow
 * functions is reduced to force typescript to handle them properly.
 * 
 * @version 2.2 Stable minus tmpFile storage
 */

/**
 * ----------------- Internet connectivity -----------------
 */
var internetConnected = navigator.onLine ? true : false;
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
setInterval(checkConnectivity, 30000);

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
 *  ----------------- Phone-Specific Actions -----------------
 * 
 * NOTE: Permissions are tricky, and one can block or deny the other if not
 * properly sequenced. For this reason, the initPermissions function is used.
 * BackgroundGeolocation permissions are requested when that mode is enabled.
 */
async function initAllPermissions() {
    const locResult = await Geolocation.requestPermissions();
    console.log('Foreground location:', locResult.location);
    await requestNotificationPermission();
}
initAllPermissions()
.then( () => {
    // Map loading on initial page load:
    if (internetConnected) {
        initMap(false); // normal situation
    } else {
        offlineSelect();
    } 
    return
});

async function requestNotificationPermission() {
    // Check the current status
    let permStatus = await LocalNotifications.checkPermissions();
    // If not already granted, request it
    if (permStatus.display !== 'granted') {
        permStatus = await LocalNotifications.requestPermissions();
        if (permStatus.display === 'granted') {
            permissions_granted = true;
        } else {
            permissions_granted = false;
            let msg = "Notification permission denied: Tracking will be disabled";
            notice(msg);
        }
    } else {
        permissions_granted = true;
    }
    return;
};

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

//tileDownloader.debugMapnames();
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
const trackSaveModal = new bootstrap.Modal(downloadDiv);
const restore_data = document.getElementById('restore') as HTMLDivElement;
const restoreModal = new bootstrap.Modal(restore_data);
const multiTrack = document.getElementById('multi') as HTMLDivElement;
const multiModal = new bootstrap.Modal(multiTrack);
//const unsavedGPX = document.getElementById('no_download') as HTMLDivElement;
//const unsavedGpxModal = new bootstrap.Modal(unsavedGPX);
const hybrid_tiles = document.getElementById('hybrid_save') as HTMLDivElement;
const hybridDisposition = new bootstrap.Modal(hybrid_tiles);
const save_progress = document.getElementById('stat') as HTMLDivElement;
const save_status = new bootstrap.Modal(save_progress);
const too_big = document.getElementById('too_big') as HTMLDivElement;
const exceedsModal = new bootstrap.Modal(too_big);

/**
 * ----------------- Main display page -----------------
 */

// ---- Hybrid Tile Management ----
async function hybridCheck() {
    if (hybrid_info.map !== '') { 
        const exiting_map = hybrid_info.map;
        $('#offmap').text(exiting_map);
        const offline_size = await tileDownloader.getDirectorySize(exiting_map);
        const megabytes = offline_size/1000000;
        const mb = Math.round(megabytes*100)/100;
        $('#offsize').text(mb);
        const hybrid_size = hybrid_info.size/1000000;
        const hybridMB = hybrid_size.toFixed(1);
        if (hybrid_info.size < 10000) {
            $('#add_size').text("< 0.01");
        } else if (hybrid_info.size < 100000) {
            $('#add_size').text("< 0.1");
        } else {
            $('#add_size').text(hybridMB);
        }
        return true;
    } else return false;
}
async function hybridModalWrapup(btn: string, last: string, next: string) {
    if (btn === 'keep') {
        const xfr = await tileDownloader.transferHybridTiles(last, tile_server);
        if (xfr) {
            console.log(`Failed to transfer [any/all] hybrid tiles to ${last}`)
        }
    } else {
        await tileDownloader.removeData('tmpFiles');
    }
    var modal_status = ($('#show_create_types').text() === 'yes') ? true : false;
    hybridDisposition.hide();
    hybrid_info = {map: '', qty: 0, size: 0};
    if (next === 'online') {
        continueOnline(modal_status);
    } else {
        displayMap(next);
    }
    return;
}
$('body').on('click', '#keep_tmp', () => {
    const last_map = hybrid_info.map;
    const newmap = $('#next_map').text();
    hybridModalWrapup('keep', last_map, newmap);
    return;
});
$('body').on('click', '#kill_tmp', () => {
    const last_map = hybrid_info.map;
    const newmap = $('#next_map').text();
    hybridModalWrapup('kill', last_map, newmap);
    return;
});
// ---- End Hybrid Tile Management ----

/**
 * Prior to loading an offline map, 'hybridCheck' is performed to see if,
 * when leaving a displayed offline map, any 'hybrid' tiles were saved in
 * tmpFiles. If so, the hybridDisplostionModal is preseented, and the user
 * can choose whether or not to add them to the current offline map before
 * proceeding to the new offline map.
 * 
 * This function will destroy any currently implemented map and then display
 * the offline map selected by the user. Also destroyed are all map objects:
 * markers, polyline, rectangle, etc. NOTE: marker layer is gone, but the 
 * marker var is already defined when switching from online or previous offline.
 * If the app is initially loaded with offline choice, marker will be defined
 * by offlineMap().
 */
async function loadSelectedMap(mapname: string):Promise<void>  {
    // To provide clean map changeover, stop location tracking
    if (leafletGeo) {
        map.stopLocate();
    }
    if (capgoGeo) {
        BackgroundGeolocation.stop();
    }
    // Only when app comes up w/internet:
    if (typeof map !== "undefined") {
        map.remove();
        map = null!;
    }
    tileDownloader.writeSessionText(mapname); // indicates current offline map
    $('#next_map').text(mapname);
    if (await hybridCheck()) {
        hybridDisposition.show();
    } else {
        displayMap(mapname); // will set offline_loaded
    }
    return;
}

/**
 * Module-level globals including functions
 */
var map: L.Map;
var onlineRectangle: L.Layer;
var onlineTrack: L.Layer;
var container: HTMLElement;
var permissions_granted = false;
var leafletGeo = false;
var capgoGeo = false;
var sizes: number[] = [];
var hybrid_info = { map: '', qty: 0, size: 0 } as HybridSize;
var sessionChecked = false;
var following = false;
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
var marker_svg = `<svg xmlns="http://w3.org" viewBox="0 0 24 24" width="46" height="46">
                    <path fill="var(--marker-color, #006400)" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    <circle fill="#FFFFFF" cx="12" cy="9" r="2.5"/></svg>`;
var wayptMarker = L.divIcon({
    html: marker_svg,
    iconSize: [24, 37],       // Matches your SVG viewBox dimensions perfectly
    iconAnchor: [12, 37],     // Sets anchor point to the exact bottom-center tip of the pin
    popupAnchor: [0, -37],    // Shifts the popup 37px up so it rests on the pin tip
    className: 'custom-svg-marker' // Removes default Leaflet background styling
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
var track_pt: TrackPoint;
var miles = 0;
var gpx_pts = [] as TrackPoint[];
var map_pt: L.LatLng;
var map_line = [] as L.LatLng[];
var waypts = [] as number[][];
var wayMrkrs: L.Marker<L.MarkerOptions>[] = [];
function markerUpdate(e: L.LocationEvent) {
    var new_latlng = e.latlng
    marker.setLatLng(new_latlng);
    return; 
}
//      ----------ONLINE MAP ----------
export async function initMap(showTypes: boolean) {
    /**
     * Similar to the offline condition, if a user is leaving an offline
     * map to go back to the online map state, hybridCheck will look for any
     * stored tmpFiles, and offer the user the chance to keep them or not.
     *  */ 
    $('#next_map').text('online');
    if (showTypes) {
        $('#show_create_types').text('yes');
    } else {
        $('#show_create_types').text('no');
    }
    if (await hybridCheck()) {
        hybridDisposition.show();
    } else {
        continueOnline(showTypes);
    }
}
export function continueOnline(showTypes: boolean) {
    var latlng = L.latLng(35.2, -106.345);
    map = L.map('map', {
        center: latlng,
        minZoom: 5,
        maxZoom: 17,
        zoom: zoom_level,
        zoomSnap: 1 // no fractional zooms for zoomOptimizer
    });
    L.tileLayer(ONLINE_TILE_URL, ONLINE_LAYER_OPTIONS)
        .addTo(map); // standard leaflet tile layer
    marker = L.marker(latlng, { icon: pulseIcon }).addTo(map);
    map.locate({enableHighAccuracy: true, watch: true});
    map.on('locationfound', markerUpdate);
    map.once('locationfound', function (e) {
        latlng = e.latlng;
        map.panTo(latlng);
        marker.setLatLng(latlng);
    });
    leafletGeo = true;
    zoomctl_setup(zoom_level);
    // some async's don't require 'wait'...
    tileDownloader.writeSessionText(''); // indicates online, no map name
    map.invalidateSize(); // needed when switching from offline
    if (!sessionChecked) {
        checkLastSession();
        sessionChecked = true;
    }
    // Only for online: needed for drawing rectangle
    container = map.getContainer();
    if (showTypes) {
        save_type_modal.show();
    }
    return;
}
// Create modal offline map selections for user
async function prepareMapNames() {
    $('#select_map').empty();
    sizes = [];
    const mapnamesFile = await tileDownloader.docFileExists('mapnames.txt');
    if (mapnamesFile) {
        const savedMaps = await tileDownloader.readMapnames() as string;
        const userMaps = savedMaps.split(",");
        for (const map of userMaps) {  
            const mapsize = await tileDownloader.getDirectorySize(map);
            const megabytes = mapsize/1000000;
            const mega = Math.round(megabytes*100)/100;
            sizes.push(mega);
            const option = `<option value="${map}">${map}</option>`;
            $('#select_map').append(option);
        }
    } else {
        const option = "<option value='No Maps'>No Maps</option>";
        $('#select_map').append(option);
        $('#available').css('display', 'none');//
        $('#no_maps').css('display', 'block');
    }  
    return;
}
function appendFilesize() {
    const map_selections = document.getElementById('select_map') as HTMLSelectElement;
    var selectedIndex = map_selections.selectedIndex;
    $('#filesize').text(sizes[selectedIndex]); 
    return;
}
$('body').on('change', '#select_map', () => {
    appendFilesize();
});
// offlineSelect is invoked either at startup when no internet, or by menu click
async function offlineSelect() {
    await prepareMapNames();
    maps_available.show();
    appendFilesize();
    return;
}

/**
 * ----------------- Menu Actions & Position -----------------
 * 
 */
// Menu position on page
let menu = document.getElementById('menu') as HTMLDivElement;
let menuHt = menu.offsetHeight;
let displayHt = menuHt + 30;
$('#menu').height(displayHt); 
let safeArea = menu.getBoundingClientRect().top; 
let space = window.innerHeight;
let newTop = safeArea + (space - menuHt)/2 + "px"
$('#menu').css('top', newTop);
// get menu mouse coords so that when touched outside, menu closes
function touchClose(ev: TouchEvent) {
    ev.stopPropagation();
    menu_close();
}
// Icon_div position on page
let icon_div = document.getElementById('icon_div') as HTMLDivElement;
let icon_div_ht = icon_div.offsetHeight;
let icon_div_loc = safeArea + (space - icon_div_ht)/4 + "px";
$('#icon_div').css('top', icon_div_loc);
let winwidth = window.innerWidth;
// Follow GPS icon position
let follow_pos = (winwidth - 36)/2;
let $follow_icon = $('#follow_icon');
$follow_icon.css('left', follow_pos);
// Define alternate icons:
let $play = $('#play');
let $stop = $('#stop');
let $pause = $('#pause');
let $unpause = $('#unpause');
let $unfollow_icon = $('#unfollow_icon');
$unfollow_icon.css('left', follow_pos)
// Toggle sliders in menu
const recordButtons = document.getElementById('menu-recording') as HTMLInputElement;
recordButtons.addEventListener('change', (e) => {
    const target = e.target as Toggler;
    if (tracking) {
        target.checked = !target.checked;
        notice("You cannot change the Tracking toggle while tracking is active ");
        return;
    }
    if (target.checked) {
        $('#icon_div').css('display', 'block');
        $('#row2').css('display', 'none')
        $('#row3').css('display', 'none');
    } else {
        $('#icon_div').css('display', 'none');
    }
    return;
});
const followState = document.getElementById('menu-follows') as HTMLInputElement;
followState.addEventListener('change', (e) => {
    const target = e.target as Toggler;
    if (target.checked) {
        $follow_icon.css('display', 'inline');
        $unfollow_icon.css('display', 'none');
    } else {
        $follow_icon.css('display', 'none');
        $unfollow_icon.css('display', 'none');
    }
});
const geoIcon= document.getElementById('menu-location') as HTMLInputElement;
geoIcon.addEventListener('change', (e) => {
    const target = e.target as Toggler;
    if (target.checked) {
        $('#findme_icon').css('display', 'inline');
    } else {
        $('#findme_icon').css('display', 'none');
    }
});
// end toggles

// Tracking activities
function cleanTrack() {
    if (typeof hike !== 'undefined') {
        map.removeLayer(hike);
    }
    for (let i=0; i<wayMrkrs.length; i++) {
        const deletion = wayMrkrs[i];
        map.removeLayer(deletion);
    }
    gpx_pts = [];
    waypts = [];
    wayMrkrs = [];
    map_line = [];
}
$('body').on('click', '#play', () => {
    /**
     * When tracking is active, the 'Pause' and 'Waypoint' buttons
     * are visible. When #play is clicked, a brand new track will be
     * formed, so any previous track data is deleted. The #play icon
     * will be replaced by the #stop icon. Tracking controls which
     * of the geolocation services is enabled, as they cannot both
     * be active at the same time. When tracking is on, the standard
     * leaflet geolocation (no background capability) is removed and
     * replaced by the @capgo background geolocation service. When
     * tracking is turned off, geolocation control switches back.
     * Tracking occurs independently of online or offline.
     */
    menu_close();
    // show pause and green_marker [waypoint] icons:
    $('#row2').css('display', 'inline');
    $('#row3').css('display', 'inline');
    $play.replaceWith($stop);
    $stop.css('display', 'inline');
    // begin ...
    tracking = true;
    useBackgroundGeolocation(true);
    $('#info').css('display', 'block'); // shows miles & elevation
    return;
});
$('body').on('click', '#stop', () => {
    tracking = false;
    $('#row2').css('display', 'none');
    $('#row3').css('display', 'none');
    $stop.replaceWith($play);
    $stop.css('display', 'none');
    useBackgroundGeolocation(false);
    $('#info').css('display', 'none');
    if (wayMrkrs.length === 0 && gpx_pts.length < 3) {
        notice("There is nothing to save");
    } else {
        trackSaveModal.show();
    }
});
$('body').on('click', '#pause', () => {
    $pause.replaceWith($unpause);
    $unpause.css('display', 'inline');
    tracking = false;
    return;
});
$('body').on('click', '#unpause', () => {
    $unpause.css('display', 'none');
    $unpause.replaceWith($pause);
    tracking = true;
    return;
});
$('body').on('click', '#green_marker', () => {
    map.locate({enableHighAccuracy: true, watch: false});
    map.once('locationfound', function (e) {
        const myloc = e.latlng;
        const waypt = [myloc.lat, myloc.lng] as number[];
        waypts.push(waypt);
        const wmrkr = L.marker(myloc, {icon: wayptMarker}).addTo(map);
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
    return;
});
$('body').on('click', '#follow_icon', () => {
    $follow_icon.css('display', 'none');
    $unfollow_icon.css('display', 'inline');
    following = true;
    return;
});
$('body').on('click', '#unfollow_icon', () => {
    $unfollow_icon.css('display', 'none');
    $follow_icon.css('display', 'inline');
    following = false;
    return;
});
$('body').on('click', '#findme_icon', () => {
    map.locate({enableHighAccuracy: true, watch: false});
    map.once('locationfound', function(e) { 
        map.setView(e.latlng);
    });
    return;
});
// Buttons for: track exceeds current memory limits
var exceedsFlag = true; // action when exceedsModal closes
$('body').on('click', '#big_online', () => {
    if (onlineRectangle) {
        map.removeLayer(onlineRectangle);
    }
    exceedsFlag = false;
    exceedsModal.hide();
});
$('body').on('click', '#big_kill', () => {
    if (onlineRectangle) {
        map.removeLayer(onlineRectangle);
    }
    if (onlineTrack) {
        map.removeLayer(onlineTrack);
    }
    exceedsFlag = false;
    exceedsModal.hide();
});
// Close button tapped:
too_big.addEventListener('hidden.bs.modal', () => {
    if (exceedsFlag) {
        if (onlineRectangle) {
            map.removeLayer(onlineRectangle);
        }
        if (onlineTrack) {
            map.removeLayer(onlineTrack);
        }
    } else {
        exceedsFlag = true;
    }
});

// ----- Menu Related Items ----
function clearPrevious(): void {  // eliminate existing import images
    if (onlineRectangle) {
        map.removeLayer(onlineRectangle);
        map.removeLayer(onlineTrack);
    }
    return;
}
function menu_close(): void {
    //ensure any 'left over' buttons are hidden:
    $('#map_save, #clear_rect, #rect').css('display', 'none');
    $('#disp').text("Closed");
    const backdrop = document.getElementById('menu-backdrop') as HTMLDivElement;
    backdrop.style.display = "none";
    backdrop.removeEventListener('touchstart', touchClose);
    $('#menu').animate({ left: "-=230"}, 500);
    return;
}
$('#menu_trigger').on('click', () => {
    if ($('#disp').text() === 'Closed') {
        $('#disp').text("Open");
        const backdrop = document.getElementById('menu-backdrop') as HTMLDivElement;
        backdrop.style.display = "block";
        backdrop.addEventListener('touchstart', touchClose, { once: true});
        $('#menu').animate({ left: "0" }, 300);
    } else {
        menu_close();
    }
    return;
});
/**
 * 'Create' map can be called when either online or offline. 
 * If offline, the user must be placed back on the online map.
 * 'Create' will trigger a modal allowing the user to pick a
 * map-capturing type from 'save_type_modal'. Also, if 'create 
 * map' is called from the menu, menu needs to be closed, if
 * called from maps_available, that needs to be hidden.
 */
$('body').on('click', '.save_display', async () => {
    if (internetConnected) {
        if (tracking) {
            notice("Tracking must be stopped before creating new map");
            return false;
        }
        // make sure modal div has default css
        $('#available').css('display', 'block');
        $('#no_maps').css('display', 'none');
        if (start_modal.classList.contains('show')) {
            maps_available.hide();
            // not needing 'showTypes' true, as returning to online from offline
        } else {
            menu_close();
        }
        if (offline_loaded) {
            // since tracking is off, leafletGeo is true
            map.stopLocate();
            map.remove();
            map = null!;
            offline_loaded = false;
            await initMap(true); // true => save_type_modal will appear
        }
        save_type_modal.show();
    } else {
        notice("Cannot create new maps without internet connection");
    }
    return;
});
$('body').on('click', '#off_goto', () => {
    if (tracking) {
        notice("Tracking must be stopped before switching to offline map");
        return false;
    }
    clearPrevious();
    menu_close();
    offlineSelect();
    return;
});

// ----- Modal/Secondary Buttons -----
$('body').on('click', '#use_map', () => {
    const user_map = $('#select_map').val() as string;
    if (user_map == '') {
        notice("Please select an offline map");
        return false;
    }
    $('#select_map').off('click');
    maps_available.hide();
    loadSelectedMap(user_map);
    return;
});

// --- Multiple items associated with saving maps ---
var isSaved = false;
function saveUserMap() {
    if (rect_complete) {
        $('#map_save').css('display', 'none');
        $('#clear_rect').css('display', 'none');
        $('#rect').css('display', 'none');
        rect_complete = false;
        L.DomEvent.off(container, 'touchstart', drawingHandlers.touchstart);
        L.DomEvent.off(container, 'touchmove', drawingHandlers.touchmove);
        L.DomEvent.off(container, 'touchend', drawingHandlers.touchend);
        map.dragging.enable();
        map.removeLayer(rect);
    }
    tile_save();
    return;
}
$('body').on('click', '#save_om', () => { // 'Save Map' btn on modal
    g_mapName = $('#map_name').val() as string;
    if (g_mapName == '') {
        notice("You must supply a name for the map");
        return false;
    }
    isSaved = true; // to prevent 'resave' modal
    save_om_map_modal.hide();
    saveUserMap();
    return;
});
$('body').on('click', '#use_asis', () => {
    if (onlineRectangle) {
        map.removeLayer(onlineRectangle);
    }
    isSaved = true; // to prevent 'resave' modal
    save_om_map_modal.hide();
    isSaved = false; // reset
});
mapSave.addEventListener('hidden.bs.modal', () => {
    if (!isSaved) {
        unsaved.show();
    } else {
        isSaved = false;
    }  
});
$('body').on('click', '#resave', () => {
    g_mapName = $('#resave_as').val() as string;
    if (g_mapName == '') {
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
    $('#rect').prop('disabled', false);
});
$('body').on('click', '#add_marker_text', () => {
    let popup = $('#id_text').val() as string;
    let indx = parseInt($('#mrkr_indx').text()) - 1; // marker index
    if (popup === '') {
        notice('Please enter popup text');
        return false;
    }
    let newMarker = wayMrkrs[indx] as L.Marker<L.MarkerOptions>
    newMarker.bindPopup(popup, {
        autoPan: false
    });
    $('#id_text').val("");
    textModal.hide();
    return
});
// GPX File Saving, triggered by #stop click
$('body').on('click', '#save_dwnld', () => {
    const gpx_name = $('#dwnld_name').val() as string;
    if (gpx_name == '') {
        notice("Please supply a name for the download file");
        return false;
    }
    const action = 'keep';
    createAndDownloadGPX(gpx_name, action);
    return;    
});
$('body').on('click', '#clear_track', () => {
    const gpx_name = $('#dwnld_name').val() as string;
    if (gpx_name == '') {
        notice("Please supply a name for the download file");
        return false;
    }
    const action = 'kill';
    createAndDownloadGPX(gpx_name, action);
    return;    
})

// ----------------- Importing / Saving Offline Map -----------------
var save_type: string;
var map_center: L.LatLng;
var track_string: string;
var trackTooBig = false;

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
        var multi = parseInt(result_array[4]);
        displayImportedTrack(nw, se, map_center, track_poly, multi);
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
    nw: L.LatLng, se: L.LatLng, mapctr: L.LatLng, polyline: L.LatLng[], multi=0
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
    track_string = JSON.stringify(polyline);
    startX = nw.lat;
    startY = nw.lng;
    endX   = se.lat;
    endY   = se.lng;
    save_type = "import";
    // tracks & bounds rectangle w/margins are added, now pan to center of map
    map.flyTo(mapctr, 13, {duration: 1.2});
    setTimeout( () => {
        map.invalidateSize();
        zoomOptimizer();
        if (trackTooBig) {
            exceedsModal.show();
            trackTooBig = false;
        } else {
            if (multi> 0) {
                multiModal.show();
                multiTrack.addEventListener('hidden.bs.modal', () => {
                    save_om_map_modal.show();
                });
            } else {
                save_om_map_modal.show();
            } 
        }
    }, 1500);
    return;
}
/**
 * After a map area is specified, there may actually be sufficient
 * space to zoom in, which reduces memory load.
 */
async function zoomOptimizer() {
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
    } if (new_zoom < 13) {
        trackTooBig = true;
    }
    return;
}
/**
 *  3. User can draw a rectangle on the map and save it (without a gpx track).
 * Later, the map can be used and a track can be captured if desired.
 */
$('body').on('click', '#map_save', () => {
    save_om_map_modal.show();
});
var bounds: MapBounds;  // supplied to the tileDownloader for downloading regions
var rect: L.Rectangle;  // user-define rectangular area to save
var startX: number;  // lat of upper-left tile; ul[0]
var startY: number;  // lng of upper-left tile; ul[1]
var endX: number;    // lat of lower-right tile; lr[0]
var endY: number;    // lng of lower-right tile; lr[1]
/**
 * 'tile_coords' are used to collect 'zoomout' tiles for saving; The highest 
 * (biggest) zoom available from which a map can be saved is 16, the highest
 * (biggest) zoomout level will then be current zoom -1, or max of 15. Tile
 * positions are collected as objects {x:tilex, y:tiley}, and correspond to
 * the leaflet grid id's.
 */
var tile_coords = [] as LeafletGridPosition[][];
function initCoords() {
    tile_coords[10] = [];
    tile_coords[11] = [];
    tile_coords[12] = [];
    tile_coords[13] = [];
    tile_coords[14] = [];
    tile_coords[15] = [];
}
initCoords();
var rect_complete = false;
/**
 * Establish touch handlers such that the touch events can be
 * turned off when done
 */
function onTouchStart(e: Event) {
    L.DomEvent.preventDefault(e);
    save_type = "draw";
    start_rect(e);
}
function onTouchMove(e: Event) {
    L.DomEvent.preventDefault(e);
    draw_rect(e)
}
function onTouchEnd(e: Event) {
    L.DomEvent.preventDefault(e);
    end_rect(e)
}
const drawingHandlers = {
    touchstart: (e: Event) => onTouchStart(e),
    touchmove:  (e: Event) => onTouchMove(e),
    touchend:   (e: Event) => onTouchEnd(e)
}
function start_rect(ev: any) {
    if (!rect_complete) {
        var touch = ev.touches[0];
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
    }
}
function draw_rect(ev: any) {
    if (!rect_complete) {
        rect.removeFrom(map);
        var touch = ev.touches[0];
        var newRect = map.mouseEventToLatLng(touch);
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
        endX = endRect.lat;
        endY = endRect.lng;
        var lat_ctr = startX - (startX - endX)/2;
        var lng_ctr = startY + (endY - startY)/2;
        map_center = L.latLng(lat_ctr, lng_ctr);
        bounds = getRectBounds();
        $('#rect').prop('disabled', true);
        rect_complete = true;
    }
}
$('body').on('click', '#rect', function () {
    $(this).prop("disabled", true);
    $(this).removeClass('btn-primary');
    $(this).addClass('btn-secondary');
    if (typeof rect !== 'undefined') {
        map.removeLayer(rect);
    }
    rect_complete = false;
    map.dragging.disable();  // restored after save
    L.DomEvent.on(container, 'touchstart', drawingHandlers.touchstart);
    L.DomEvent.on(container, 'touchmove', drawingHandlers.touchmove);
    L.DomEvent.on(container, 'touchend', drawingHandlers.touchend);
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
var g_mapName: string; // the only [module] global mapname
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
        ul_tile[0] = corner1XY[0];
        lr_tile[0] = corner2XY[0];
    }
    else { 
        ul_tile[0] = corner2XY[0];
        lr_tile[0] = corner1XY[0];
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
     * 16 tiles at the next smaller zoom ['Gang of 16']. All tiles can be derived from
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
    return;
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
    if (fileExists) {
        const saved_names = await tileDownloader.readMapnames() as string;
        names_list = saved_names.split(",");
    }
    if (names_list.includes(g_mapName)) {
        notice("This name is already used; please supply a new name");
        $('#map_name').val("");
        return false;
    } else {
        names_list.push(g_mapName);
        var new_list = names_list.join(",");
        await tileDownloader.writeMapnames(new_list);
    }
    $('#map_name').val("");
    if (save_type === "import") {
        bounds = getRectBounds(); // global already defined in 'draw rectangle'
        const trackWrite = await tileDownloader.writeTrack(g_mapName, track_string);
        if (!trackWrite) {
            notice("Could not save the track for this hike");
            return false;
        }
    }
    var mapZoom = await tileDownloader.writeSavedZoom(g_mapName, stored_zoom);
    if (!mapZoom) {
        notice(`Failed to save ${g_mapName} zoom level`);
        // can still display with default zoom, so no 'return false'
    }
    var ctr = JSON.stringify(map_center);
    var ctr_write = await tileDownloader.writeCenter(g_mapName, ctr);
    if (!ctr_write) {
        notice(`Failure to write map_center: ${g_mapName}`);
        return false;
    }
    // ensure ul_tile and lr_tile are defined and arranged nw to se:
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
    $('#base').text("----- * Saving base map * -----");
    $('#base').css('display', 'inline');
    $('#loader').css('display', 'inline');
    /**
     * The 'basemap' is the margin around the rectangle tiles, which is 1 tile bigger
     * than each side. The actual rectangle tiles are saved in 'downloadRegion'.
     */
    // top row
    for (let row = ur-1, i=uc-1; i<=lc+1; i++) {
        await tileDownloader.downloadTile(zoom_level, row, i, tile_server, g_mapName);
    }
    tile_coords[zoom_level]
    // bottom row
    for (let row=lr+1, j=uc-1; j<=lc+1;j++) {
        await tileDownloader.downloadTile(zoom_level, row, j, tile_server, g_mapName);
    }
    // left side
    for (let col=uc-1, k=ur; k<=lr; k++) {
        await tileDownloader.downloadTile(zoom_level, k, col, tile_server, g_mapName);
    }
    // right side
    for (let col=lc+1, n=ur; n<=lr; n++) {
        await tileDownloader.downloadTile(zoom_level, n, col, tile_server, g_mapName);
    }
    $('#base').text("Base map saved...")
    // Prepare to save 'zoom out' tiles:
    var maxZoomout = zoom_level - 1;
    var minZoomout = 10;
    var ul_start = ul_tile.slice();
    var ZoomoutCnt = (maxZoomout - 9) * 16;
    loadZoomOutTiles(ul_start, maxZoomout, minZoomout); // stored in tile_coords
    // download the loadZoomOutTiles
    $('#zot_cnt').text(ZoomoutCnt);
    let pxperTile = 200/ZoomoutCnt;
    var loaded = 0;
    for (let k=minZoomout; k<zoom_level; k++) { // ends at zoom just below current
        var level_coords = tile_coords[k].slice();  // [] = {x.row, y.col}
        /**
         * The for loop is critical to performance! I previously used a 
         * forEach, and the download hung, apparently due to the loop
         * causing a flood of requests swamping the Capacitor bridge.
         */
        for (const tile_obj of level_coords) {
            var x = tile_obj.x;
            var y = tile_obj.y;
            var tileStat = await tileDownloader.downloadTile(k, x, y, tile_server, g_mapName);
            if (!tileStat) {
                notice(`Could not download tile with coords ${k}, ${x}, ${y} for ${g_mapName}`);
                break;
            }
            loaded++;
            let out_progress = loaded * pxperTile;
            $('#out_bar').css('width', out_progress);
        }
    }
    // dowload the zoom-ins for the 'bounds' region
    await tileDownloader.downloadRegion(g_mapName, bounds, [zoom_level, 16], tile_server, saveProgress);
    initCoords();
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
        $('#loader').css('displya', 'none');
        $('#complete').css('display', 'block');
    }
    return;
}

/**
 * ----------------- Use Offline Map -----------------
 */
var track_poly: string;
var tracking = false; // initial load
var hike: L.Polyline; // the polyline which captures user movements during tracking: on or offline
/**
 * Declare L.TileLayer.Offline and L.tileLayer.offline only once, then simply
 * switch the layers as needed.
 * 
 * Define offline layer object: here, 'createTile' this overrides the normal
 * layer object's method - later overridden, in this case, by Hybrid layer.
 */
L.TileLayer.Offline = L.TileLayer.extend({
    createTile: function (coords: L.Coords) {
        const type = tile_server === 'usgs' ? 'image/jpg;' : 'image/png;';
        const srcdata = `data:${type}base64`;
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
                    tile.src = `${srcdata},${mapTile.data ?? mapTile}`;
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
        const type = tile_server === 'usgs' ? 'image/jpg;' : 'image/png;';
        const srcdata = `data:${type}base64`;
        const tile = document.createElement('img');
        const options = this.options as OfflineTileLayerOptions;
        const mapname = options.mapname!;
        // use maxNative zoom to clamp tile loads
        const maxNativeZoom = this.options.maxNativeZoom;
        const nativeZoom = maxNativeZoom !== undefined
            ? Math.min(coords.z, maxNativeZoom) // clips at max is z is too big
            : coords.z;
        // url is path to save the retrieved tile in the Filesystem
        const url = tileDownloader.getTilePath(
            mapname, nativeZoom, coords.x, coords.y, 'usgs'
        ) as string;
        // ----- end repeated code
        tileDownloader.docFileExists(url)
            .then((found) => found ? tileDownloader.getTile(url) : false)
            .then((mapTile) => {
                if (mapTile) {
                    // ✅ Offline hit — same as before
                    console.log("Hit for url: ", url);
                    tile.src = `${srcdata},${mapTile.data ?? mapTile}`;
                    //tile.src = `data:image/png;base64,${mapTile.data ?? mapTile}`;
                } else {
                    // 🌐 Offline miss — try network if online
                    return this._fetchAndCacheOnlineTile(
                        mapname, coords, nativeZoom, srcdata, tile);
                }
            })
            .catch((err) => {
                console.error('Tile error:', err);
            });
        return tile;
    },
    _fetchAndCacheOnlineTile: async function (
        mapname: string,
        coords: L.Coords,
        nativeZoom: number,
        srcdata: string,
        tile: HTMLImageElement
      ) {
            if (!internetConnected) return;
            try {
                const success = await tileDownloader.fetchAndCacheHybridTile(
                    nativeZoom, coords.x, coords.y, 'usgs', mapname);
                if (!success) return; // no harm done...
                let hybridPath = tileDownloader.getHybridPath(
                    nativeZoom, coords.x, coords.y, tile_server
                ) as string;
                hybridPath = `tmpFiles/${mapname}/${hybridPath}`;
                const tile_size = await tileDownloader.
                    getHybridTileSize(hybridPath) as number;
                let nextSize = hybrid_info.size + tile_size;
                hybrid_info.size = nextSize;
                // Read it back the same way the offline path does              
                const mapTile = await tileDownloader.getHybridTile(hybridPath);
                if (mapTile) {
                    tile.src = `${srcdata},${mapTile.data ?? mapTile}`;
                } else {
                    console.log("Couldn't retrieve cached tile");
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
    hybrid_info = { map: map_name, qty: 0, size: 0 };
    offlineMap(map_name, center, zoomSet, track_poly);
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
        mapname: mapname,
        maxNativeZoom: 16,
        maxZoom: 18,
        attribution: 'USGS The National Map'
        } as OfflineTileLayerOptions
    ).addTo(map);
    // point to the starting zoom level
    zoomctl_setup(map_zoom);
    if (track !== '') {
        const latlng_arr = JSON.parse(track);
        L.polyline(latlng_arr, {color: 'blue'}).addTo(map);
    }
    map.invalidateSize();
    offline_loaded = true;
    /** 
     * When offline maps are loaded, tracking is off and there are no visible
     * markers [if an offline initial load, marker is undefined; otherwise the
     * marker has been defined in initMap()]. The user's standard geolocation
     * (not background geolocation) is enabled and the marker is visible at 
     * the the user's current location. At any time after, geolocation and
     * background geolocation are toggled by the tracking icon ['#play'].
     */
    map.locate({enableHighAccuracy: true, watch: false});
    map.once('locationfound', (e) => {
        if (typeof marker === 'undefined') { // may have been removed with 'loadSelectedMap()'
            marker = L.marker(e.latlng, { icon: pulseIcon });
        } 
        marker.addTo(map);
    });
    map.locate({enableHighAccuracy: true, watch: true});
    map.on('locationfound', (e) => {
        marker.setLatLng(e.latlng);
        return;
    });
    leafletGeo = true;  // flag to id which geolocation method is in play 
    if (!sessionChecked) { // timing doesn't matter here for async fct
        checkLastSession();
        sessionChecked = true;
    }
    return;
}

/**
 * Background geolocation consumes battery power, so the only time it
 * is enabled is when tracking is enabled via the 'play' svg icon.
 * Once set, Geolocation is not affected by internet connectivity.
 * 'marker' must be defined before calling this routine 
 */
function useBackgroundGeolocation(capgo: boolean) {
    if (capgo) {
        if (permissions_granted && tracking) {
            map.stopLocate();
            leafletGeo = false;
            (async () => {  // IIFE
                try {
                    const pos = await Geolocation.getCurrentPosition({
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 5000
                    });
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
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
                    distanceFilter: 10  // Highest frequency updates
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
                    if (tracking) { // tracking can be turned off during pause
                        tracker(lat, lng, ele);
                    }
                    return;
                };
                await BackgroundGeolocation.start(config, onPosition);
                capgoGeo = true;
            })();    
        } else {
            notice("No permission provided")
        }
    } else {
            BackgroundGeolocation.stop();
            capgoGeo = false;
            map.locate({enableHighAccuracy: true, watch: true});
            map.on('locationfound', markerUpdate);
            leafletGeo = true;
    }
    return;
} 
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
            notice('File saved to your Files app: (Documents folder)');
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
    return;
}
async function createAndDownloadGPX(dwnld_name: string, action: string) {
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
    trackSaveModal.hide();
    markSessionClean();
    if (action === 'kill') {
        cleanTrack();
    }
    return;
}
/**
 * When a user wishes, he may delete a saved map: Obviously, at least one
 * 'mapname' resides in the 'mapnames.txt' file when 'delmap' is clicked.
 */
$('body').on('click', '#delmap', async function() {
    const choice = $('#select_map').val() as string;
    const map_sel = document.getElementById('select_map') as HTMLSelectElement;
    if (map_sel && map_sel.selectedIndex !== -1) {
        // Remove the element at the index directly from the browser window's native collection
        map_sel.remove(map_sel.selectedIndex);
    }
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
    await prepareMapNames();
    appendFilesize();
    return;
});
// Remove any previously cached hybrid tiles not saved to map
const tmpfiles = await tileDownloader.readDirFiles('tmpFiles') 
if (tmpfiles) {
    tileDownloader.removeData('tmpFiles');
}
/**
 * If the app is closed with unsaved track/marker data present,
 * ensure that it can be restored when the app is opened again.
 * Note that there is no explicit mechanism to detect app closure.
 */
// When unsaved data exists, mark the session as dirty
export async function markSessionDirty() {
    await Preferences.set({ key: 'session_dirty', value: 'true' });
}
// When data is saved, clear the flag
export async function markSessionClean() {
    await Preferences.set({ key: 'session_dirty', value: 'false' });
}
export const saveSessionState = async () => {
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
export async function checkLastSession() {
    const { value } = await Preferences.get({ key: 'session_dirty' });
    if (value === 'true') {
        let lastMap = await tileDownloader.readSessionText() as string;
        if (lastMap.length > 0) {
            $('#usmap').text(lastMap);
        } else {
            $('#usmap').text('Online');
        }
      restoreModal.show();
    }
}
// On app start — check if last session ended cleanly
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
    trackSaveModal.show();
});
restore_data.addEventListener('hidden.bs.modal', () => {
    if (!prevent_bs_modal_close) {
        gpx_pts = [];
        waypts = [];
        markSessionClean();
        restoreModal.hide();
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
    /*
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
    // End grid layer
    */
