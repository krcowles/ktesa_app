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
import $ from 'jquery';
import 'jquery-ui/ui/widgets/autocomplete';
import 'jquery-ui/themes/base/all.css';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CapacitorHttp } from '@capacitor/core';
//import * as bootstrap from "bootstrap";
import { tileDownloader } from './tileDownloader';
/**
 * @fileoverview Specify an area on the map, with or without a gpx track,
 * and save the maptiles (zooming up to 16, and down to 10) and the track.
 * There are three current methods provided to save maps:
 *    1. import a hike track from the site; track also displays on map
 *    2. import a gpx track and center the map display on it
 *    3. draw a rectangle on the map representing the area desired for offline
 * 
 * @author Ken Cowles
 * @version 1.0 Initial release
 */


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
    /*
    if (saver) {
        save_modal.show();
    }
    */
    return;
});


//var saver = false;   // boolean indicating whether or not to (re-)show the save modal
var mapName = 'unassigned';  // user specifies
var map_center: L.LatLngExpression;
var track_string: string;
/*
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
var startX: number;  // lat of upper-left tile; ul[0]
var startY: number;  // lng of upper-left tile; ul[1]
var endX: number;    // lat of lower-right tile; lr[0]
var endY: number;    // lng of lower-right tile; lr[1]
var track_colors = ['Red', 'Blue', 'DarkGreen', 'HotPink', 'DarkBlue',
    'Chocolate', 'DarkMagenta', 'Black'];
*/
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


/**
 * 1. Import a site hike (imports map center, bounds, and gpx file)
 */
const importHike = async (hike: string) => {
    const site_data = await CapacitorHttp.post({
        url: 'https://nmhikes.com/ktesa_app/importHike.php',
        headers: { 'Content-Type': 'application/json' },
        data: { 
            hike: hike 
        }
    });
    const map_string = site_data.data;
    var mapData = JSON.parse(map_string);
    displayTrack(mapData, '#imphike');
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
        importHike(hike);
    });
    $('body').on('click', '#clear', function () {
        $('#search').val("").trigger("focus");
    });
}
ui_sources();

/**
 *  2. Import a gpx file
 */
const importGpx = async (form_data: FormData) => {
    const site_data = await CapacitorHttp.post({
        url: 'https://nmhikes.com/ktesa_app/importGpx.php',
        headers: { 'Content-Type': 'application/json' },
        data: { 
            file: form_data 
        }
    });
    const map_string = site_data.data;
    var mapData = JSON.parse(map_string);
    displayTrack(mapData, '#imphike');
};
$('body').on('submit', '#form', (ev) => {
    ev.preventDefault();
    var src = '#impgpx';
    mapName = useGpxFile.name;
    const gpxform = $('#form') as JQuery<HTMLFormElement>;
    const formData = new FormData(gpxform[0])
    importGpx(formData)
});
/**
 *  3. Draw a Rectangle
 */



/**
 * This function is utilized by both import methods to display data
 * The ajax data retrieved
 * is parsed to extract the track data and then forms a boundary box
 * around it. The appropriate 'Save' buttons are displayed for next
 * steps.
 */
function displayTrack(map_data: string, source: string) {
    //saver = false;
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
        /*
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
        */
        // establish points on map representing area to be saved
        startX = nw[0];
        startY = nw[1];
        endX   = se[0];
        endY   = se[1];
        //saveType = "import";
        $(source).hide();
        //show_grp(2);
        return;
    }
}
