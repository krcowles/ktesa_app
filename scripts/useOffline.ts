/// <reference types="jquery" />
/// <reference types="leaflet" />
/// <reference path="./leaflet-offline.d.ts" />

interface Coords {
    name: string; // name of user-selected map
    z: number;
    x: number;
    y: number;
}
interface Track_Point {
    lat: number;
    lng: number;
    ele: number;
}
import $ from 'jquery';
import * as bootstrap from "bootstrap";
import * as L from "leaflet";
import type { BackgroundGeolocationPlugin } from './definitions.d.ts'
import { registerPlugin } from "@capacitor/core";
import { tileDownloader } from './tileDownloader';
import type { ReadFileResult } from "@capacitor/filesystem";
type TileLayerOfflineClass = typeof L.TileLayer & {
    new(urlTemplate: string, options?: L.TileLayerOptions): L.TileLayer;
};
/**
 * NOTE: Satisfying typescript for Offline was a monstrous effort, and
 * would not have been possible without the help of AI (Claude).
 * 
 * @fileoverview User selects offline map already created by 'saveMap.html':
 * @author Ken Cowles
 * @version 1.0 First release 
 */
const BackgroundGeolocation
    = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
var leaflet_map: L.Map // = map;
var zoom = 10; // dynamically changes
const maxZoom = 18;
var marker: L.Marker | null;
marker = null;  // initial state
var zooming = false;
var tracking = false;
var track: string;
var polyline: L.Polyline;
const start_modal = document.getElementById('use_offline') as HTMLDivElement;
const maps_available = new bootstrap.Modal(start_modal);
const dwnld = document.getElementById('save_gpx') as HTMLDivElement;
const save_gpx = new bootstrap.Modal(dwnld);
var gpx_pts = [] as Track_Point[];
var track_pt: Track_Point;

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
const connection = document.getElementById('connection') as HTMLSpanElement;
var connected = connection.textContent as string;
if (navigator.onLine) {
    connected = '🟢 Online';
} else {
    connected = '🔴 Offline';
}
// If user cannot return to 'saveMaps.php' because he is offline...
const dialog_box = document.getElementById('halt_restart') as HTMLDialogElement;
$('#nogo').on('click', () => {
    dialog_box.close();
});
// When errors occur...
const issue = document.getElementById('error_info') as HTMLDialogElement;
$('body').on('click', '#got_it',function() {
    issue.close();
});

// icon/button clicking
$('body').on('click', '#use_map', () => {
    let choice = $('#select_map').val() as string;
    maps_available.hide();
    displayMap(choice);
});
// Possibly return to 'save maps'...
$('body').on('click', '#restart', () => {
    if (connected.includes("Offline")) {
        dialog_box.showModal();
    } else {
        window.open('../pages/saveMap.php', "_self");
    }
});
$('body').on('click', '#gps_off', async function() {
    $(this).css('display', 'none');
    $('#gps_on').css('display', 'inline');
    $('#no_save').css('display', 'none');
    $('#save_trk').css('display', 'inline');
    tracking = true;
});
$('body').on('click', '#gps_on', async function() {
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
    const gpx_name = $('#dwnld_name').val() as string;
    createAndDownloadGPX(gpx_name);
});

// Create modal selections for user
async function prepareMapNames() {
    const mapnamesFile = await tileDownloader.docFileExists('mapnames.txt');
    if (mapnamesFile) {
        const savedMaps = await tileDownloader.readMapnames() as string;
        const userMaps = savedMaps.split(",");
        for (const map of userMaps) {
            const option = `<option value="${map}">${map}</option>`;
            $('#select_map').append(option);
        }
    } else {
        $('#available').css('display', 'none');
        $('#no_maps').css('display', 'block');
        $('#use_map').prop('disabled', true);
    }  
    return;
}
// Initial presentation to user for offline map selection
prepareMapNames()
.then( () => {
    maps_available.show();
});

