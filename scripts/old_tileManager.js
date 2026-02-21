// Ror both openstreet [included as 'leafletIntegration.ts' and mapbox [not coded yet]
import { Filesystem, Directory } from '@capacitor/filesystem';
import { CapacitorHttp } from '@capacitor/core';

class TileManager {
    constructor() {
        this.tileDir = 'offline_tiles';
    }

    async  createMapGroup(mapGroup) {
        try {
                await Filesystem.mkdir({
                    path: `${mapGroup}/track`,
                    directory: Directory.Documents,
                    recursive: true
                });
                await Filesystem.mkdir({
                    path: `${mapGroup}/tiles`,
                    directory: Directory.Data,
                    recursive: true
                });
        } catch (e) {
            console.error("Unable to create directory", e);
        }
    }

    // Map names 
    async writeMapnames(mapnames) {
        await Filesystem.writeFile({
            path: "mapnames",
            data: mapnames,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true
        });
    }
    async readMapnames() {
        const mapnames = await Filesystem.readFile({
            path: "mapnames",
            directory: Directory.Documents,
            encoding: Encoding.UTF8
        });
        return mapnames;
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
    async readTrack(map) {
        const poly = await Filesystem.readFile({
            path: `${map}/tracks`,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
        });
        return poly;
    }

    /**
     * Downloading/reading tiles
     */
    getTilePath(z, x, y, source = 'osm') {
        return `${this.tileDir}/${source}/${z}/${x}/${y}.png`;
    }
    // Check if tile exists in filesystem
    async hasTile(map, z, x, y, source = 'osm') {
        try {
            await Filesystem.stat({
                path: this.getTilePath(z, x, y, source),
                directory: Directory.Data
            });
            return true;
        } catch {
            return false;
        }
    }

    // Download and cache tile
    async downloadTile(map, z, x, y, tileUrl, source = 'osm') {
        try {
            const response = await CapacitorHttp.get({
                url: tileUrl,
                responseType: 'blob'
            });
            await Filesystem.writeFile({
                path: `${map}/${this.getTilePath(z, x, y, source)}`,
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
    async getTile(z, x, y, tileUrl, source = 'osm') {
        if (await this.hasTile(z, x, y, source)) {
            const file = await Filesystem.readFile({
                path: this.getTilePath(z, x, y, source),
                directory: Directory.Data
            });
            return `data:image/png;base64,${file.data}`;
        }
        await this.downloadTile(z, x, y, tileUrl, source);
        return this.getTile(z, x, y, tileUrl, source);
    }

    // Get file URI for native access (better for Mapbox)
    async getTileUri(z, x, y, source = 'osm') {
        const result = await Filesystem.getUri({
            path: this.getTilePath(z, x, y, source),
            directory: Directory.Data
        });
        return result.uri;
    }

    // Bulk download for offline regions
    async downloadRegion(bounds, zoomLevels, source, progressCallback) {
        const tiles = this.calculateTiles(bounds, zoomLevels);
        let completed = 0;

        for (const tile of tiles) {
            if (!await this.hasTile(tile.z, tile.x, tile.y, source)) {
                const url = this.buildTileUrl(tile, source);
                await this.downloadTile(tile.z, tile.x, tile.y, url, source);
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
    async clearCache(source = null) {
        const path = source ? `${this.tileDir}/${source}` : this.tileDir;
        await Filesystem.rmdir({
            path: path,
            directory: Directory.Data,
            recursive: true
        });
    }

    
    // Delete data saved as string [mapnames, polylines]
    async deleteString(data) {
        await deleteFile({
            path: data,
            directory: Directory.Documents
        });
    }

    // Delete a map's tiles

}

/** 
 * It may be necessary to deploy Filesystem.deleteFidle({path: file_path, Directory})
 * when user deletes a map...
 * Also, as maintenance, perhaps Filesystem.ReaddirResult(files) [see documentation]
 * Directory types:
 *     Documents [not used here, requires permission for ios & android]
 *     Data [used to store tile pngs]
 *     Library
 *     Cache ... see documentation
 * 
 */
export const tileManager = new TileManager();