/**
 * This code is constructed so as to permit leaflet, usgs, and mapBox tile
 * storage. At this time, however, the various tile function arguments supply
 * "source = 'usgs'" as a default. Note that, in the filesystem, 'source' 
 * (e.g. 'usgs') is a subdirectory under the 'tiles' directory, which itself is
 * under the mapname directory. When osm (or another) source is specified, it
 * will be a separate directory alongside the 'usgs' directory. Functions that
 * don't return data will return a boolean indicating success or failure. Note
 * that Directory.Data is used instead of  Directory.Documents to avoid the
 * AI gallery copying. All Directory.Data files are private.
 */
interface Bounds {
    n: number;
    e: number;
    s: number;
    w: number;
}
interface TileCoords {
    z: number;
    x: number;
    y: number;
}
//type UrlsType = {usgs: string, osm: string, usgs: string, mapbox: string}
import { Filesystem, Directory, Encoding, FileInfo } from '@capacitor/filesystem';
import { CapacitorHttp } from '@capacitor/core';


class TileDownloader {

    #osm_head    = "https://openstreetmap.org";
    #usgs_head   = "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile";
    //#mapbox_head = "https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles";
    
    async docFileExists(path: string) {
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
    async writeMapnames(mapnames: string) {
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
        } catch (error) {
            return false;
        }
    }

