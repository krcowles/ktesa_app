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
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { CapacitorHttp } from '@capacitor/core';
var TileDownloader = /** @class */ (function () {
    function TileDownloader() {
    }
    /**
     * Android requires permission to use 'Directory.Data'
     */
    TileDownloader.prototype.androidPermissions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var permission_status;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Filesystem.requestPermissions()];
                    case 1:
                        permission_status = _a.sent();
                        return [2 /*return*/, permission_status];
                }
            });
        });
    };
    /**
     * Due to recent changes, Directory.Documents is no longer accessible,
     * hence all file system accesses are to Directory.Data. The following
     * section pertains to text files.
     */
    TileDownloader.prototype.docFileExists = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.stat({
                                path: path,
                                directory: Directory.Data
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_1 = _a.sent();
                        console.error("".concat(path, " does not exist"), error_1);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Map names - all names saved thus far
    TileDownloader.prototype.writeMapnames = function (mapnames) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.writeFile({
                                path: "mapnames.txt",
                                data: mapnames,
                                directory: Directory.Data,
                                encoding: Encoding.UTF8
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Could not create mapnames:', error_2);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TileDownloader.prototype.readMapnames = function () {
        return __awaiter(this, void 0, void 0, function () {
            var mapnames, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.readFile({
                                path: "mapnames.txt",
                                directory: Directory.Data,
                                encoding: Encoding.UTF8
                            })];
                    case 1:
                        mapnames = _a.sent();
                        return [2 /*return*/, mapnames.data];
                    case 2:
                        error_3 = _a.sent();
                        console.error('Could not read mapnames:', error_3);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Map Center coords as text
    TileDownloader.prototype.writeCenter = function (map, center) {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.writeFile({
                                path: "".concat(map, "/center.txt"),
                                data: center,
                                directory: Directory.Data,
                                encoding: Encoding.UTF8,
                                recursive: true
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_4 = _a.sent();
                        console.error("Could not write ".concat(map, "/center:"), error_4);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TileDownloader.prototype.readCenter = function (map) {
        return __awaiter(this, void 0, void 0, function () {
            var center, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.readFile({
                                path: "".concat(map, "/center.txt"),
                                directory: Directory.Data,
                                encoding: Encoding.UTF8
                            })];
                    case 1:
                        center = _a.sent();
                        return [2 /*return*/, center];
                    case 2:
                        error_5 = _a.sent();
                        console.error("Could not read ".concat(map, "/center: "), error_5);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Which zoom level when map was save
    TileDownloader.prototype.writeSavedZoom = function (map, zoom_str) {
        return __awaiter(this, void 0, void 0, function () {
            var error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.writeFile({
                                path: "".concat(map, "/zoom.txt"),
                                data: zoom_str,
                                directory: Directory.Data,
                                encoding: Encoding.UTF8,
                                recursive: true
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_6 = _a.sent();
                        console.error("Could not write ".concat(map, " @ zoom zoomLevel:"), error_6);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TileDownloader.prototype.readSavedZoom = function (map) {
        return __awaiter(this, void 0, void 0, function () {
            var zoom_level, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.readFile({
                                path: "".concat(map, "/zoom.txt"),
                                directory: Directory.Data,
                                encoding: Encoding.UTF8
                            })];
                    case 1:
                        zoom_level = _a.sent();
                        return [2 /*return*/, zoom_level];
                    case 2:
                        error_7 = _a.sent();
                        console.error("Could not read ".concat(map, " zoom levle "), error_7);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // Polylines
    TileDownloader.prototype.writeTrack = function (map, polyline) {
        return __awaiter(this, void 0, void 0, function () {
            var error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.writeFile({
                                path: "".concat(map, "/tracks/track.json"),
                                data: polyline,
                                directory: Directory.Data,
                                encoding: Encoding.UTF8,
                                recursive: true
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_8 = _a.sent();
                        console.error("Could not write ".concat(map, "/track:"), error_8);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TileDownloader.prototype.readTrack = function (map) {
        return __awaiter(this, void 0, void 0, function () {
            var poly, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.readFile({
                                path: "".concat(map, "/tracks/track.json"),
                                directory: Directory.Data,
                                encoding: Encoding.UTF8
                            })];
                    case 1:
                        poly = _a.sent();
                        return [2 /*return*/, poly];
                    case 2:
                        error_9 = _a.sent();
                        console.error("Could not read ".concat(map, "/track: "), error_9);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TileDownloader.prototype.deleteFile = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.deleteFile({
                                path: path,
                                directory: Directory.Data
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_10 = _a.sent();
                        console.error("Could not delete ".concat(path), error_10);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TileDownloader.prototype.readDirFiles = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var dirFiles, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.readdir({
                                path: path,
                                directory: Directory.Data
                            })];
                    case 1:
                        dirFiles = _a.sent();
                        return [2 /*return*/, dirFiles.files];
                    case 2:
                        error_11 = _a.sent();
                        console.error("Could not read directory ".concat(path), error_11);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TileDownloader.prototype.removeData = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var error_12;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.rmdir({
                                path: path,
                                directory: Directory.Data,
                                recursive: true
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                    case 2:
                        error_12 = _a.sent();
                        console.error("Could not remove data for ".concat(path), error_12);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * This section pertains to map tiles
     */
    // Used in both saving and retrieving tiles from the filesystem
    TileDownloader.prototype.getTilePath = function (z, x, y, source, map) {
        if (map === 'initial') {
            return "".concat(source, "/").concat(z, "/").concat(x, "/").concat(y, ".png");
        }
        else {
            return "".concat(map, "/tiles/").concat(source, "/").concat(z, "/").concat(x, "/").concat(y, ".png");
        }
    };
    /**
     * Fetch a tile from the file system to be used on the currently
     * instantiated map.
     */
    TileDownloader.prototype.getTile = function (tile_url) {
        return __awaiter(this, void 0, void 0, function () {
            var map_tile, error_13;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Filesystem.readFile({
                                path: tile_url,
                                directory: Directory.Data,
                            })];
                    case 1:
                        map_tile = _a.sent();
                        return [2 /*return*/, map_tile];
                    case 2:
                        error_13 = _a.sent();
                        console.log("Can't retrieve ".concat(tile_url, ": "), error_13);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Downloading tiles
     * Note: The presence of the 'map' argument allows tiles to be
     * saved in their respective offline directories.
     */
    // Download and cache tile: map must be specified by user
    TileDownloader.prototype.downloadTile = function (z_1, x_1, y_1, tileUrl_1) {
        return __awaiter(this, arguments, void 0, function (z, x, y, tileUrl, source, map) {
            var response, tilePath, error_14;
            if (source === void 0) { source = 'osm'; }
            if (map === void 0) { map = 'initial'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, CapacitorHttp.get({
                                url: tileUrl,
                                headers: {
                                    'User-Agent': 'MyMapApp/1.0'
                                },
                                responseType: 'blob'
                            })];
                    case 1:
                        response = _a.sent();
                        console.log('HTTP response status:', response.status);
                        if (response.status !== 200) {
                            throw new Error("HTTP ".concat(response.status, ": Failed"));
                        }
                        if (!response.data) {
                            throw new Error('No data in response');
                        }
                        tilePath = this.getTilePath(z, x, y, source, map);
                        console.log('Writing to path:', tilePath);
                        return [4 /*yield*/, Filesystem.writeFile({
                                path: tilePath,
                                data: response.data,
                                directory: Directory.Data,
                                recursive: true
                            })];
                    case 2:
                        _a.sent();
                        //console.log('File written successfully');
                        return [2 /*return*/, true];
                    case 3:
                        error_14 = _a.sent();
                        console.error('Download tile failed:', error_14);
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Bulk download for offline regions: source must be defined by caller
    TileDownloader.prototype.downloadRegion = function (map, bounds, zoomLevels, source, progressCallback) {
        return __awaiter(this, void 0, void 0, function () {
            var tiles, completed, _i, tiles_1, tile, url;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tiles = this.calculateTiles(bounds, zoomLevels);
                        completed = 0;
                        _i = 0, tiles_1 = tiles;
                        _a.label = 1;
                    case 1:
                        if (!(_i < tiles_1.length)) return [3 /*break*/, 4];
                        tile = tiles_1[_i];
                        url = this.buildTileUrl(tile, source);
                        return [4 /*yield*/, this.downloadTile(tile.z, tile.x, tile.y, url, source, map)];
                    case 2:
                        _a.sent();
                        completed++;
                        if (progressCallback) {
                            progressCallback(completed, tiles.length);
                        }
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Calculate tiles for bounds
    TileDownloader.prototype.calculateTiles = function (bounds, zoomLevels) {
        var _this = this;
        var tiles = [];
        // expand lowest/highest zooms in array
        var zooms = [];
        for (var i = 0; i < zoomLevels[1] - zoomLevels[0] + 1; i++) {
            zooms.push(zoomLevels[0] + i);
        }
        zooms.forEach(function (z) {
            var minTile = _this.latLngToTile(bounds.n, bounds.w, z);
            var maxTile = _this.latLngToTile(bounds.s, bounds.e, z);
            for (var x = minTile.x; x <= maxTile.x; x++) {
                for (var y = minTile.y; y <= maxTile.y; y++) {
                    tiles.push({ z: z, x: x, y: y });
                }
            }
        });
        return tiles;
    };
    TileDownloader.prototype.latLngToTile = function (lat, lng, zoom) {
        var x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
        var y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) +
            1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        return { x: x, y: y };
    };
    TileDownloader.prototype.buildTileUrl = function (tile, source) {
        var urls = {
            osm: "https://tile.openstreetmap.org/".concat(tile.z, "/").concat(tile.x, "/").concat(tile.y, ".png"),
            mapbox: "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/".concat(tile.z, "/").concat(tile.x, "/").concat(tile.y, "?access_token=YOUR_TOKEN")
        };
        return urls[source];
    };
    return TileDownloader;
}());
export var tileDownloader = new TileDownloader();
