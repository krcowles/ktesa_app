/// <reference path='./leaflet-offline.d.ts' />
/// <reference path='./leaflet-extension.d.ts' />
interface Coords {
    z: number;
    x: number;
    y: number;
}
import L from 'leaflet';
// @ts-ignore
import { tileManager } from './tileManager';

(L.TileLayer as any).Offline = L.TileLayer.extend({
    // no 'map' argument => 'createTile' fetches from osm [mapBox]
    createTile: function(coords: Coords, done: any) {
        const tile = document.createElement('img');
        const url = this.getTileUrl(coords);
        
        tileManager.getTile(coords.z, coords.x, coords.y, url, 'osm')
            .then( (dataUrl: any) => {
                tile.src = dataUrl;
                done(null, tile);
            })
            .catch( (err:any) => {
                done(err, tile);
        });
        return tile;  // as HTML <img> w/src=dataUrl retured from tileManager.getTile
    }
});
L.GridLayer.GridDebug = L.GridLayer.extend({
    createTile: function (coords: Coords) {
        var tile = document.createElement("DIV");
        tile.style.outline = '1px solid lightGreen'; //#e6e6e6
        tile.style.fontSize = '14pt';
        tile.style.color = "gainsboro";
        tile.innerHTML = [coords.z, coords.x, coords.y].join('/');
        return tile;
    }
});
L.gridLayer.gridDebug = function (opts) {
    return new L.GridLayer.GridDebug(opts);
};

export var map = L.map('map', {
    center: [35.1, -106.65], // ABQ
    minZoom: 6,
    maxZoom: 17,
    zoom: 10
});

L.tileLayer.offline = function(url, options) {
    return new L.TileLayer.Offline(url, options); // specifies 'createTile()'
};
L.tileLayer.offline('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 17
}).addTo(map);
map.addLayer(L.gridLayer.gridDebug());
export default map;