const displayMap = async (map_name: string) => {
    const mapCtr = await tileDownloader.readCenter(map_name) as ReadFileResult;
    if (!mapCtr) {
        const msg = `Could not read map center for ${map_name}`;
        $('#msg').text(msg);
        issue.showModal();
        return false;
    }
    const leaflet_ctr = mapCtr.data as string;
    const center = JSON.parse(leaflet_ctr) as L.LatLng;
    const map_track = await tileDownloader.readTrack(map_name) as ReadFileResult;
    if (!map_track) {
        track = '';
    } else {
        track = map_track.data as string;
    }
    var zoomSet: number;
    const savedZoom = await tileDownloader.readSavedZoom(map_name) as any;
    if (!savedZoom) {
        const msg = `Could not retrieve zoom level at which ${map_name} was saved`
        + "\nMap will display at zoom level 10";
        $('#msg').text(msg);
        zoomSet = 10;
        issue.showModal();
    } else {
        const mapZoom = savedZoom.data as string;
        zoomSet = JSON.parse(mapZoom);
    }
    leaflet_map = L.map('map');
    // Define offline layer
    L.TileLayer.Offline = L.TileLayer.extend({
        createTile: function(coords: Coords) {
            const tile = document.createElement('img');
            const url = tileDownloader.getTilePath(coords.z,
                coords.x, coords.y, 'osm', coords.name);
            tileDownloader.docFileExists(url)
                .then ( (found: boolean) => {
                    if (found) {
                        return tileDownloader.getTile(url);
                    } else {
                        return false;
                    }
                })
                .then( (mapTile: any) => {
                    if (mapTile) {
                        tile.src = mapTile;
                    }
                })
                .catch( () => {
                    alert(`Could not retrieve ${url}`);
                });
            return tile; // return <img> initially empty
            
        }
    }) as unknown as TileLayerOfflineClass;
    // Create offline layer from definition
    L.tileLayer.offline
        = function(url: string, options?: L.TileLayerOptions) {
        return new L.TileLayer.Offline(url, options);
    };
    const mapopts = {
        center: center,
        minZoom: 10,
        maxZoom: maxZoom,
        zoom: zoomSet,
        attribution: '&copy; <a href="https://www,openstreetmap.org/copyright">OpenStreetMap</a>'
    };
    L.tileLayer.offline('https://tile.openstreetmap.org/{z}/{x}/{y}.png', 
        mapopts).addTo(leaflet_map);
    // point to the starting zoom level
    const zctrl = document.createElement("DIV");
    const zsym = document.createTextNode("Z: ");
    zctrl.style.marginLeft = "8px";
    zctrl.style.fontSize = "14px";
    zctrl.style.color = "brown";
    zctrl.style.fontWeight = "bold";
    const zval = document.createElement("SPAN");
    zval.id = "zval";
    zval.textContent = zoom.toString();
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
    const customIcon = L.icon({
        iconUrl: "../images/geodot.png",
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    if (track !== '') {
        polyline = JSON.parse(track);
        polyline.addTo(leaflet_map);
    }
    // Show user location (always)
    BackgroundGeolocation.addWatcher({
        backgroundMessage: "Cancel to prevent battery drain.",
        backgroundTitle: "Tracking",
        requestPermissions: true,
        stale: false,
        distanceFilter: 10
    },
    function callback(position, error): void {
        if (error) {
            if (error.code === "NOT_AUTHORIZED") {
                if (window.confirm(
                    "This app needs your location, " +
                    "but does not have permission.\n\n" +
                    "Open settings now?"
                )) {
                    BackgroundGeolocation.openSettings();
                }
            } else {
                const msg = "Error detecting position";
                $('#msg').text(msg);
                issue.showModal();
            }
        }
        if (marker !== null) {
            marker.remove();
        }
        //const userLoc = position as Location;
        const lat = position?.latitude as number;
        const lng = position?.longitude as number;
        const ele = position?.altitude as number;
        const latlng = [lat, lng] as L.LatLngExpression
        // Create marker with custom icon at user's location
        marker = L.marker(latlng, { icon: customIcon }).addTo(leaflet_map);
        if (tracking) {
            track_pt = {lat: lat, lng: lng, ele: ele} as Track_Point;
            gpx_pts.push(track_pt);
        }
        return;
    });
    return;
}
// ---------- END MAP SETUP ---------

/**
 * Data for creating a downloadable GPX file:
 */
var gpx_track = '<?xml version="1.0"?>' + "\n";
gpx_track += 'gpx xmlns="http://www.topografix.com/GPX/1/1" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.1" ' +
    'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 ' +
    'http://www.topografix.com/GPX/1/1/gpx.xsd" creator="nmhikes.com">';
gpx_track += "\n  <trk>\n    <name>USER</name>\n    <trkseg>\n";
const gpx_eof = "    </trkseg>\n  </trk>\n<gpx>";
// ---------- END GPX DATA ----------

function createAndDownloadGPX(dwnld_name: string) {
    var gpx_xml = gpx_track; // beginning of xml file
    for (let i=0; i<gpx_pts.length; i++) {
        var next_pt = '      <trkpt lat="' + gpx_pts[i].lat +  
            '" lon="' + gpx_pts[i].lng + '">';
        var elev = "/n        <ele>" +  gpx_pts[i].ele +
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
 * When a user wishes, he may delete a saved map:
 * Obviously, at least one 'mapname' resides in
 * the 'mapnames.txt' file when 'delmap' is clicked.
 */
$('body').on('click', '#delmap', async function() {
    const choice = $('#select_map').val() as string;
    const choice_opt = "option[value=" + choice + "]";
    $("#select_map " + choice_opt).remove();
    const stored_mapnames = await tileDownloader.readMapnames as unknown as string;
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
