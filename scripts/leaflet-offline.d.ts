import * as L from 'leaflet';

declare module 'leaflet' {
    namespace TileLayer {
        class Offline extends L.TileLayer {
        downloadTiles(): void;
        // Add other custom methods
        }
    }
    
    namespace tileLayer {
        function offline(url: string, options?: L.TileLayerOptions): L.TileLayer.Offline;
    }
}
