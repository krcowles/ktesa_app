import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { CapacitorHttp } from '@capacitor/core';
class TileDownloader {
    /**
     * Android requires permission to use 'Directory.Data'
     */
    async androidPermissions() {
        const permission_status = await Filesystem.requestPermissions();
        return permission_status.publicStorage;
    }
    /**
     * Due to recent changes, Directory.Documents is no longer accessible,
     * hence all file system accesses are to Directory.Data. The following
     * section pertains to text files.
     */
    async docFileExists(path) {
        try {
            await Filesystem.stat({
                path: path,
                directory: Directory.Data
            });
            return true;
        }
        catch (error) {
            //console.error("File item or doc does not exist");
            return false;
        }
    }
    // Map names - all names saved thus far
    async writeMapnames(mapnames) {
        try {
            await Filesystem.writeFile({
                path: "mapnames.txt",
                data: mapnames,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return true;
        }
        catch (error) {
            //console.error('Could not create mapnames:', error);
            return false;
        }
    }
    async readMapnames() {
        try {
            const mapnames = await Filesystem.readFile({
                path: "mapnames.txt",
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return mapnames.data;
        }
        catch (error) {
            //console.error('Could not read mapnames:', error);
            return false;
        }
    }
    // Map Center coords as text
    async writeCenter(map, center) {
        try {
            await Filesystem.writeFile({
                path: `${map}/center.txt`,
                data: center,
                directory: Directory.Data,
                encoding: Encoding.UTF8,
                recursive: true
            });
            return true;
        }
        catch (error) {
            //console.error(`Could not write ${map}/center:`, error);
            return false;
        }
    }
    async readCenter(map) {
        try {
            const center = await Filesystem.readFile({
                path: `${map}/center.txt`,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return center;
        }
        catch (error) {
            //console.error(`Could not read ${map}/center: `, error);
            return false;
        }
    }
    // Which zoom level when map was save
    async writeSavedZoom(map, zoom_str) {
        try {
            await Filesystem.writeFile({
                path: `${map}/zoom.txt`,
                data: zoom_str,
                directory: Directory.Data,
                encoding: Encoding.UTF8,
                recursive: true
            });
            return true;
        }
        catch (error) {
            //console.error(`Could not write ${map} @ zoom zoomLevel:`, error);
            return false;
        }
    }
    async readSavedZoom(map) {
        try {
            const zoom_level = await Filesystem.readFile({
                path: `${map}/zoom.txt`,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return zoom_level;
        }
        catch (error) {
            //console.error(`Could not read ${map} zoom levle `, error);
            return false;
        }
    }
    // Polylines
    async writeTrack(map, polyline) {
        try {
            await Filesystem.writeFile({
                path: `${map}/tracks/track.json`,
                data: polyline,
                directory: Directory.Data,
                encoding: Encoding.UTF8,
                recursive: true
            });
            return true;
        }
        catch (error) {
            //console.error(`Could not write ${map}/track:`, error);
            return false;
        }
    }
    async readTrack(map) {
        try {
            const poly = await Filesystem.readFile({
                path: `${map}/tracks/track.json`,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return poly;
        }
        catch (error) {
            //console.error(`Could not read ${map}/track: `, error);
            return false;
        }
    }
    async deleteFile(path) {
        try {
            await Filesystem.deleteFile({
                path: path,
                directory: Directory.Data
            });
            return true;
        }
        catch (error) {
            //console.error(`Could not delete ${path}`, error);
            return false;
        }
    }
    async readDirFiles(path) {
        try {
            const dirFiles = await Filesystem.readdir({
                path: path,
                directory: Directory.Data
            });
            return dirFiles.files;
        }
        catch (error) {
            //console.error(`Could not read directory ${path}`, error);
            return false;
        }
    }
    async removeData(path) {
        try {
            await Filesystem.rmdir({
                path: path,
                directory: Directory.Data,
                recursive: true
            });
            return true;
        }
        catch (error) {
            //console.error(`Could not remove data for ${path}`, error);
            return false;
        }
    }
    /**
     * This section pertains to map tiles
     */
    // Used in both saving and retrieving tiles from the filesystem
    getTilePath(z, x, y, source, map) {
        if (map === 'initial') {
            return `${source}/${z}/${x}/${y}.png`;
        }
        else {
            return `${map}/tiles/${source}/${z}/${x}/${y}.png`;
        }
    }
    /**
     * Fetch a tile from the file system to be used on the currently
     * instantiated map.
     */
    async getTile(tile_url) {
        try {
            const map_tile = await Filesystem.readFile({
                path: tile_url,
                directory: Directory.Data,
            });
            return map_tile;
        }
        catch (error) {
            console.log(`Can't retrieve ${tile_url}: `, error);
            return false;
        }
    }
    /**
     * Downloading tiles
     * Note: The presence of the 'map' argument allows tiles to be
     * saved in their respective offline directories.
     */
    // Download and cache tile: map must be specified by user
    async downloadTile(z, x, y, tileUrl, source = 'osm', map = 'initial') {
        try {
            const response = await CapacitorHttp.get({
                url: tileUrl,
                headers: {
                    'User-Agent': 'MyMapApp/1.0'
                },
                responseType: 'blob'
            });
            //console.log('HTTP response status:', response.status);
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: Failed`);
            }
            if (!response.data) {
                throw new Error('No data in response');
            }
            const tilePath = this.getTilePath(z, x, y, source, map);
            //console.log('Writing to path:', tilePath);
            await Filesystem.writeFile({
                path: tilePath,
                data: response.data,
                directory: Directory.Data,
                recursive: true
            });
            //console.log('File written successfully');
            return true;
        }
        catch (error) {
            //console.error('Download tile failed:', error);
            return false;
        }
    }
    // Bulk download for offline regions: source must be defined by caller
    async downloadRegion(map, bounds, zoomLevels, source, progressCallback) {
        const tiles = this.calculateTiles(bounds, zoomLevels);
        let completed = 0;
        for (const tile of tiles) {
            const url = this.buildTileUrl(tile, source);
            await this.downloadTile(tile.z, tile.x, tile.y, url, source, map);
            completed++;
            if (progressCallback) {
                progressCallback(completed, tiles.length);
            }
        }
    }
    // Calculate tiles for bounds
    calculateTiles(bounds, zoomLevels) {
        const tiles = [];
        // expand lowest/highest zooms in array
        var zooms = [];
        for (let i = 0; i < zoomLevels[1] - zoomLevels[0] + 1; i++) {
            zooms.push(zoomLevels[0] + i);
        }
        zooms.forEach(z => {
            const minTile = this.latLngToTile(bounds.n, bounds.w, z);
            const maxTile = this.latLngToTile(bounds.s, bounds.e, z);
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
}
export const tileDownloader = new TileDownloader();