    // Map Center coords as text
    async writeCenter(map: string, center: string) {
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
            return false;
        }
    }
    async readCenter(map: string) {
        try {
            const center = await Filesystem.readFile({
                path: `${map}/center.txt`,
                directory: Directory.Data,
                encoding: 
                Encoding.UTF8
            });
            return center;
        }
        catch (error) {
            return false;
        }
    }

    // Which zoom level when map was save
    async writeSavedZoom(map: string, zoom_str: string) {
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
            return false;
        }
    }
    async readSavedZoom(map: string) {
        try {
            const zoom_level = await Filesystem.readFile({
                path: `${map}/zoom.txt`,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return zoom_level;
        }
        catch (error) {
            return false;
        }
    }

    // Polylines
    async writeTrack(map: string, polyline: string) {
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
            return false;
        }
    }
    async readTrack(map: string) {
        try {
            const poly = await Filesystem.readFile({
                path: `${map}/tracks/track.json`,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return poly;
        }
        catch (error) {
            return false;
        }
    }
    async writeSessionText(textContents: string) {
        try {
            await Filesystem.writeFile({
                path: "session.txt",
                data: textContents,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async readSessionText() {
        try {
            const sessionText = await Filesystem.readFile({
                path: "session.txt",
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return sessionText.data;
        } catch (error) {
            return false;
        }
    }
    async writeUnsavedData(path: string, data: string) {
        try {
            await Filesystem.writeFile({
                path: path,
                data: data,
                directory: Directory.Data,
                encoding: Encoding.UTF8,
                recursive: true
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async readUnsavedData(path: string) {
        try {
            const data = await Filesystem.readFile({
                path: `${path}`,
                directory: Directory.Data,
                encoding: Encoding.UTF8
            });
            return data.data;
        } catch (error) {
            return false;
        }
    }
    /**
     * In order to simplify collecting tiles for transfer to a saved offline map, the
     * tilePath is a 'flat' storage path under the 'source' [usgs/osm]. E.g. under
     * tmpFiles/mapname/usgs will be a set of tiles with unique paths, not a set of
     * tileUrls with subdirectories under zoom levels.
     */
    async fetchAndCacheHybridTile(z: number, x: number, y: number, source='usgs', map: string) {
        try {
            const tileUrl = this.getTileUrl(z, x, y, source) as string;
            const response = await CapacitorHttp.get({
                url: tileUrl,
                headers: {
                    'User-Agent': 'ktesa_app/1.0'
                },
                responseType: 'blob'
            });
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: Failed`);
            }
            if (!response.data) {
                throw new Error('No data in response');
            }
            const hybridPath = this.getHybridPath(z, x, y, source) as string;
            await Filesystem.writeFile({
                path: `tmpFiles/${map}/${hybridPath}`,
                data: response.data,
                directory: Directory.Data,
                recursive: true
            });
            return true;
        } catch (error) {
            return false;
        }
    }
    async getHybridTile(hybridPath: string) {
        try {
            const map_tile = await Filesystem.readFile({
                path: hybridPath,
                directory: Directory.Data,
            });
            return map_tile;
        }
        catch (error) {
            console.log(`Can't retrieve ${hybridPath}: `, error);
            return false;
        }
    }
    async transferHybridTiles(mapname: string, source: string) {
        const hybrid_dir = `tmpFiles/${mapname}/${source}`
        const saved_files = await this.readDirFiles(hybrid_dir);
        if (!saved_files) return false;
        const list = saved_files as FileInfo[];
        for (const item of list) {
            if (item.type === 'file') {
                const path_pieces = item.name.split(".");
                const extension = path_pieces.pop();
                const [z, y, x] = path_pieces;
                // *** NOTE: Addresses only usgs tiles!!!
                const tile_dir = `${mapname}/tiles/${source}/${z}/${y}`;
                await this.ensureDir(tile_dir);
                const map_file = `${tile_dir}/${x}.${extension}`;
                const tilecopy = await this.copyHybridTile(
                    mapname, source, item.name, map_file
                ); 
                if (!tilecopy) {
                    console.log(item.name, " not copied");
                } else {
                    const remove = await this.deleteFile(`tmpFiles/${mapname}/${source}/${item.name}`);
                    if (!remove) {
                        console.log("Could not remove ", item.name)
                    }
                } 
            } else {
                console.log(`FileInfo type is not 'file' for ${item.name}`)
                return false
            }
        }
        await this.removeData('tmpFiles');
        return true;
    }
    async copyHybridTile(mapname: string, source: string, filepath: string, maptile: string) {
        const hybridPath = `tmpFiles/${mapname}/${source}/${filepath}`;
        try {
            await Filesystem.copy({
                from: hybridPath,
                to: maptile,
                directory: Directory.Data,
                toDirectory: Directory.Data
            });
            return true;
        }
        catch (error) {
            console.error("copyHybridTile failed:", error);
            return false;
        }
    }
    async ensureDir(path: string) {
        try {
            await Filesystem.mkdir({
                path,
                directory: Directory.Data,
                recursive: true
            });
        } catch {
            // Directory already exists — ignore
        }
    }
    async getHybridTileSize(hybridPath: string) {
        try {
            const file_stat = await Filesystem.stat({
                path: hybridPath,
                directory: Directory.Data
            });
            return file_stat.size as number;
        }
        catch (error) {
            return false;
        }
    }
    async deleteFile(path: string) {
        try {
            await Filesystem.deleteFile({
                path: path,
                directory: Directory.Data
            });
            return true;
        }
        catch (error) {
            return false;
        }

    }
    async getDirectorySize(dirPath: string) {
        const directory = Directory.Data;
        let totalSize = 0;
        try {
            const result = await Filesystem.readdir({
                path: dirPath,
                directory: directory,
            });
            for (const file of result.files) {
                const filePath = `${dirPath}/${file.name}`;
                if (file.type === 'directory') {
                    // Recurse into subdirectory
                    totalSize += await this.getDirectorySize(filePath);
                } else {
                    try {
                        const statResult = await Filesystem.stat({
                            path: filePath,
                            directory: directory,
                        });
                        totalSize += statResult.size;
                    } catch (e) {
                        console.warn(`Could not stat file: ${filePath}`, e);
                    }
                }
            }
            return totalSize;
        } catch (e) {
            console.warn(`Could not read directory: ${dirPath}`, e);
            return 0;
        }
    }   
    async readDirFiles(path: string) {
        try {
            const dirFiles =  await Filesystem.readdir({
                path: path, 
                directory: Directory.Data
            });
            return dirFiles.files;
        }
        catch (error) {
            return false;
        }
    }
    async removeData(path: string) {
        try {
            await Filesystem.rmdir({
                path: path,
                directory: Directory.Data,
                recursive: true
            });
            return true;
        }
        catch (error) {
            return false;
        } 
    }

    // FILESYSTEM PATH [NOT fetch url]
    getTilePath(map: string, z: number, x: number, y: number, source: string) {
        if (source === 'osm') {
            return `${map}/tiles/osm/${z}/${x}/${y}.png`;
        } else if (source === 'usgs') {
            return `${map}/tiles/usgs/${z}/${y}/${x}.jpg`; // extension required
        }
        return;  // no other 'sources' defined at this point
    }
    getHybridPath(z: number, x: number, y: number, source: string) {
        if (source === 'osm') {
            return `osm/${z}.${x}.${y}.png`;
        } else if (source === 'usgs') {
            return `usgs/${z}.${y}.${x}.jpg`;
        }
        return;
    }
    // FETCH URL:
    getTileUrl(z: number, x: number, y: number, source: string) {
        if (source === 'osm') {
            return `${this.#osm_head}/${z}/${x}/${y}.png`;
        } else if (source === 'usgs') {
            return `${this.#usgs_head}/${z}/${y}/${x}`;  //  no extension here
        }
        return;
    }
    
    /**
     * Fetch a tile from the file system to be used on the currently
     * instantiated map.
     */
    async getTile(tile_url: string) {
        try {
            const map_tile = await Filesystem.readFile({
                path: tile_url,
                directory: Directory.Data,
            });
            return map_tile;
        }
        catch (error) {
            return false;
        }
    }

    /**
     * Downloading tiles
     * Note: The presence of the 'map' argument allows tiles to be
     * saved in their respective offline directories.
     */

    // Download and cache tile: map must be specified by user
    async downloadTile(z: number, x: number, y: number, source='usgs', map: string) {
        try {
            const tileUrl = this.getTileUrl(z, x, y, source) as string;
            const response = await CapacitorHttp.get({
                url: tileUrl,
                headers: {
                    'User-Agent': 'ktesa_app/1.0'
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
            const tilePath = this.getTilePath(map, z, x, y, source) as string;
            // Filesystem writes must have an extension!!
            //console.log('Writing to path:', tilePath);
            await Filesystem.writeFile({
                path: tilePath,
                data: response.data,
                directory: Directory.Data,
                recursive: true
            });
            return true;
        } catch (error) {
            return false;
        }
    }
    // Bulk download for offline regions: source must be defined by caller
    async downloadRegion(map: string, bounds: Bounds, zoomLevels: number[],
            source: string, progressCallback?: (done: number, tile_cnt: number) => void) {
        const tiles = this.calculateTiles(bounds, zoomLevels);
        let completed = 0;

        for (const tile of tiles) {
            await this.downloadTile(tile.z, tile.x, tile.y, source, map);
            completed++;
            if (progressCallback) {
                progressCallback(completed, tiles.length);
            }
        }
    }
    // Calculate tiles for bounds
    calculateTiles(bounds: Bounds, zoomLevels: number[]) {
        const tiles = [] as TileCoords[];
        // expand lowest/highest zooms in array
        var zooms = [] as number[];
        for (let i=0; i<zoomLevels[1]-zoomLevels[0]+1; i++) {
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
    latLngToTile(lat: number, lng: number, zoom: number) {
        const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 
            1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        return { x, y };
    }
}
export const tileDownloader = new TileDownloader();
