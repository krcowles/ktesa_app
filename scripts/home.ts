/// <reference types="jqueryui" />
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
 *  --------- Phone Specific Actions ----------
 */
// Handle back navigation
if (Capacitor.getPlatform() === 'android') {
    App.addListener('backButton', () => {
        window.history.back();
    });
}
// iOS swipe-back gesture works automatically via browser history
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

/**
 * --------- Main display page ----------
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
$('#use').on('click', () => {
    // use offline routine
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
 * --------- Menu Options ---------
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
    map.flyTo(mapctr, 13, {duration: 2});
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
 * --------- SAVE OFFLINE MAP ----------
 */
var ul_tile = [] as number[];
var lr_tile = [] as number[];
var tile_str = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile";
var mapName: string;
const save_progress = document.getElementById('stat') as HTMLDivElement;
const save_status = new bootstrap.Modal(save_progress);

/**
 * User may draw from any corner, so establish matrix as if it were
 * drawn from upper left to lower right to simplify processing;
 * ul_tile, lr_tile are [row, col] arrays for upper left tile and lower
 * right tile. [Note: arranging may be somewhat redundant since the 
 * change to 'getRectBounds', but conversion to tiles is necessary]
 */
function getTileURL(lat: number, lng: number, zoom: number) {
    var latrad = lat * Math.PI / 180;
    var tileX = Math.floor((lng + 180) / 360 * (1 << zoom));
    var tileY = Math.floor((1 - Math.log(Math.tan(latrad)
        + 1 / Math.cos(latrad)) / Math.PI) / 2 * (1 << zoom));
    return zoom + "/" + tileX + "/" + tileY;
}
function idTileCorners() {
    var corner1 = getTileURL(startX, startY, zoom_level); // = user start STRING
    var corner2 = getTileURL(endX, endY, zoom_level);     // = user end STRING
    var XY1_Corner = corner1.split("/"); // array of strings
    var corner1XY = XY1_Corner.map(Number); // array:[0]=>zoom;[1]=>row;[2]=col: NUMERIC
    var XY2_Corner = corner2.split("/"); // array of strings
    var corner2XY = XY2_Corner.map(Number); // [z, r, c]
    ul_tile = []; // UPPER_LEFT  => [ul_row, ul_col]; NUMERIC
    lr_tile = []; // LOWER RIGHT => [lr_row, lr_col]; NUMERIC
    if (corner1XY[1] < corner2XY[1]) { // row check
        ul_tile[0] = corner1XY[1];
        lr_tile[0] = corner2XY[1];
    }
    else { 
        ul_tile[0] = corner2XY[1];
        lr_tile[0] = corner1XY[1];
    }
    if (corner1XY[2] < corner2XY[2]) { // col check
        ul_tile[1] = corner1XY[2];
        lr_tile[1] = corner2XY[2];
    }
    else {
        ul_tile[1] = corner2XY[2];
        lr_tile[1] = corner1XY[2];
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
    $('#map_save').css('display', 'none');
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
    var maxZoomout = zoom_level - 1;
    var minZoomout = 10;
    var ul_start = ul_tile.slice();
    var ZoomoutCnt = (maxZoomout - 9) * 16;
    loadZoomOutTiles(ul_start, maxZoomout, minZoomout);
    // download the loadZoomOutTiles
    save_status.show();
    $('#zot_cnt').text(ZoomoutCnt);
    var loaded = 0;
    for (let k=minZoomout; k<zoom_level; k++) {
        var level_coords = tile_coords[k].slice();  // [] = {x.row, y.col}
        /**
         * The for loop is critical to performance! I previously used a 
         * forEach, and the download hung, apparently due to the loop
         * causing a flood of requests swamping the Capacitor bridge.
         * ----- NOTE: turl is formatted for usgs, not osm -----
         */
        for (const tile_obj of level_coords) {
            var x = tile_obj.x;
            var y = tile_obj.y;
            var turl = `${tile_str}/${k}/${y}/${x}`;
            var tileStat = await tileDownloader.downloadTile(k, x, y, turl, 'usgs', mapName);
            if (!tileStat) {
                notice(`Could not download tile ${turl}`);
                break;
            }
            loaded++;
            $('#zot').text(loaded);
        }
    }
    /**
     * In order to fill out phone screens [only at the current zoom when loaded
     * in useOffline], padding around the rectangle is required. 'bounds' is still
     * used to generate zoomin tiles without the padding [see appSaveMap.html].
     * For the current zoom_level [download each tile before doing bounds region]
     * The number of tiles generated will be a relatively small number, so time
     * consumed is not much.
     * NOTE: ------ turl is formatted for usgs, not osm -------
     */
    const ur = ul_tile[0];
    const uc = ul_tile[1];
    const lr = lr_tile[0];
    const lc = lr_tile[1];
    // top row
    for (let row = ur-1, i=uc-1; i<=lc+1; i++) {
        let turl = `${tile_str}/${zoom_level}/${i}/${row}`;
        await tileDownloader.downloadTile(zoom_level, row, i, turl, 'usgs', mapName);
    }
    tile_coords[zoom_level]
    // bottom row
    for (let row=lr+1, j=uc-1; j<=lc+1;j++) {
        let turl = `${tile_str}/${zoom_level}/${j}/${row}`;
        await tileDownloader.downloadTile(zoom_level, row, j, turl, 'usgs', mapName);
    }
    // left side
    for (let col=uc-1, k=ur; k<=lr; k++) {
        let turl = `${tile_str}/${zoom_level}/${col}/${k}`;
        await tileDownloader.downloadTile(zoom_level, k, col, turl, 'usgs', mapName);
    }
    // right side
    for (let col=lc+1, n=ur; n<=lr; n++) {
        let turl = `${tile_str}/${zoom_level}/${col}/${n}`;
        await tileDownloader.downloadTile(zoom_level, n, col, turl, 'usgs', mapName);
    }
    // dowload the zoomins for 'bounds'
    await tileDownloader.downloadRegion(mapName, bounds, [zoom_level, 16], 'usgs', saveProgress);
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
