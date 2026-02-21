/**
 * This code is constructed so as to permit both leaflet and mapBox tile storage.
 * At this time, the 'source' is 'osm': the various tile function arguments supply
 * source = 'osm' as a default. Note that 'source' is a subdirectory under the tiles
 * path for each map. By specifying 'mapBox' as an argument, the 'mapBox' path is
 * designated instead.
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { CapacitorHttp } from '@capacitor/core';

class TileDownloader {

    /**
     * Android requires permission to use 'Directory.Documents'
     */
    async androidPermissions() {
        const permission_status = await Filesystem.requestPermissions();
        return permission_status;
    }

    // NOTE: Directory.Documents only!!
    async docFileExists(path) {
        try {
            await Filesystem.stat({
                path: path,
                directory: Directory.Documents
            });
            return true;
        } catch (error) {
            console.error(`${path} does not exist`, error);
            return false;
        }
    }
    // Map names - all names saved thus far
    async writeMapnames(mapnames) {
        try {
            await Filesystem.writeFile({
                path: "mapnames.txt",
                data: mapnames,
                directory: Directory.Documents,
                encoding: Encoding.UTF8
            });
            return true;
        }
        catch (error) {
            console.error('Could not create mapnames:', error);
            return false;
        }
    }
    async readMapnames() {
        const mapnames = await Filesystem.readFile({
            path: "mapnames.txt",
            directory: Directory.Documents,
            encoding: Encoding.UTF8
        });
        return mapnames;
    }

    // Polylines
    async writeTrack(map, polyline) {
        try {
            await Filesystem.writeFile({
                path: `${map}/tracks/track.json`,
                data: polyline,
                directory: Directory.Documents,
                encoding: Encoding.UTF8,
                recursive: true
            });
            return true;
        }
        catch (error) {
            console.error('Could not write track:', error);
            return false;
        }
    }

    // Admin / test
    async readDirFiles(path, dir) {
        return await Filesystem.readdir({
            path: path, 
            directory: dir  // Directory.Documemts | Directory.Data
        }); // data returned is a list of objects (FileInfo)
    }
    async removeData(path, dir) {
        return await Filesystem.rmdir({
            path: path,
            directory: dir,  // Directory.Documemts | Directory.Data
            recursive: true
        });
    }

    /**
     * Downloading tiles
     * Note: The presence of the 'map' argument allows tiles to be
     * saved in their respective offline directories.
     */
    getTilePath(z, x, y, source='osm', map='initial') {
        if (map === 'initial') {
            return `${source}/${z}/${x}/${y}.png`;
        } else {
            return `${map}/tiles/${source}/${z}/${x}/${y}.png`;
        }
    }

    // Download and cache tile: map must be specified by user
    async downloadTile(z, x, y, tileUrl, source='osm', map='initial') {
        try {
            const response = await CapacitorHttp.get({
                url: tileUrl,
                headers: {
                    'User-Agent': 'MyMapApp/1.0'
                }
            });
            //console.log('HTTP response status:', response.status);
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: Failed`);
            }
            if (!response.data) {
                throw new Error('No data in response');
            }
            const tilePath = this.getTilePath(z, x, y, source, map);
            console.log('Writing to path:', tilePath);
            await Filesystem.writeFile({
                path: tilePath,
                data: response.data,
                directory: Directory.Data,
                recursive: true
            });
            //console.log('File written successfully');
            return true;
        } catch (error) {
            console.error('Download tile failed:', error);
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
        for (let i=0; i<zoomLevels[1]-zoomLevels[0]+1; i++) {
            zooms.push(zoomLevels[0] + i);
        }
        zooms.forEach(z => {
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
}
export const tileDownloader = new TileDownloader();
