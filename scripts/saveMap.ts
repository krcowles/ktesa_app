/// <reference types="jqueryui" />
//declare var hikeSources: HikeObject[];
interface HikeObject {
    value: string;
    label: StringConstructor;
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
import $ from 'jquery';
import 'jquery-ui/ui/widgets/autocomplete';
import 'jquery-ui/themes/base/all.css';
import * as L from 'leaflet';
import * as bootstrap from "bootstrap";
import { tileDownloader } from './tileDownloader'
/**
 * @fileoverview Specify an area on the map, with or without a gpx track,
 * and save the maptiles (zooming up to 18, and down to 10) and the track.
 * There are three current methods provided to save maps:
 *  1. import a hike track from the site; track also displays on map
 *  2. import a gpx track and center the map display on it
 *  3. draw a rectangle on the map representing the area desired for offline
 * 
 * @author Ken Cowles
 * @version 1.0 Initial release
 */

if (screen.orientation) {
    screen.orientation.addEventListener('change', () => {
        //const target = ev.target;
        //const type = target.type; // 'portatrait-primary', 'landcape-secondary'
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
 * Dialog boxes are being used instead of alerts which may not 
 * show up, or show up with no content, on mobile devices
 */
const warning = document.getElementById('warning') as HTMLDialogElement;
const msg     = document.getElementById('msg') as HTMLParagraphElement;
const ok_btn  = document.getElementById('ok') as HTMLButtonElement;
ok_btn.addEventListener('click', () => {
    warning.close();
    if (saver) {
        save_modal.show();
    }
    return;
});
const notice = (message: string) => {
    msg.textContent = message;
    warning.showModal();
    return;
};

// DISPLAY THE MAP:
var map = L.map('map', {
    center: [35.1, -106.65],
    minZoom: 6,
    maxZoom: 18,
    zoom: 10,
    zoomSnap: 1  // no fractional zooms for zoomOptimizer
});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www,openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
// For the 'Find Me' button:
map.on('locationfound', function (e) {
    map.panTo(e.latlng);
});
/**
 * This layer provides a map grid of tiles with the tile id's
 * supplied in each tile. This is primarily used for debug in order
 * to identify tiles within the area selected for saving offline.
 */
class GridDebug extends L.GridLayer {
    createTile(coords: L.Coords): HTMLElement {
        var tile = document.createElement("DIV");
        tile.style.outline = '1px solid azure'; //#e6e6e6
        tile.style.fontSize = '14pt';
        tile.style.color = "azure";
        tile.innerHTML = [coords.z, coords.x, coords.y].join('/');
        return tile;
      }
}
/* Alternate typescript approach:
(L.GridLayer as any).GridDebug = GridDebug;
(L.gridLayer as any).gridDebug = function (opts?: GridDebugOptions): GridDebug {
  return new GridDebug(opts);
};
map.addLayer((L.gridLayer as any).gridDebug());
*/
map.addLayer(new GridDebug());

/**
 * Globals [within this module]
 */
var viewingHeight = window.innerHeight;
var topArea: number; // any space on the top of the page consumed by buttons, etc.
var saver = false;   // boolean indicating whether or not to (re-)show the save modal
var mapName = 'unassigned';  // user specifies
var map_center: L.LatLngExpression;
var track_string: string;
var track_colors = ['Red', 'Blue', 'DarkGreen', 'HotPink', 'DarkBlue',
    'Chocolate', 'DarkMagenta', 'Black'];
var zoom_level = 10;
var saveType = "unspecified";
var hikeSources: HikeObject[]; // for searchbar autocomplete
var bounds: MapBounds;  // supplied to the tileDownloader for downloading regions
var gpximport = document.getElementById('gpxfile') as HTMLInputElement;
var useGpxFile: File;
gpximport.addEventListener('change', (ev: Event) => {
    const target = ev.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
        useGpxFile = files[0];
    } else if (typeof files === null) {
        saver = false;
        notice("A gpx file has not been selected");
        return false;
    }
    return;
});
var startX: number;  // lat of upper-left tile; ul[0]
var startY: number;  // lng of upper-left tile; ul[1]
var endX: number;    // lat of lower-right tile; lr[0]
var endY: number;    // lng of lower-right tile; lr[1]
var rect: L.Rectangle;
var ul_tile = [] as number[];
var lr_tile = [] as number[];
var tile_str = "https://tile.openstreetmap.org";
// tile positions as object {x:tilex, y:tiley}:
var tile_coords = [] as LeafletGridPosition[][];
tile_coords[10] = [];
tile_coords[11] = [];
tile_coords[12] = [];
tile_coords[13] = []; 
tile_coords[14] = [];
tile_coords[15] = [];
/**
 * Establish map height based on whether or not #imphike or #impgpx is active
 * Note: need above globals to already be established
 */
function mapHeight() {
    var map_height = (viewingHeight - topArea);
    $('#map').height(map_height);
    map.invalidateSize();
}

// Note: the name 'opener' conflicts with a DOM lib element: hence 'iopener'
var iopener  = new bootstrap.Modal(document.getElementById('intro') as HTMLDivElement);
var rectinst = new bootstrap.Modal(document.getElementById('rim') as HTMLDivElement);
var save_modal = new bootstrap.Modal(document.getElementById('map_save') as HTMLDivElement);
var saveStat = new bootstrap.Modal(document.getElementById('stat') as HTMLDivElement);


// hide some display options; default display is #imphike
$('#impgpx').hide();
$('#rect_btns').hide();
topArea = $('#imphike').outerHeight(true) as number;
mapHeight();
// which buttons to display:
const show_grp = (grpno: number) => {
    $('#map_grp1').css('display', 'none');
    $('#map_grp2').css('display', 'none');
    $('#map_grp3').css('display', 'none');
    $('#map_grp4').css('display', 'none');
    switch (grpno) {
        case 1:
            $('#map_grp1').css('display', 'block');
            break;
        case 2:
            $('#map_grp2').css('display', 'block');
            break;
        case 3:
            $('#map_grp3').css('display', 'block');
            break;
        case 4:
            $('#map_grp4').css('display', 'block');
            break;
        default:
            alert("Invalid button group number!");
    }
};
// Apparently jQuery cannot be used here:
const saveClose = document.getElementById('stat') as HTMLDivElement;
saveClose.addEventListener('hidden.bs.modal', () => {
    show_grp(4);
    return;
});

iopener.show();
show_grp(1); // default display for 'imphike'

const findMe = () => {
    map.locate({enableHighAccuracy: true, setView: false, watch: false, maxZoom: 17});
}

/**
 * The default state is to import a hike from the site;
 * The following represent buttons on the 'intro' modal
 */
$('body').on('click', '#rctg', function() {
    iopener.hide();
    $('#imphike').hide();
    $('#impgpx').hide();
    $('#rect_btns').show();
    show_grp(1);
    topArea = $('#rect_btns').outerHeight(true) as number;
    mapHeight();
    rectinst.show();
});
$('body').on('click', "#site", function() {
    iopener.hide();
    show_grp(1);
    topArea = $('#imphike').outerHeight(true) as number;
    mapHeight(); 
});
$('body').on('click', '#savegpx', function() {
    iopener.hide();
    $('#imphike').hide();
    $('#impgpx').show();
    show_grp(1);
    topArea = $('#impgpx').outerHeight(true) as number;
    mapHeight();
});

/**
 * Button group actions
 */
var redos = $('.redos'); // all the "Start Over" buttons
redos.each( (_i, btn) => {
    $(btn).on('click', () => {
        map.dragging.enable();
        window.open('./saveMap.html', '_self');
    });
});
$('button[id^=home]').on('click', () => {
    window.open("../index.html", "_self");
});
var savers = $('.save_btns'); // all the "Save" buttons
savers.each( (_i, btn) => {
    $(btn).on('click', () => {
        save_modal.show();
    });  
});
$('body').on('click', '#clearrect', function() {
    rect.removeFrom(map);
    // reset bootstrap draw button:
    $('#rect').prop('disabled', false);
    $('#rect').removeClass('btn-secondary');
    $('#rect').addClass('btn-primary');
});
$('body').on('click', '#omap', () => {
    window.open('../pages/useOffline.html', '_self');
});

/**
 * Buttons in modals
 */
$('body').on('click', '#begin', function() {  // rim modal
    rectinst.hide();
});
$('body').on('click', '#restart', () => {
    window.open('../saveMap.html', '_self');
});
// Zoom 13 is minimum to store tiles (limits memory consumption)
$('body').on('click', '#setzoom', () => {
    map.setZoom(13);
    $('#setzoom').removeClass('btn-primary');
    $('#setzoom').addClass('btn-secondary');
});
$('body').on('click', '#newctr', findMe);

/**
 * Save the map (and track, if applicable);
 * Close the save modal first in case the dialog box is needed;
 * After a dialog box is invoked, it will be closed and then
 * the save modal will reappear.
 * 
 */
$('body').on('click', '#save_map', async function () {
    save_modal.hide();
    show_grp(1);
    // parameter validation:
    zoom_level = map.getZoom();
    if (zoom_level < 13) {
        saver = false;
        notice("Please use a minimum of zoom 13");
        return false;
    }
    var stored_zoom = zoom_level.toString();
    mapName = $('#map_name').val() as string;
    if (mapName === '') {
        saver = true;
        notice("You must specify a map name");
        return false;
    }
    const fileExists = await tileDownloader.docFileExists("mapnames.txt");
    if (!fileExists) {
        names_list = [];
    } else {
        const saved_names = await tileDownloader.readMapnames() as string;
        var names_list = saved_names.split(",");
    }
    if (names_list.includes(mapName)) {
        saver = true;
        notice("This name is already used; please supply a new name");
        $('#map_name').val("");
        return false;
    } else {
        names_list.push(mapName);
        var new_list = names_list.join(",");
        await tileDownloader.writeMapnames(new_list);
    }
    if (saveType === "import") {
        bounds = getRectBounds();
        const trackWrite = await tileDownloader.writeTrack(mapName, track_string);
        if (!trackWrite) {
            saver = true;
            notice("Could not save the track for this hike");
            return false;
        }
    }
    var mapZoom = await tileDownloader.writeSavedZoom(mapName, stored_zoom);
    if (!mapZoom) {
        saver = false;
        notice(`Failed to save ${mapName} zoom level`);
    }
    var ctr = JSON.stringify(map_center);
    var ctr_write = await tileDownloader.writeCenter(mapName, ctr);
    if (!ctr_write) {
        saver = false;
        notice(`Failure to write map_center: ${mapName}`);
        return false;
    }
    // ensure ul and lr are defined and arranged nw to se:
    arrangeCorners();
    var maxZoomout = zoom_level - 1;
    var minZoomout = 10;
    var ul_start = ul_tile.slice();
    var ZoomoutCnt = (maxZoomout - 9) * 16;
    loadZoomOutTiles(ul_start, maxZoomout, minZoomout);
    // download the loadZoomOutTiles
    saveStat.show();
    $('#zot_cnt').text(ZoomoutCnt);
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
            var turl = `${tile_str}/${k}/${x}/${y}.png`;
            var tileStat = await tileDownloader.downloadTile(k, x, y, turl, 'osm', mapName);
            if (!tileStat) {
                saver = true;
                notice(`Could not download tile ${turl}`);
                break;
            }
            loaded++;
            $('#zot').text(loaded);
        }
    }
    /**
     * In order to fill out phone screens, bounds needs to be expanded, as bounds
     * represents only the enclosing rectangle.
     */
    //const init_bounds
    //    = {n: 1.001*bounds.n, w: 1.001*bounds.w, s: 0.999*bounds.s, e: 0.999*bounds.e} as MapBounds
    await tileDownloader.downloadRegion(mapName, bounds, [zoom_level, 16], 'osm', saveProgress);
    return;
});
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
 * This function is utilized by both import methods to display data
 * retrieved from the importHike.php utility. The ajax data retrieved
 * is parsed to extract the track data and then forms a boundary box
 * around it. The appropriate 'Save' buttons are displayed for next
 * steps.
 */
function displayTrack(ajax_data: string, source: string) {
    saver = false;
    if (ajax_data === 'Upload') {
        notice("File upload error - please check the selected file");
        return false;
    } else if (ajax_data === 'Extension') {
        notice("Selected file does not have a gpx extension");
        return false;
    } else if (ajax_data.indexOf("There is an error") !== -1) {
        notice(ajax_data);
        return false;
    } else {
        var result_array = JSON.parse(ajax_data);
        var ul = result_array[0];
        var lr = result_array[1];
        var nw = ul.map(Number); // convert to number
        var se = lr.map(Number);
        /**
         * I always mess up handling negative numbers, so here I use
         * absolute values and convert back for longitudes
         * NOPTE: array [0] is lat value, [1] is lng value
         */
        var latmarg = 0.10*(nw[0] - se[0])/2;
        var abslng_west = Math.abs(nw[1]);
        var abslng_east = Math.abs(se[1]);
        var absmarg = 0.20*(abslng_west - abslng_east)/2
        var lngmarg = -absmarg;
        nw = [nw[0]+latmarg, nw[1]+lngmarg];
        se = [se[0]-latmarg, se[1]-lngmarg];
        var trkbounds = [nw, se];
        // bounds includes all tracks
        L.rectangle(trkbounds, {color:'darkgreen', fill: false, weight: 2}).addTo(map);
        var lat = result_array[2][0];
        var lng = result_array[2][1];
        map_center = [lat, lng];
        // Create layers and add them before 'flyTo'
        var track_poly = result_array[3];
        track_string = JSON.stringify(track_poly);
        let n = 0;  // color pointer
        track_poly.forEach(function(segment: L.LatLng[]) {
            L.polyline(segment, {color: track_colors[n++]}).addTo(map);
        })
        // tracks & bounds rectangle are added, now pan to center of map
        map.flyTo(map_center, 13, {duration: 1.5});
        setTimeout( () => {
            map.invalidateSize();
            zoomOptimizer();
        }, 2000);
        // establish points on map representing area to be saved
        startX = nw[0];
        startY = nw[1];
        endX   = se[0];
        endY   = se[1];
        saveType = "import";
        $(source).hide();
        show_grp(2);
        return;
    }
}
/**
 * IMPORT A SITE HIKE
 */
// Get latest hikes:
var wait4ajax = $.Deferred();
$.ajax({
    url: 'https://nmhikes.com/ktesa_app/appSiteHikes.php',
    dataType: 'json',
    success: (result) => {
        hikeSources = result;
        wait4ajax.resolve();
    },
    error: (_jqXHR, _textStatus, _errorThrown) => {
        document.open();
        document.write(_jqXHR.responseText);
        document.close();
        wait4ajax.reject();
    }
});
$.when( wait4ajax)
.then( () => {
    // hikeSources should now be valid
    $(".search").autocomplete({
        source: hikeSources,
        minLength: 2
        /*  -- debug --
        search: function(event, ui) {
            console.log('search triggered');
        },
        response: function(event, ui) {
            console.log("Response received: ", ui.content)
        }
        */
    });
    // When user selects item from dropdown:
    $("#search").on("autocompleteselect", function (event, ui) {
        // the searchbar dropdown uses 'label', but place 'value' in box & use that
        event.preventDefault();
        var entry = ui.item.value;
        mapName = entry;
        $(this).val(entry);
        var src = '#imphike';
        $.ajax({
            url: "https:nmhikes.com/php/importHike.php",
            data: { hike: entry },
            dataType: "text",
            method: "post",
            success: function (result) {
                displayTrack(result, src);
            },
            error: function (_jqXHR, _textStatus, _errorThrown) {
                alert("Problem: " + _textStatus + "; Error: " + _errorThrown);
            }
        });
    });
});
// Clear searchbar contents when user clicks on the "X"
$('#clear').on('click', function () {
    $('#search').val("");
    var searchbox = document.getElementById('search') as HTMLInputElement;
    searchbox.focus();
});

/**
 * IMPORT A GPX FILE
 */
$('body').on('submit', '#form', (ev) => {
    ev.preventDefault();
    var src = '#impgpx';
    mapName = useGpxFile.name;
    const gpxform = $('#form') as JQuery<HTMLFormElement>;
    const formData = new FormData(gpxform[0])
    var url = "nmhikes.com/php/importGpx.php";
    $.ajax({
        url: url,
        method: "post",
        data: formData,
        dataType: "text",
        contentType: false,
        processData: false,
        success: function(result) {
            displayTrack(result, src);
        },
        error: function (_jqXHR, _textStatus, _errorThrown) {
            alert("Problem: " + _textStatus + "; Error: " + _errorThrown);
        }
    });
});

/**
 * DRAW A RECTANGLE DEFINING AREA TO BE SAVED
 */
$('body').on('click', '#rect', function () {
    show_grp(1);
    const zlevel = map.getZoom();
    if (zlevel < 13) {
        saver = false;
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
        saveType = "draw";
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
        map_center = [lat_ctr, lng_ctr] as L.LatLngExpression;
        //map.dragging.enable();
        show_grp(3);
        bounds = getRectBounds();
        $('#map').off();
    }
    return;
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
zval.textContent = "10";
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
 * This function identifies tile bounds for the user-selected region.
 * For this app, the 'main' region is the user's map at zoom level and up;
 * The tile manager expects bounds to have numeric lat/lng values:
 * also required are lower zoom levels from zoom down to 10 - which are
 * calculated and loaded separately. Each of the lower zooms comprises a
 * 16x16 matrix of tiles.
 */
function getRectBounds() {
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
function getTileURL(lat: number, lng: number, zoom: number) {
    var latrad = lat * Math.PI / 180;
    var tileX = Math.floor((lng + 180) / 360 * (1 << zoom));
    var tileY = Math.floor((1 - Math.log(Math.tan(latrad)
        + 1 / Math.cos(latrad)) / Math.PI) / 2 * (1 << zoom));
    return zoom + "/" + tileX + "/" + tileY;
}
/**
 * User may draw from any corner, so establish matrix as if it were
 * drawn from upper left to lower right to simplify processing;
 * ul_tile, lr_tile are row, col arrays for upper left tile and lower
 * right tile.
 */
function arrangeCorners() {
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
    const rangeX = lr_tile[0] - ul_tile[0]; // #rows - 1
    const rangeY = lr_tile[1] - ul_tile[1]; // #cols - 1
    if (rangeX > 2 || rangeY > 2) {
        alert("Too big: Please select a smaller area");
        return false;
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
    return;
}
