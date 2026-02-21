/**
 * This code is constructed so as to permit both leaflet and mapBox tile storage.
 * At this time, the 'source' is 'osm': the various tile function arguments supply
 * source = 'osm' as a default. Note that 'source' is a subdirectory under the tiles
 * path for each map. By specifying 'mapBox' as an argument, the 'mapBox' path is
 * designated instead.
 */

import { Filesystem, Directory } from '@capacitor/filesystem';
import { CapacitorHttp } from '@capacitor/core';

class TileManager {

    // Setting up independent directories for each map saved
    async  createMapGroup(mapGroup) {
        try {
            await Filesystem.mkdir({
                path: `${mapGroup}/tracks`,  // there may be > 1 tracks in map
                directory: Directory.Documents,
                recursive: true
            });
            await Filesystem.mkdir({
                path: `${mapGroup}/tiles`,
                directory: Directory.Data,
                recursive: true
            });
            return true;
        } catch (e) {
            console.error("Unable to create directory", e);
            return false;
        }
    }

    async fileExists(path) {
        try {
          await Filesystem.stat({
            path: path,
            directory: Directory.Data
          });
          return true;
        } catch (error) {
          return false;
        }
    }

    // Map names - all names saved thus far
    async readMapnames() {
        const mapnames = await Filesystem.readFile({
            path: "mapnames",
            directory: Directory.Documents,
            encoding: Encoding.UTF8
        });
        return mapnames;
    }
    async writeMapnames(mapnames) {
        await Filesystem.writeFile({
            path: "mapnames",
            data: mapnames,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true
        });
    }

    // Polylines
    async writeTrack(map, polyline) {
        await Filesystem.writeFile({
            path: `${map}/tracks/`,
            data: polyline,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true
        });
    }
    // More than 1 track can exist in a gpx file
    async readTracks(map) {
        const poly = await Filesystem.readFile({
            path: `${map}/tracks`,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
        });
        return poly;
    }

    /**
     * Downloading/reading tiles
     * Note:
     * 1. The addition of the 'map' argument allows tiles to be
     *    saved in their respective offline directories. Before
     *    the map is saved, the default value is 'initial' which
     *    bypasses the tile saving operation.
     * 2. Unless the 'Save Map' modal specifies a user-named map,
     *    fetches will all be directly to the osm [mapBox] url. When
     *    a map is saved, the downloadTile and downloadRegion fcts
     *    will be invoked to save tiles for offlne use later.
     */
    getTilePath(z, x, y, source='osm', map='initial') {
        if (map === 'initial') {
            return `${source}/${z}/${x}/${y}.png`;
        } else {
            return `${map}/tiles/${source}/${z}/${x}/${y}.png`;
        }
    }
    // Check if tile exists in filesystem
    async hasTile(z, x, y, source='osm', map='initial') {
        if (map === 'initial') {
            return false;
        } else {
            try {
                await Filesystem.stat({
                    path: this.getTilePath(z, x, y, source, map),
                    directory: Directory.Data
                });
                return true;
            } catch {
                return false;
            }
        }
    }

    // Download and cache tile: 'map' is assumed to be specified here
    async downloadTile(z, x, y, tileUrl, source='osm', map='initial') {
        try {
            const response = await CapacitorHttp.get({
                url: tileUrl,
                responseType: 'blob'
            });
            await Filesystem.writeFile({
                path: this.getTilePath(z, x, y, source, map),
                data: response.data,
                directory: Directory.Data,
                recursive: true
            });
            return true;
        } catch (error) {
            console.error('Download failed:', error);
            return false;
        }
    }

    // Get tile (from cache or download)
    async getTile(z, x, y, tileUrl, source='osm', map='initial') {
        if (await this.hasTile(z, x, y, source, map)) {
            const file = await Filesystem.readFile({
                path: this.getTilePath(z, x, y, source, map),
                directory: Directory.Data
            });
            return `data:image/png;base64,${file.data}`;
        }
        // downloads will be issued by saveMap.js...
        //await this.downloadTile(z, x, y, tileUrl, source, map);
        return this.getTile(z, x, y, tileUrl, source, map);
    }

    // Get file URI for native access (better for Mapbox)
    async getTileUri(z, x, y, source='osm', map='initial') {
        const result = await Filesystem.getUri({
            path: this.getTilePath(z, x, y, source, map),
            directory: Directory.Data
        });
        return result.uri;
    }

    // Bulk download for offline regions
    async downloadRegion(map, bounds, zoomLevels, source, progressCallback) {
        const tiles = this.calculateTiles(bounds, zoomLevels);
        let completed = 0;

        for (const tile of tiles) {
            if (!await this.hasTile(tile.z, tile.x, tile.y, source, map)) {
                const url = this.buildTileUrl(tile, source);
                await this.downloadTile(tile.z, tile.x, tile.y, url, source, map);
            }
            completed++;
            if (progressCallback) {
                progressCallback(completed, tiles.length);
            }
        }
    }

    // Calculate tiles for bounds
    calculateTiles(bounds, zoomLevels) {
        const tiles = [];
        zoomLevels.forEach(z => {
            const minTile = this.latLngToTile(bounds.north, bounds.west, z);
            const maxTile = this.latLngToTile(bounds.south, bounds.east, z);
            
            for (let x = minTile.x; x <= maxTile.x; x++) {
                for (let y = minTile.y; y <= maxTile.y; y++) {
                    tiles.push({ z, x, y });
                }
            }
        });
        return tiles;
    }

    latLngToTile(lat, lng, zoom) {
        const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 
            1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        return { x, y };
    }

    buildTileUrl(tile, source) {
        const urls = {
            osm: `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`,
            mapbox: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/${tile.z}/${tile.x}/${tile.y}?access_token=YOUR_TOKEN`
        };
        return urls[source];
    }

    // Clear cache
    async clearMapCache(map, source = 'osm') {
        const path1 = `${map}/tiles/${source}`;
        const path2 = `${map}/tracks`;
        await Filesystem.rmdir({
            path: path1,
            directory: Directory.Data,
            recursive: true
        });
        await Filesystem.rmdir({
            path: path2,
            directory: Directory.Documents,
            recursive: true
        });
    }

    // Delete data saved as string [mapnames, polylines]
    async deleteStrItem(map, item) {
        const path = item === 'mapnames' ? item : `${map}/tracks`;
        await deleteFile({
            path: path,
            directory: Directory.Documents
        });
    }
}

/** 
 * As maintenance, perhaps Filesystem.ReaddirResult(files) [see documentation]
 * Directory types:
 *     Documents [for strings: mapnames, track_poly]
 *     Data [used to store tile pngs]
 *     Library
 *     Cache ... see documentation
 * 
 */
export const tileManager = new TileManager();