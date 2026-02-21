import 'leaflet';

declare module 'leaflet' {
  namespace GridLayer {
        let GridDebug: {
        new(options?: GridLayerOptions): GridLayer;
        };
  }
  namespace gridLayer {
        function gridDebug(options?: GridLayerOptions): GridLayer;
  }
}