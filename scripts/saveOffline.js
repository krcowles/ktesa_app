/// <reference types="jquery" />
/// <reference types="jqueryui" />
/// <reference types="leaflet" />
/// <reference types="geojson" />
/**
 * @fileoverview Capturing map tiles and tracks for offline use;
 * 
 * @author Ken Cowles
 * @version 1.0 Initial release
 */
if (screen.orientation) {
    screen.orientation.addEventListener('change', (ev) => {
        const target = ev.target;
        const type = target.type; // 'portatrait-primary', 'landcape-secondary'
        console.log(type);
        map.invalidateSize();
    });
} else {
    $(window).on('resize', () => {
        map.invalidateSize();
    });
}

const CACHE_NAMES = {
    tiles: 'map_tiles',
    code: 'map_source'
};
// hide some display options; default display is #imphike
$('#impgpx').hide();
$('#rect_btns').hide();
// Note: the name 'opener' conflicts with a DOM lib element: hence 'iopener'
var iopener  = new bootstrap.Modal(document.getElementById('intro'));
var rectinst = new bootstrap.Modal(document.getElementById('rim'));
var save_modal = new bootstrap.Modal(document.getElementById('map_save'));
var saveStat = new bootstrap.Modal(document.getElementById('stat'));
$('#stat').on('hidden.bs.modal', () => {
    show_grp(4);
});
// vanilla method (w/o jquery):
// (document.getElementById('stat')).addEventListener('hidden.bs.modal', () => {});
iopener.show();
const show_grp = (grpno) => {
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
show_grp(1); // default display for 'imphike'
// DISPLAY THE MAP:
var map = L.map('map', {
    center: [35.1, -106.65],
    minZoom: 6,
    maxZoom: 17,
    zoom: 10
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www,openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
map.on('locationfound', function (e) {
    map.panTo(e.latlng);
});
/**
 * This layer provides a map grid of tiles with the tile id's
 * supplied in each tile. This is primarily used for debug in order
 * to identify tiles within the area selected for saving offline.
 */
L.GridLayer.GridDebug = L.GridLayer.extend({
    createTile: function (coords) {
        var tile = document.createElement("DIV");
        tile.style.outline = '1px solid azure'; //#e6e6e6
        tile.style.fontSize = '14pt';
        tile.style.color = "azure";
        tile.innerHTML = [coords.z, coords.x, coords.y].join('/');
        return tile;
    }
});
L.gridLayer.gridDebug = function (opts) {
    return new L.GridLayer.GridDebug(opts);
};
map.addLayer(L.gridLayer.gridDebug());
findMe = () => {
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
    rectinst.show();
});
$('body').on('click', "#site", function() {
    iopener.hide();
    show_grp(1); 
});
$('body').on('click', '#savegpx', function() {
    iopener.hide();
    $('#imphike').hide();
    $('#impgpx').show();
    show_grp(1);
});
/**
 * Button group (see saveOffline.php button groups) actions
 */
var redos = $('.redos'); // all the "Start Over" buttons
redos.each( (i, btn) => {
    $(btn).on('click', () => {
        map.dragging.enable();
        window.open('../pages/saveOffline.php?logo=no', '_self');
    });
});
$('button[id^=home]').on('click', () => {
    window.open("../pages/member_landing.html", "_self");
});
var savers = $('.save_btns'); // all the "Save" buttons
savers.each( (i, btn) => {
    $(btn).on('click', () => {
        save_modal.show();
    });  
});
$('body').on('click', '#clearrect', function() {
    rect.removeFrom(map);
    maptiles = [];
    // reset bootstrap draw button:
    $('#rect').attr('disabled', false);
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
    window.open('../pages/saveOffline.php?logo=no', '_self');
});
// Zoom 13 is minimum to store tiles (limits memory consumption)
$('body').on('click', '#setzoom', () => {
    map.setZoom(13);
    $('#setzoom').removeClass('btn-primary');
    $('#setzoom').addClass('btn-secondary');
});
$('body').on('click', '#newctr', findMe);
$('body').on('click', '#save_map', function () {
    // Run validation tasks before saving...
    save_modal.hide();
    show_grp(1);
    // parameter validation:
    zoom_level = map.getZoom();
    if (zoom_level < 13) {
        // NOTE: clicking on alerts closes the modal
        alert("Please use zoom 13 or higher to specify area");
        save_modal.show();
        return false;
    }
    mapName = $('#map_name').val();
    if (mapName === '') {
        alert("Please specify a name for the map");
        save_modal.show();
        return false;
    }
    if (saveType === "import") {
        getRectTiles();
    }
    if (maptiles.length === 0) {
        alert("You must select an area (or a hike/gpx)");
        save_modal.show();
        return false;
    }
    var saved_maps = localStorage.getItem('mapnames');
    var maplist = saved_maps.split(","); // array
    if (maplist.includes(mapName)) {
        alert("This name is already used - please select a new name");
        $('#map_name').val("");
        save_modal.show();
        return false;
    }
    // Enable the tile cache event listener in the service worker
    navigator.serviceWorker.controller.postMessage({
        type: "Tiles",
        action: "Enable"
    });
    saveMapTiles(mapName)
    .then( () => {
        if (typeof rect !== 'undefined') {
            rect.remove();
        }
        if (saved_maps === 'none') {
            localStorage.setItem('mapnames', mapName);
        } else {
            maplist.push(mapName);
            var newlist = maplist.join(",");
            localStorage.setItem('mapnames', newlist);
        }
         // Disable the openstream fetch event listener in the service worker
        navigator.serviceWorker.controller.postMessage({
            type: "Tiles",
            action: "Disable"
        });
    }); 
});

// globals
var mobwidth = window.screen.width;
$('#form').width(mobwidth);
$('#map').width(mobwidth);
var mobheight = $(document).height();
var barht = $('#nav').height();
var ht_avail = mobheight - barht;
$('#map').height(ht_avail);

var mapName = 'Unassigned';
var zoom_level = 10;
var idb_track;
var map_center;
//var click_cnt = 0; For testing on non-mobile platform
var rect;
var startX;
var startY;
var endX;
var endY;
var tile = new Array(10);
for (var k = 0; k < 10; k++) {
    tile[k] = new Array(2);
}
var tile_str = "https://tile.openstreetmap.org/";
var maptiles = [];
var tile_cnt = 0;
// tile positions as object {x:tilex, y:tiley}:
var tile_coords = [];
tile_coords[10] = [];
tile_coords[11] = [];
tile_coords[12] = [];
tile_coords[13] = []; 
tile_coords[14] = [];
tile_coords[15] = [];
tile_coords[16] = [];
var saveType = "unspecified";
var gpximport = document.getElementById('gpxfile');
// Add rollover if no of tracks exceeds 8: so far, unlikely!
var track_colors = ['Red', 'Blue', 'DarkGreen', 'HotPink', 'DarkBlue',
    'Chocolate', 'DarkMagenta', 'Black'];
/**
 * There are three current methods provided to save maps:
 *  1. draw a rectangle on the map representing the area desired for offline
 *  2. import a hike track from the site; track also displays on map
 *  3. import a gpx track and center the map display on it
 */

/**
 * This function is utilized by both import methods to display data
 * retrieved from the importHike.php utility. The ajax data retrieved
 * is parsed to extract the track data and then forms a boundary box
 * around it. The appropriate 'Save' buttons are displayed for next
 * steps.
 */
function displayTrack(ajax_data, source) {
    if (ajax_data === 'Upload') {
        alert("File upload error - please check the selected file");
        return false;
    } else if (ajax_data === 'Extension') {
        alert("Selected file does not have a gpx extension");
        return false;
    } else if (ajax_data.indexOf("There is an error") !== -1) {
        alert(ajax_data);
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
         * NOPTE: [0] is lat value, [1] is lng value
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
        let n=0;
        track_poly.forEach(function(segment) {
            L.polyline(segment, {color: track_colors[n]}).addTo(map);
            n++;
        })
        var no_of_tracks = track_poly.length;
        var idb_data;
        for (let i=0; i<no_of_tracks; i++) {
            if (i === 0) {
                idb_data = track_poly[0].toString();
            } else {
                idb_data += "," + track_poly[i].toString();
            }
        }
        idb_track = idb_data; // indexedDB track polys, separated by ","
        // tracks & bounds rectangle are added, now pan to center of map
        map.flyTo(map_center, 13, {duration: 1.5});
        setTimeout( () => {
            zoom_level = map.getZoom();
            zoomOptimizer(zoom_level);
        }, 2000);
        // establish points on map representing area to be saved
        maptiles = [];
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
// Clear searchbar contents when user clicks on the "X"
$('#clear').on('click', function () {
    $('#search').val("");
    var searchbox = document.getElementById('search');
    searchbox.focus();
});
// Establish searchbar as jQueryUI widget
$(".search").autocomplete({
    source: hikeSources,
    minLength: 2
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
        url: "../php/importHike.php",
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

/**
 * IMPORT A GPX FILE
 */
$('body').on('submit', '#form', (ev) => {
    ev.preventDefault();
    if (gpximport.files.length === 0) {
        alert("A gpx file has not been selected");
        return false;
    }
    var src = '#impgpx';
    var file_contents = $('#gpxfile')[0].files[0];
    mapName = file_contents.name;
    const formData = new FormData($('#form')[0])
    var url = "../php/importGpx.php";
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
 * DRAWING A RECTANGLE DEFINING AREA TO BE SAVED
 */
$('body').on('click', '#rect', function () {
    show_grp(1);
    const zlevel = map.getZoom();
    if (zlevel < 13) {
        alert("Minimum zoom level is 13");
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
    /* comment out non-mobile when posting to site */
    /*
    click_cnt = 0;
    $('#map').on('click', function (e) {
        if (click_cnt === 0) {
            saveType = "draw";
            $('#map').on('mousemove', function (e) {
                draw_rect(e);
            });
            start_rect(e);
        }
        else {
            end_rect(e);
        }
        return;
    });
    */

    function start_rect(ev) {
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
    function draw_rect(ev) {
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
    function end_rect(ev) {
        var touchlist = ev.changedTouches;
        var items = touchlist.length;
        var touch = touchlist.item(items-1);
        var endRect = map.mouseEventToLatLng(touch);
        //var endRect = map.mouseEventToLatLng(ev.originalEvent);
        endX = endRect.lat;
        endY = endRect.lng;
        var lat_ctr = startX - (startX - endX)/2;
        var lng_ctr = startY + (endY - startY)/2;
        map_center = [lat_ctr, lng_ctr];
        //map.dragging.enable();
        show_grp(3);
        getRectTiles(zlevel);
        $('#map').off();
    }
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
function getTileURL(lat, lng, zoom) {
    var latrad = lat * Math.PI / 180;
    var tileX = Math.floor((lng + 180) / 360 * (1 << zoom));
    var tileY = Math.floor((1 - Math.log(Math.tan(latrad)
        + 1 / Math.cos(latrad)) / Math.PI) / 2 * (1 << zoom));
    return zoom + "/" + tileX + "/" + tileY;
}
/**
 * This function identifies tile addresses for the user-selected region
 * and propagates them out to zoom level 16 and in to zoom level 12. The
 * addresses are stored in the global 'maptiles'. Note that the maximum number
 * of tiles allowed for capture is a 3 x 3 matrix. Otherwise memory storage
 * gets too large.
 */
function getRectTiles() {
    maptiles = []; // clear for each invocation...
    var corner1 = getTileURL(startX, startY, zoom_level); // = user start STRING
    var corner2 = getTileURL(endX, endY, zoom_level);     // = user end STRING
    var XY1_Corner = corner1.split("/"); // array of strings
    var corner1XY = XY1_Corner.map(Number); // array:[0]=>zoom;[1]=>row;[2]=col: NUMERIC
    var XY2_Corner = corner2.split("/"); // array of strings
    var corner2XY = XY2_Corner.map(Number); // [z, r, c]
    var tileXmid = 0;
    var tileYmid = 0;
    /**
     * User may draw from any corner, so establish matrix as if it were
     * drawn from upper left to lower right to simplify processing;
     * ul_tile, lr_tile are arrays for upper left tile and lower right tile.
     */
    var ul_tile = []; // UPPER_LEFT  => [ul_row, ul_col]; NUMERIC
    var lr_tile = []; // LOWER RIGHT => [lr_row, lr_col]; NUMERIC
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
    /**
     * The 'tile' array will be flushed out to contain all captured tiles:
     * The starting point (tile[0]) is below:
     */
    tile[0] = ul_tile.slice(); // ul_tile row, col: NUMERIC COPY
    var rangeX = lr_tile[0] - ul_tile[0]; // #rows - 1
    var rangeY = lr_tile[1] - ul_tile[1]; // #cols - 1
    if (rangeX > 2 || rangeY > 2) {
        alert("Too big: Please select a smaller area");
        return false;
    }
    if (rangeX > 1 || rangeY > 1) {
        /**
         * Determine intermediate tile values: [1x3, 3x1, 2x3, 3x2, 3x3]:
         * For rangeX or rangeY = 2 [max], there will be 3 across or 3 down,
         * and will include a 'mid' tile in the resulting 'captured' matrix:
         * i.e. tile[] array
         */
        if (rangeX > 1) {  // 3 rows  
            tileXmid = ul_tile[0] + 1; // row mid
        }
        if (rangeY > 1) { // 3 cols     
            tileYmid = ul_tile[1] + 1; // col mid
        }
        if (rangeX * rangeY !== 0){ 
            // 2x3, 3x2, 3x3 only...
            if (tileXmid > 0) {  // 3 rows; rangeX = 2
                if (tileYmid > 0) {  // 3 cols; rangeY = 2
                    tile_cnt = 9;
                    // captured 9 tiles [tile[0] unchanged]
                    tile[1][0] = tileXmid;
                    tile[1][1] = ul_tile[1]; // midx row, ul col
                    tile[2][0] = lr_tile[0];
                    tile[2][1] = ul_tile[1]; // ul row+2, ul col
                    tile[3][0] = ul_tile[0];
                    tile[3][1] = tileYmid;
                    tile[4][0] = tileXmid;
                    tile[4][1] = tileYmid;
                    tile[5][0] = lr_tile[0]
                    tile[5][1] = tileYmid;
                    tile[6][0] = ul_tile[0];
                    tile[6][1] = lr_tile[1];
                    tile[7][0] = tileXmid
                    tile[7][1] = lr_tile[1];
                    tile[8][0] = lr_tile[0];
                    tile[8][1] = lr_tile[1];
                } else { // tileYmid = 1; rangeY = ; 3x2
                    tile_cnt = 6;
                    // tile[0] ok as is
                    tile[1][0] = tileXmid;
                    tile[1][1] = tile[0][1];
                    tile[2][0] = lr_tile[0];
                    tile[2][1] = tile[0][1];
                    tile[3][0] = ul_tile[0];
                    tile[3][1] = lr_tile[1];
                    tile[4][0] = tileXmid;
                    tile[4][1] = lr_tile[1];
                    tile[5] = lr_tile.slice();
                }
            } else if (tileYmid > 0) { 
                // rangeX = 1; rangeY = 2: 2x3
                tile_cnt = 6;
                // tile[0] ok as is
                tile[1][0] = lr_tile[0]; // row
                tile[1][1] = ul_tile[1]; // col
                tile[2][0] = ul_tile[0];
                tile[2][1] = tileYmid;
                tile[3][0] = lr_tile[0];
                tile[3][1] = tileYmid;
                tile[4][0] = ul_tile[0];
                tile[4][1] = lr_tile[1];
                tile[5] = lr_tile.slice();
            } // at least one var must be > 1, so both = 1 is not here
        } else {  // 1x3 and 3x1 [rangeX * rangeY = 0]
            tile_cnt = 3;
            if (tileXmid > 0) { // 3x1 tile[0] ok as is
                tile[1][0] = tileXmid;
                tile[1][1] = tile[0][1];
                tile[2] = lr_tile.slice();
            } else { // 1x3 [yMid > 0] tile[0] ok as is
                tile[1][0] = tile[0][0];
                tile[1][1] = tileYmid;
                tile[2] = lr_tile.slice();
            }
        }
    } else {
        if (rangeX === 0 && rangeY ===0) {
            // neither rangeX nor rangeY > 1
            tile_cnt = 1; // tile[0] is the tile
        } else if (rangeX === 0 || rangeY === 0) {
            // 1x2 or 2x1: tile[0] is the start, lr_tile is the end
            tile_cnt = 2;
            tile[1] = lr_tile.slice();
        } else if (rangeX === 1 && rangeY === 1) {
            // both rangeX & rangeY = 1: 2 x 2
            tile_cnt = 4;
            tile[1][0] = lr_tile[0];
            tile[1][1] = tile[0][1];
            tile[2][0] = tile[0][0];
            tile[2][1] = lr_tile[1];
            tile[3] = lr_tile.slice();
        }
    }
    // ----- End of Tile Calcs ----

    for (var j = 0; j < tile_cnt; j++) {
        var loc = { x: tile[j][0], y: tile[j][1] };
        tile_coords[zoom_level].push(loc);
    }
    /**
     * Find each tile's deeper zoom level tiles. Each tile produces 4 tiles
     * at the next zoom level; therefore there will be 85 tiles per zoom level
     * 13 tiles input to the routine. Get this done in the background while waiting
     * to invoke 'Save'. Each level's tile coords have already been established
     * and are held in 'tile_coords'.
     */
    for (var zoom = zoom_level; zoom < 16; zoom++) { // don't get 'next level' 17
        for (let k=0; k<tile_coords[zoom].length; k++) {
            var xtile = tile_coords[zoom][k].x;
            var ytile = tile_coords[zoom][k].y;
            zoom_in_tiles(zoom+1, xtile, ytile);
        }
    }
    // Convert tile_coords to maptiles:
    for (var level = zoom_level; level < 17; level++) {
        makeTile(level);
    }
    // Refer to diagram 'ZoomOutTiles.html'
    var seed = ul_tile.slice();
    loadZoomOutTiles(seed, zoom_level);
    for (var zo_level=zoom_level-1; zo_level>9; zo_level--) { // zoom_level already saved
        makeTile(zo_level);
    }
    return;
}
function makeTile(level) {
    tile_coords[level].forEach(function (tcoord) {
        var zoomdir = level + "/";
        var url = tile_str + zoomdir + tcoord.x + "/" + tcoord.y + ".png";
        maptiles.push(url);
    });
};
// Finding tile coordinates for a higher zoom
function zoom_in_tiles(next_level, prevx, prevy) {
    var newx_a = 2 * prevx;
    var newx_b = newx_a + 1;
    var newy_a = 2 * prevy;
    var newy_b = newy_a + 1;
    var loc1 = { x: newx_a, y: newy_a };
    var loc2 = { x: newx_b, y: newy_a };
    var loc3 = { x: newx_a, y: newy_b };
    var loc4 = { x: newx_b, y: newy_b };
    tile_coords[next_level].push(loc1);
    tile_coords[next_level].push(loc2);
    tile_coords[next_level].push(loc3);
    tile_coords[next_level].push(loc4);
    return;
};
function loadZoomOutTiles(ul_corner, start_zoom) {
    /**
     * Assumption: the most tiles in a portrait display will be 4x2, but when
     * rotated the display will contain 2x4. Only the 2 in each display are common.
     * [Refer to the diagram 'ZoomOutTiles.html'. A base set of four tiles [appearing 
     * in both landscape and portrait] forms the core of the next lower level.
     * Horizontal & portrait displays can be completely covered by a matrix of
     * 16 tiles at the next lower level ['Gang of 16']. All tiles can be derived from
     * one: the upper-left corner of the saved map. The upper left corner will always
     * be in the same position at each zoom level.
     */
    var row = ul_corner[0];
    var col = ul_corner[1];
    for (let k=start_zoom-1; k>9; k--) { // no added tiles at start_zoom
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
function zoom_out_tile(row, col) {  // for all cases, (currZoom, outZoom, col, row)
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
 * This function will acquire and return the map bounds for the zlevel+1
 * zoom.
 */
function getNextMapZoom(zlevel) {
    const ctr = map.getCenter();
    const next_zoom = zlevel + 1;
    const newbounds = map.getPixelBounds(ctr, next_zoom);
    const sw = map.unproject(newbounds.getBottomLeft(), next_zoom);
    const ne = map.unproject(newbounds.getTopRight(), next_zoom);
    return L.latLngBounds(sw, ne);
}

/**
 * After a hike is created, there may actually be sufficient space to
 * zoom in, which reduces memory load.
 */
function zoomOptimizer(zoom) {
    var repeat = false;
    const next_zoom_bounds = getNextMapZoom(zoom);
    if (next_zoom_bounds.getNorth() > startX 
        && next_zoom_bounds.getSouth() < endX
        && next_zoom_bounds.getWest() < startY
        && next_zoom_bounds.getEast() > endY
    ) {
        map.setZoom(zoom+1);
        repeat = true;
    }
    if (repeat) {
        zoomOptimizer(zoom+1);
    }
    return;
}

async function saveMapTiles(userMap) {
    saveStat.show();
    let bar = 0
    let tilecnt = maptiles.length;
    let incr = 100/tilecnt;
    $('#tcnt').text(tilecnt);
    // save the  map_data in the idb
    if (saveType === "import" && typeof idb_track !== 'undefined') {
        await storeMap(userMap, map_center, zoom_level, true, idb_track);
    } else {
        await storeMap(userMap, map_center, zoom_level, false);
    }
    caches.open(CACHE_NAMES.tiles)
    .then ( (cache) => {
        for (let j=0; j<tilecnt; j++) {
            bar = (j+1) * incr;
            cache.add(maptiles[j]);
            $('#bar').css('width', bar+"%");
        }
        // save maptiles in local storage for later clearing of cache
        var tileurls = maptiles.join(",");
        localStorage.setItem(userMap, tileurls);
    });
    var oldnames = localStorage.getItem('mapnames');
    var oldmaps  = oldnames.split(",");
    if (oldmaps[0] === 'none') {
        localStorage.setItem('mapnames', userMap);
    } else {
        oldmaps.push(userMap);
        newmaps = oldmaps.join(",");
        localStorage.setItem('mapnames', newmaps);
    }
}
