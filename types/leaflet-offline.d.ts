import * as L from 'leaflet';

declare module 'leaflet' {
    interface OfflineCoords extends Coords {
      name: string;
    }
  
    interface OfflineTileLayer extends TileLayer {
      createTile(coords: OfflineCoords, done?: DoneCallback): HTMLElement;
    }
  
    interface HybridTileLayer extends TileLayer {
      createTile(coords: OfflineCoords, done?: DoneCallback): HTMLElement;
      _fetchAndCacheOnlineTile(
        coords: Coords,
        nativeZoom: number,
        tile: HTMLImageElement
      ): Promise<void>;
    }
  
    type OfflineTileLayerClass = typeof TileLayer & {
      new(urlTemplate: string, options?: TileLayerOptions): OfflineTileLayer;
    }
  
    type HybridTileLayerClass = typeof TileLayer & {
      new(urlTemplate: string, options?: TileLayerOptions): HybridTileLayer;
    }
  
    namespace TileLayer {
      class Offline extends L.TileLayer {
        createTile(coords: OfflineCoords, done?: DoneCallback): HTMLElement;
      }
      class Hybrid extends L.TileLayer.Offline {  // ← extends Offline, not TileLayer
        createTile(coords: OfflineCoords, done?: DoneCallback): HTMLElement;
        _fetchAndCacheOnlineTile(
          coords: Coords,
          nativeZoom: number,
          tile: HTMLImageElement
        ): Promise<void>;
      }
    }
  
    namespace tileLayer {
      function offline(
        urlTemplate: string,
        options?: L.TileLayerOptions
      ): L.TileLayer.Offline;
      function hybrid(
        urlTemplate: string,
        options?: L.TileLayerOptions
      ): L.TileLayer.Hybrid;
    }
}
