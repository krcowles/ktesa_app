var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
/// <reference types="jquery" />
/// <reference types="leaflet" />
/// <reference path="./leaflet-offline.d.ts" />
import $ from 'jquery';
import * as bootstrap from "bootstrap";
import * as L from "leaflet";
import { registerPlugin } from "@capacitor/core";
import { tileDownloader } from './tileDownloader';
/**
 * NOTE: Satisfying typescript for Offline was a monstrous effort, and
 * would not have been possible without the help of AI (Claude).
 *
 * @fileoverview User selects offline map already created by 'saveMap.html':
 * @author Ken Cowles
 * @version 1.0 First release
 */
var BackgroundGeolocation = registerPlugin("BackgroundGeolocation");
var leaflet_map; // = map;
var zoom = 10; // dynamically changes
var maxZoom = 18;
var marker;
marker = null; // initial state
var zooming = false;
var tracking = false;
var track;
var polyline;
var start_modal = document.getElementById('use_offline');
var maps_available = new bootstrap.Modal(start_modal);
var dwnld = document.getElementById('save_gpx');
var save_gpx = new bootstrap.Modal(dwnld);
var gpx_pts = [];
var track_pt;
var redraw = function () {
    leaflet_map.invalidateSize({
        animate: true,
        pan: true
    });
};
if (screen.orientation) {
    screen.orientation.addEventListener('change', function () {
        redraw();
    });
}
else { // initial testing on browser
    $(window).on('resize', function () {
        redraw();
    });
}
// Display internet connection on 'maps_available' modal
var connection = document.getElementById('connection');
var connected = connection.textContent;
if (navigator.onLine) {
    connected = '🟢 Online';
}
else {
    connected = '🔴 Offline';
}
// If user cannot return to 'saveMaps.php' because he is offline...
var dialog_box = document.getElementById('halt_restart');
$('#nogo').on('click', function () {
    dialog_box.close();
});
// When errors occur...
var issue = document.getElementById('error_info');
$('body').on('click', '#got_it', function () {
    issue.close();
});
// icon/button clicking
$('body').on('click', '#use_map', function () {
    var choice = $('#select_map').val();
    maps_available.hide();
    displayMap(choice);
});
// Possibly return to 'save maps'...
$('body').on('click', '#restart', function () {
    if (connected.includes("Offline")) {
        dialog_box.showModal();
    }
    else {
        window.open('../pages/saveMap.php', "_self");
    }
});
$('body').on('click', '#gps_off', function () {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            $(this).css('display', 'none');
            $('#gps_on').css('display', 'inline');
            $('#no_save').css('display', 'none');
            $('#save_trk').css('display', 'inline');
            tracking = true;
            return [2 /*return*/];
        });
    });
});
$('body').on('click', '#gps_on', function () {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            $(this).css('display', 'none');
            $('#gps_off').css('display', 'inline');
            $('#save_trk').css('display', 'none');
            $('#no_save').css('display', 'inline');
            tracking = false;
            return [2 /*return*/];
        });
    });
});
$('body').on('click', '#save_trk', function () {
    save_gpx.show();
});
$('body').on('click', '#save_dwnld', function () {
    createAndDownloadGPX();
});
// Create modal selections for user
function prepareMapNames() {
    return __awaiter(this, void 0, void 0, function () {
        var mapnamesFile, savedMaps, retrieved, userMaps, _i, userMaps_1, map, option;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, tileDownloader.docFileExists('mapnames.txt')];
                case 1:
                    mapnamesFile = _a.sent();
                    if (!mapnamesFile) return [3 /*break*/, 3];
                    return [4 /*yield*/, tileDownloader.readMapnames()];
                case 2:
                    savedMaps = _a.sent();
                    retrieved = savedMaps.data;
                    userMaps = retrieved.split(",");
                    for (_i = 0, userMaps_1 = userMaps; _i < userMaps_1.length; _i++) {
                        map = userMaps_1[_i];
                        option = "<option value=\"".concat(map, "\">").concat(map, "</option>");
                        $('#select_map').append(option);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    $('#available').css('display', 'none');
                    $('#no_maps').css('display', 'block');
                    $('#use_map').prop('disabled', true);
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Initial presentation to user for offline map selection
prepareMapNames()
    .then(function () {
    maps_available.show();
});
var displayMap = function (map_name) { return __awaiter(void 0, void 0, void 0, function () {
    var mapCtr, leaflet_ctr, center, msg, map_track, zoomSet, savedZoom, msg, mapZoom, mapopts, zctrl, zsym, zval, customIcon;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, tileDownloader.readCenter(map_name)];
            case 1:
                mapCtr = _a.sent();
                leaflet_ctr = mapCtr.data;
                center = JSON.parse(leaflet_ctr);
                if (!mapCtr) {
                    msg = "Could not read map center for ".concat(map_name);
                    $('#msg').text(msg);
                    issue.showModal();
                    return [2 /*return*/, false];
                }
                return [4 /*yield*/, tileDownloader.readTrack(map_name)];
            case 2:
                map_track = _a.sent();
                if (!map_track) {
                    track = '';
                }
                else {
                    track = map_track.data;
                }
                return [4 /*yield*/, tileDownloader.readSavedZoom(map_name)];
            case 3:
                savedZoom = _a.sent();
                if (!savedZoom) {
                    msg = "Could not retrieve zoom level at which ".concat(map_name, " was saved")
                        + "\nMap will display at zoom level 10";
                    $('#msg').text(msg);
                    zoomSet = 10;
                    issue.showModal();
                }
                else {
                    mapZoom = savedZoom.data;
                    zoomSet = JSON.parse(mapZoom);
                }
                leaflet_map = L.map('map');
                // Define offline layer
                L.TileLayer.Offline = L.TileLayer.extend({
                    createTile: function (coords) {
                        var tile = document.createElement('img');
                        var url = tileDownloader.getTilePath(coords.z, coords.x, coords.y, 'osm', coords.name);
                        //tileDownloader.getTilePath(coords.z, coords.x, coords.y, 'osm', coords.name);
                        tileDownloader.docFileExists(url)
                            .then(function (found) {
                            if (found) {
                                return tileDownloader.getTile(url);
                            }
                            else {
                                return false;
                            }
                        })
                            .then(function (mapTile) {
                            if (mapTile) {
                                tile.src = mapTile;
                            }
                        })
                            .catch(function () {
                            alert("Could not retrieve ".concat(url));
                        });
                        return tile; // return <img> initially empty
                    }
                });
                // Create offline layer from definition
                L.tileLayer.offline
                    = function (url, options) {
                        return new L.TileLayer.Offline(url, options);
                    };
                mapopts = {
                    center: center,
                    minZoom: 10,
                    maxZoom: maxZoom,
                    zoom: zoomSet,
                    attribution: '&copy; <a href="https://www,openstreetmap.org/copyright">OpenStreetMap</a>'
                };
                L.tileLayer.offline('https://tile.openstreetmap.org/{z}/{x}/{y}.png', mapopts).addTo(leaflet_map);
                zctrl = document.createElement("DIV");
                zsym = document.createTextNode("Z: ");
                zctrl.style.marginLeft = "8px";
                zctrl.style.fontSize = "14px";
                zctrl.style.color = "brown";
                zctrl.style.fontWeight = "bold";
                zval = document.createElement("SPAN");
                zval.id = "zval";
                zval.textContent = zoom.toString();
                zctrl.append(zsym, zval);
                $('.leaflet-top.leaflet-left').append(zctrl);
                // debounce zoom: zoomend isn't working
                leaflet_map.addEventListener("zoom", function () {
                    if (!zooming) {
                        zooming = true;
                        setTimeout(function () {
                            var moving_zoom = leaflet_map.getZoom();
                            $('#zval').text(" " + moving_zoom);
                            zooming = false;
                        }, 100);
                    }
                });
                marker = null;
                customIcon = L.icon({
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
                }, function callback(position, error) {
                    if (error) {
                        if (error.code === "NOT_AUTHORIZED") {
                            if (window.confirm("This app needs your location, " +
                                "but does not have permission.\n\n" +
                                "Open settings now?")) {
                                BackgroundGeolocation.openSettings();
                            }
                        }
                    }
                    if (marker !== null) {
                        marker.remove();
                    }
                    //const userLoc = position as Location;
                    var lat = position === null || position === void 0 ? void 0 : position.latitude;
                    var lng = position === null || position === void 0 ? void 0 : position.longitude;
                    var ele = position === null || position === void 0 ? void 0 : position.altitude;
                    var latlng = [lat, lng];
                    // Create marker with custom icon at user's location
                    marker = L.marker(latlng, { icon: customIcon }).addTo(leaflet_map);
                    if (tracking) {
                        track_pt = { lat: lat, lng: lng, ele: ele };
                        gpx_pts.push(track_pt);
                    }
                });
                return [2 /*return*/];
        }
    });
}); };
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
var gpx_eof = "    </trkseg>\n  </trk>\n<gpx>";
// ---------- END GPX DATA ----------
function createAndDownloadGPX() {
    var gpx_xml = gpx_track; // beginning of xml file
    for (var i = 0; i < gpx_pts.length; i++) {
        var next_pt = '      <trkpt lat="' + gpx_pts[i].lat +
            '" lon="' + gpx_pts[i].lng + '">';
        var elev = "/n        <ele>" + gpx_pts[i].ele +
            "</ele>'\n      </trkpt>\n";
        gpx_xml += next_pt + elev;
    }
    gpx_xml += gpx_eof;
    // Download file w/user-selected name
}
/**
 * When a user wishes, he may delete a saved map:
 * Obviously, at least one 'mapname' resides in
 * the 'mapnames.txt' file when 'delmap' is clicked.
 */
$('body').on('click', '#delmap', function () {
    return __awaiter(this, void 0, void 0, function () {
        var choice, choice_opt, stored_mapnames, map_list, indx, new_map_list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    choice = $('#select_map').val();
                    choice_opt = "option[value=" + choice + "]";
                    $("#select_map " + choice_opt).remove();
                    return [4 /*yield*/, tileDownloader.readMapnames];
                case 1:
                    stored_mapnames = _a.sent();
                    map_list = stored_mapnames.split(",");
                    indx = map_list.indexOf(choice);
                    if (indx !== -1) {
                        map_list.splice(indx, 1);
                    }
                    if (!(map_list.length === 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, tileDownloader.deleteFile("mapnames.txt")];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    new_map_list = map_list.join(",");
                    return [4 /*yield*/, tileDownloader.writeMapnames(new_map_list)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [4 /*yield*/, tileDownloader.removeData(choice)];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
});
