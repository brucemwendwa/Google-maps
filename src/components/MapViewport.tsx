import { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { Crosshair, Globe } from 'lucide-react';
import type { ExplorerError, GeocodedLocation, InsightsState } from '../types/explorer';
import { ErrorBanner } from './ErrorBanner';
import { LocalInsightsBanner } from './LocalInsightsBanner';

interface MapViewportProps {
  mapsApiKey: string | null;
  configLoaded: boolean;
  activeLocation: GeocodedLocation | null;
  mapError: ExplorerError | null;
  onDismissMapError: () => void;
  insights: InsightsState;
  onRetryInsights: () => void;
  onDismissInsightsError: () => void;
  onStartQuiz: () => void;
}

const DEFAULT_CENTER = { lat: 18, lng: -10 };
const DEFAULT_ZOOM = 2.4;

function MapCameraController({ activeLocation }: { activeLocation: GeocodedLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !activeLocation) return;

    if (activeLocation.viewport) {
      const bounds = {
        south: activeLocation.viewport.low.lat,
        west: activeLocation.viewport.low.lng,
        north: activeLocation.viewport.high.lat,
        east: activeLocation.viewport.high.lng,
      };
      map.fitBounds(bounds, { top: 64, right: 64, bottom: 180, left: 64 });
    } else {
      map.panTo(activeLocation.location);
      map.setZoom(13);
    }
  }, [map, activeLocation]);

  return null;
}

function SelectedLocationMarker({ location }: { location: GeocodedLocation }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  useEffect(() => {
    setInfoOpen(false);
  }, [location.placeId, location.location.lat, location.location.lng]);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={location.location}
        title={location.cityStateLabel}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <div className="relative flex flex-col items-center cursor-pointer select-none group">
          <div className="mb-1.5 rounded-md border border-[#1B3B6F]/30 bg-[#F9F7F2]/95 px-2.5 py-1 text-xs font-semibold text-[#181715] shadow-md whitespace-nowrap">
            {location.cityStateLabel}
          </div>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#1B3B6F] shadow-lg transition-transform duration-150 group-hover:scale-110">
            <div className="h-3 w-3 rounded-full bg-[#E8A87C] ring-2 ring-white/80" />
          </div>
          <div className="h-2.5 w-0.5 bg-[#1B3B6F]" />
        </div>
      </AdvancedMarker>

      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={260}
          onCloseClick={() => setInfoOpen(false)}
        >
          <div className="p-1 text-[#181715]">
            <p className="font-serif text-sm font-semibold">{location.cityStateLabel}</p>
            <p className="mt-1 text-xs text-[#5C5852] leading-snug">
              {location.formattedAddress}
            </p>
            <p className="mt-1.5 font-mono text-[11px] tabular-nums text-[#78726A]">
              {location.location.lat.toFixed(5)}, {location.location.lng.toFixed(5)}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function RecenterControl({ activeLocation }: { activeLocation: GeocodedLocation | null }) {
  const map = useMap();

  if (!activeLocation || !map) return null;

  const handleRecenter = () => {
    if (activeLocation.viewport) {
      map.fitBounds(
        {
          south: activeLocation.viewport.low.lat,
          west: activeLocation.viewport.low.lng,
          north: activeLocation.viewport.high.lat,
          east: activeLocation.viewport.high.lng,
        },
        { top: 64, right: 64, bottom: 180, left: 64 }
      );
    } else {
      map.panTo(activeLocation.location);
      map.setZoom(13);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRecenter}
      aria-label={`Recenter map on ${activeLocation.cityStateLabel}`}
      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D8D1C3] bg-[#F9F7F2]/95 px-3 py-2 text-xs font-medium text-[#181715] shadow-md backdrop-blur-sm hover:bg-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
    >
      <Crosshair className="h-3.5 w-3.5 text-[#1B3B6F]" aria-hidden="true" />
      <span>Recenter</span>
    </button>
  );
}

export function MapViewport({
  mapsApiKey,
  configLoaded,
  activeLocation,
  mapError,
  onDismissMapError,
  insights,
  onRetryInsights,
  onDismissInsightsError,
  onStartQuiz,
}: MapViewportProps) {
  return (
    <main
      aria-label="Interactive Map Viewport"
      data-testid="map-viewport"
      className="relative w-full lg:w-2/3 h-[540px] sm:h-[620px] lg:h-full min-h-[420px] bg-[#E8E4DA] overflow-hidden"
    >
      {mapsApiKey ? (
        <APIProvider apiKey={mapsApiKey} language="en" region="US">
          <div className="h-full w-full" data-testid="google-map-container">
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={DEFAULT_ZOOM}
              gestureHandling="greedy"
              streetViewControl={false}
              mapTypeControl={true}
              fullscreenControl={true}
              zoomControl={true}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="h-full w-full"
            >
              <MapCameraController activeLocation={activeLocation} />
              {activeLocation && <SelectedLocationMarker location={activeLocation} />}
              <div className="absolute top-2.5 right-16 z-10">
                <RecenterControl activeLocation={activeLocation} />
              </div>
            </GoogleMap>
          </div>
        </APIProvider>
      ) : (
        <div
          data-testid="map-missing-key-fallback"
          className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-[#EBE6DC]"
        >
          <div className="max-w-md rounded-xl border border-[#D8D1C3] bg-[#F9F7F2] p-6 shadow-sm">
            <Globe className="mx-auto h-7 w-7 text-[#1B3B6F]" aria-hidden="true" />
            <h2 className="mt-3 font-serif text-xl font-semibold text-[#181715]">
              {configLoaded ? 'Interactive Map Ready for Setup' : 'Initializing Map Canvas...'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5C5852]">
              {configLoaded
                ? 'Enable Google Maps Platform to render live interactive map tiles, pan and zoom controls, and custom location markers.'
                : 'Checking Google Maps Platform configuration.'}
            </p>
            {activeLocation && (
              <div className="mt-4 border-t border-[#E4DFD3] pt-3 text-xs font-mono tabular-nums text-[#181715]">
                Target: {activeLocation.cityStateLabel} ({activeLocation.location.lat.toFixed(4)},{' '}
                {activeLocation.location.lng.toFixed(4)})
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map-level Auth / Loading Error Alert */}
      {mapError && (
        <div className="absolute top-4 right-4 left-4 sm:left-auto sm:w-96 z-30">
          <ErrorBanner error={mapError} onDismiss={onDismissMapError} compact />
        </div>
      )}

      {/* Local Insights Banner on Bottom Portion of Map Screen */}
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex justify-center sm:bottom-6 sm:left-6 sm:right-6">
        <LocalInsightsBanner
          insights={insights}
          onRetry={onRetryInsights}
          onDismissError={onDismissInsightsError}
          onStartQuiz={onStartQuiz}
        />
      </div>
    </main>
  );
}
