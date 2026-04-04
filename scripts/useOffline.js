/// <reference types="jquery" />
/// <reference types="leaflet" />
/// <reference path="./leaflet-offline.d.ts" />
// Eliminate issues with leaflet.js calls to 'alert':
window.alert = window.alert || ((msg) => console.warn('Alert:', msg));
if (typeof window !== 'undefined' && !window.alert) {
    window.alert = (msg) => console.warn('Alert suppressed:', msg);
}
import $ from 'jquery';
import * as bootstrap from "bootstrap";
import * as L from "leaflet";
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import { tileDownloader } from './tileDownloader';
import { LocalNotifications } from '@capacitor/local-notifications';
/**
 * A conflict with webpack's jquery plugin required the following to
 * bypass "window.$ = assignments" [occurring in bootstrap] which
 * resulted in errors when running emulation.
 */
const win = window;
win['$'] = $;
win['jQuery'] = $;
/**
 * NOTE: Satisfying typescript for Offline was a monstrous effort, and
 * would not have been possible without the help of AI (Claude).
 *
 * @fileoverview User selects offline map already created by 'saveMap.html':
 * @author Ken Cowles
 * @version 1.0 First release
 */
var leaflet_map;
var marker;
marker = null; // initial state
var zooming = false;
var tracking = false;
var track;
const start_modal = document.getElementById('use_offline');
const maps_available = new bootstrap.Modal(start_modal);
const dwnld = document.getElementById('save_gpx');
const save_gpx = new bootstrap.Modal(dwnld);
var gpx_pts = [];
var track_pt;
const customIcon = L.icon({
    iconUrl: "../images/geodot.png",
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});
const redraw = () => {
    leaflet_map.invalidateSize({
        animate: true,
        pan: true
    });
    return;
};
if (screen.orientation) {
    screen.orientation.addEventListener('change', () => {
        redraw();
    });
}
else { // initial testing on browser
    $(window).on('resize', () => {
        redraw();
    });
}
// Display internet connection on 'maps_available' modal
const connection = document.getElementById('connection');
var connected = connection.textContent;
if (navigator.onLine) {
    connected = '🟢 Online';
}
else {
    connected = '🔴 Offline';
}
// If user cannot return to 'saveMaps.html' because he is offline...
const dialog_box = document.getElementById('halt_restart');
$('#nogo').on('click', () => {
    dialog_box.close();
});
// When errors occur...
const issue = document.getElementById('error_info');
$('body').on('click', '#got_it', function () {
    issue.close();
});
// icon/button clicking
$('body').on('click', '#use_map', () => {
    let choice = $('#select_map').val();
    maps_available.hide();
    displayMap(choice);
});
// Possibly return to 'save maps'...
$('body').on('click', '.restart', () => {
    if (connected.includes("Offline")) {
        dialog_box.showModal();
    }
    else {
        window.open('../pages/saveMap.html', "_self");
    }
});
$('body').on('click', '#gps_off', async function () {
    $(this).css('display', 'none');
    $('#gps_on').css('display', 'inline');
    $('#no_save').css('display', 'none');
    $('#save_trk').css('display', 'inline');
    tracking = true;
});
$('body').on('click', '#gps_on', async function () {
    $(this).css('display', 'none');
    $('#gps_off').css('display', 'inline');
    $('#save_trk').css('display', 'none');
    $('#no_save').css('display', 'inline');
    tracking = false;
});
$('body').on('click', '#save_trk', () => {
    save_gpx.show();
});
$('body').on('click', '#save_dwnld', function () {
    const gpx_name = $('#dwnld_name').val();
    createAndDownloadGPX(gpx_name);
});
// Create modal selections for user
async function prepareMapNames() {
    const mapnamesFile = await tileDownloader.docFileExists('mapnames.txt');
    if (mapnamesFile) {
        $('#select_map').empty();
        const savedMaps = await tileDownloader.readMapnames();
        const userMaps = savedMaps.split(",");
        for (const map of userMaps) {
            const option = `<option value="${map}">${map}</option>`;
            $('#select_map').append(option);
        }
    }
    else {
        $('#available').css('display', 'none');
        $('#no_maps').css('display', 'block');
        $('#use_map').prop('disabled', true);
    }
    return;
}
function offlineSelect() {
    // Presentation to user for offline map selection
    prepareMapNames()
        .then(() => {
        maps_available.show();
    });
}
offlineSelect();
$('#resel').on('click', () => {
    leaflet_map?.remove();
    //leaflet_map = null;
    requestNotificationPermission(false);
    offlineSelect();
    return;
});
const offlineLayer = (mapname) => {
    // Define offline layer: createTile is used by leaflet - this overrides it:
    L.TileLayer.Offline = L.TileLayer.extend({
        createTile: function (coords) {
            const tile = document.createElement('img');
            // use maxNative zoom to clamp tile loads
            const maxNativeZoom = this.options.maxNativeZoom;
            const nativeZoom = maxNativeZoom !== undefined
                ? Math.min(coords.z, maxNativeZoom)
                : coords.z;
            // If other coords shift, use this [replace getTilePath()]
            /*
            const zoomDiff = coords.z - nativeZoom;
            const nativeX = Math.floor(coords.x / Math.pow(2, zoomDiff));
            const nativeY = Math.floor(coords.y / Math.pow(2, zoomDiff));

            const url = tileDownloader.getTilePath(
                nativeZoom, nativeX, nativeY, 'osm', map_name
            );
            */
            const url = tileDownloader.getTilePath(nativeZoom, coords.x, coords.y, 'osm', mapname);
            tileDownloader.docFileExists(url)
                .then((found) => {
                if (found) {
                    return tileDownloader.getTile(url);
                }
                else {
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
    });
    // Create offline layer from definition
    L.tileLayer.offline
        = function (url, options) {
            return new L.TileLayer.Offline(url, options);
        };
    return L.tileLayer.offline;
};
const offlineMap = (map_nme, map_ctr, map_zoom, track) => {
    L.tileLayer.offline = offlineLayer(map_nme);
    leaflet_map = L.map('map', {
        center: map_ctr,
        minZoom: 10,
        maxZoom: 18,
        zoom: map_zoom
    });
    L.tileLayer.offline('', {
        maxNativeZoom: 16, // No tiles loaded after 16, just 'stretch' zooms
        maxZoom: 18
    }).addTo(leaflet_map);
    L.tileLayer.offline('', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(leaflet_map);
    // point to the starting zoom level
    const zctrl = document.createElement("DIV");
    const zsym = document.createTextNode("Z: ");
    zctrl.style.marginLeft = "8px";
    zctrl.style.fontSize = "14px";
    zctrl.style.color = "brown";
    zctrl.style.fontWeight = "bold";
    const zval = document.createElement("SPAN");
    zval.id = "zval";
    zval.textContent = leaflet_map.getZoom().toString();
    zctrl.append(zsym, zval);
    $('.leaflet-top.leaflet-left').append(zctrl);
    // debounce zoom: zoomend isn't working
    leaflet_map.addEventListener("zoom", () => {
        if (!zooming) {
            zooming = true;
            setTimeout(() => {
                var moving_zoom = leaflet_map.getZoom();
                $('#zval').text(" " + moving_zoom);
                zooming = false;
            }, 100);
        }
    });
    marker = null;
    if (track !== '') {
        const latlng_arr = JSON.parse(track);
        L.polyline(latlng_arr, { color: 'red' }).addTo(leaflet_map);
    }
    leaflet_map.invalidateSize();
    return;
};
async function requestNotificationPermission(enable) {
    if (!enable) {
        await BackgroundGeolocation.stop();
    }
    else {
        // Check the current status
        let permStatus = await LocalNotifications.checkPermissions();
        // If not already granted, request it
        if (permStatus.display !== 'granted') {
            permStatus = await LocalNotifications.requestPermissions();
        }
        if (permStatus.display === 'granted') {
            console.log("Notification permission allowed. Persistent tracking will work.");
            await BackgroundGeolocation.start({
                backgroundMessage: "Tracking the hike",
                backgroundTitle: "Your path is being recorded. Tap to return to app.",
                requestPermissions: true,
                stale: false, // Always get fresh data
                distanceFilter: 5 // Highest frequency updates
            }, (position, error) => {
                if (error) {
                    if (error.code === "NOT_AUTHORIZED") {
                        if (window.confirm("This app needs your location, " +
                            "but does not have permission.\n\n" +
                            "Open settings now?")) {
                            BackgroundGeolocation.openSettings();
                        }
                    }
                    else {
                        const msg = "Error detecting position";
                        $('#msg').text(msg);
                        issue.showModal();
                    }
                }
                if (typeof marker === 'undefined') { // 1st time setting
                    marker = null;
                }
                if (marker !== null) {
                    marker.remove();
                }
                //const userLoc = position as Location;
                const lat = position?.latitude;
                const lng = position?.longitude;
                const ele = position?.altitude;
                $('#lat').text(lat.toFixed(5));
                $('#lng').text(lng.toFixed(5));
                const latlng = [lat, lng];
                // Create marker with custom icon at user's location
                marker = L.marker(latlng, { icon: customIcon }).addTo(leaflet_map);
                if (tracking) {
                    track_pt = { lat: lat, lng: lng, ele: ele };
                    gpx_pts.push(track_pt);
                }
                return;
            });
        }
        else {
            console.error("Notification permission denied. Background tracking may be throttled.");
        }
    }
}
const displayMap = async (map_name) => {
    const mapCtr = await tileDownloader.readCenter(map_name);
    if (!mapCtr) {
        const msg = `Could not read map center for ${map_name}`;
        $('#msg').text(msg);
        issue.showModal();
        return false;
    }
    const leaflet_ctr = mapCtr.data;
    const center = JSON.parse(leaflet_ctr);
    const map_track = await tileDownloader.readTrack(map_name);
    if (!map_track) {
        track = '';
    }
    else {
        track = map_track.data;
    }
    var zoomSet;
    const savedZoom = await tileDownloader.readSavedZoom(map_name);
    if (!savedZoom) {
        const msg = `Could not retrieve zoom level at which ${map_name} was saved`
            + "\nMap will display at zoom level 10";
        $('#msg').text(msg);
        zoomSet = 10;
        issue.showModal();
    }
    else {
        const mapZoom = savedZoom.data;
        zoomSet = JSON.parse(mapZoom);
    }
    offlineMap(map_name, center, zoomSet, track);
    requestNotificationPermission(true);
    return;
};
// ---------- END MAP SETUP ---------
// Data for creating GPX File
var gpx_track = '<?xml version="1.0"?>' + "\n";
gpx_track += 'gpx xmlns="http://www.topografix.com/GPX/1/1" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.1" ' +
    'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 ' +
    'http://www.topografix.com/GPX/1/1/gpx.xsd" creator="nmhikes.com">';
gpx_track += "\n  <trk>\n    <name>USER</name>\n    <trkseg>\n";
const gpx_eof = "    </trkseg>\n  </trk>\n<gpx>";
function createAndDownloadGPX(dwnld_name) {
    var gpx_xml = gpx_track; // beginning of xml file
    for (let i = 0; i < gpx_pts.length; i++) {
        var next_pt = '      <trkpt lat="' + gpx_pts[i].lat +
            '" lon="' + gpx_pts[i].lng + '">';
        var elev = "/n        <ele>" + gpx_pts[i].ele +
            "</ele>'\n      </trkpt>\n";
        gpx_xml += next_pt + elev;
    }
    gpx_xml += gpx_eof;
    if (dwnld_name = '') {
        const msg = "Please enter a name for the downloadfile";
        $('#msg').text(msg);
        issue.showModal();
        return;
    }
    // Download file w/user-selected name
    const link = document.createElement('a');
    link.href = gpx_xml;
    link.download = dwnld_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
}
/**
 * When a user wishes, he may delete a saved map: Obviously, at least one
 * 'mapname' resides in the 'mapnames.txt' file when 'delmap' is clicked.
 */
$('body').on('click', '#delmap', async function () {
    const choice = $('#select_map').val();
    const choice_opt = "option[value=" + choice + "]";
    $("#select_map " + choice_opt).remove();
    const stored_mapnames = await tileDownloader.readMapnames();
    const map_list = stored_mapnames.split(",");
    const indx = map_list.indexOf(choice);
    if (indx !== -1) {
        map_list.splice(indx, 1);
    }
    if (map_list.length === 0) {
        await tileDownloader.deleteFile("mapnames.txt");
    }
    else {
        const new_map_list = map_list.join(",");
        await tileDownloader.writeMapnames(new_map_list);
    }
    await tileDownloader.removeData(choice);
    return;
});
