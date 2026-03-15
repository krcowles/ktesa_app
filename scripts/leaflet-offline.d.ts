import * as L from 'leaflet';

declare module 'leaflet' {
    interface OfflineCoords extends Coords {
        name: string;
    }
    interface OfflineTileLayer extends TileLayer {
        createTile(coords: OfflineCoords, done?: DoneCallback): HTMLElement;
    }
    type OfflineTileLayerClass = typeof TileLayer &
    {
        new(urlTemplate: string, options?: TileLayerOptions): OfflineTileLayer;
    }
    namespace TileLayer {
        class Offline extends L.TileLayer {
        //downloadTiles(): void;
        // Add other custom methods
        }
    }
    namespace tileLayer {
        function offline(
            urlTemplate: string,
            options?: L.TileLayerOptions
        ): L.TileLayer.Offline;
    }

}
