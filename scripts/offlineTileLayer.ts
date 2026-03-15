import * as L from 'leaflet';
import './leaflet-offline.d'; // ensure augmentation is loaded

interface Coords extends L.Coords {
    name?: string;
}

// Extend TileLayer with Offline class
(L.TileLayer as any).Offline = L.TileLayer.extend({
    createTile: async function (coords: Coords): Promise<HTMLImageElement | undefined> {
        const tile = document.createElement('img');
        const url = tileDownloader.getTilePath(
            coords.z,
            coords.x,
            coords.y,
            'osm',
            coords.name
        );

        if (await tileDownloader.docFileExists) {
            tileDownloader
                .getTile(url)
                .then((mapTile: any) => {
                    if (mapTile) {
                        tile.src = mapTile;
                    }
                })
                .catch(() => {
                    alert(`Could not retrieve ${url}`);
                });

            return tile; // HTML <img> with src = dataUrl from tileManager.getTile
        } else {
            return undefined;
        }
    },
});

// Register the factory function
(L.tileLayer as any).offline = function (
    url: string,
    options: L.TileLayerOptions = {}
): L.TileLayer.Offline {
    return new (L.TileLayer as any).Offline(url, options);
};
