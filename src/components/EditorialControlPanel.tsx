import type { FormEvent } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import type { ExplorerError, GeocodedLocation, PresetDestination } from '../types/explorer';
import { ErrorBanner } from './ErrorBanner';

interface EditorialControlPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: (query: string) => void;
  presets: readonly PresetDestination[];
  activePresetId: string | null;
  onPresetSelect: (preset: PresetDestination) => void;
  isGeocoding: boolean;
  activeLocation: GeocodedLocation | null;
  geocodeError: ExplorerError | null;
  onDismissGeocodeError: () => void;
  onRetryGeocode: () => void;
}

export function EditorialControlPanel({
  query,
  onQueryChange,
  onSearchSubmit,
  presets,
  activePresetId,
  onPresetSelect,
  isGeocoding,
  activeLocation,
  geocodeError,
  onDismissGeocodeError,
  onRetryGeocode,
}: EditorialControlPanelProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchSubmit(query);
  };

  return (
    <aside
      aria-label="Exploration Controls"
      className="w-full lg:w-1/3 lg:min-w-[380px] lg:max-w-[480px] lg:h-full bg-[#F9F7F2] border-b lg:border-b-0 lg:border-r border-[#E4DFD3] flex flex-col justify-between lg:overflow-y-auto"
    >
      <div className="p-6 sm:p-7 space-y-5">
        {/* Editorial Masthead */}
        <header className="border-b border-[#E4DFD3] pb-5">
          <p className="text-xs font-medium tracking-widest uppercase text-[#5C5852]">
            Geospatial Atlas
          </p>
          <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#181715] text-balance">
            Block Explorer
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5C5852]">
            Search any city, neighborhood, or landmark to resolve exact coordinates, inspect the
            urban fabric, and uncover local stories.
          </p>
        </header>

        {/* Search Form */}
        <section aria-label="Location search">
          <form onSubmit={handleSubmit} role="search" className="space-y-2.5">
            <label
              htmlFor="location-search-input"
              className="block text-xs font-semibold tracking-wider uppercase text-[#5C5852]"
            >
              Search Location
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#78726A]"
                  aria-hidden="true"
                />
                <input
                  id="location-search-input"
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="City, neighborhood, or address"
                  disabled={isGeocoding}
                  className="w-full min-h-[44px] rounded-lg border border-[#D8D1C3] bg-white pl-10 pr-9 py-2.5 text-sm text-[#181715] placeholder:text-[#8E877E] focus:border-[#1B3B6F] focus:outline-none focus:ring-2 focus:ring-[#1B3B6F]/15 disabled:opacity-60"
                />
                {query.length > 0 && !isGeocoding && (
                  <button
                    type="button"
                    onClick={() => onQueryChange('')}
                    aria-label="Clear search query"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[#78726A] hover:bg-[#EFECE4] hover:text-[#181715] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isGeocoding}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1B3B6F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#152E57] disabled:opacity-65 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
              >
                {isGeocoding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Locating</span>
                  </>
                ) : (
                  <span>Explore</span>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Presets Section */}
        <section aria-labelledby="presets-heading" className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2
              id="presets-heading"
              className="text-xs font-semibold tracking-wider uppercase text-[#5C5852]"
            >
              Featured Destinations
            </h2>
            <span className="text-xs text-[#78726A]">One-click geocode</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isGeocoding}
                  onClick={() => onPresetSelect(preset)}
                  aria-pressed={isActive}
                  title={`${preset.label} — ${preset.regionHint}`}
                  className={`inline-flex min-h-[40px] items-center justify-center rounded-lg border px-3.5 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F] disabled:opacity-60 ${
                    isActive
                      ? 'border-[#1B3B6F] bg-[#1B3B6F] text-white'
                      : 'border-[#E4DFD3] bg-white text-[#181715] hover:border-[#1B3B6F]/60 hover:bg-[#F4F1EA]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Troubleshooting Error Banner */}
        {geocodeError && (
          <ErrorBanner
            error={geocodeError}
            onDismiss={onDismissGeocodeError}
            onRetry={onRetryGeocode}
            compact
          />
        )}

        {/* Active Location Dossier */}
        <section aria-labelledby="dossier-heading" className="border-t border-[#E4DFD3] pt-5">
          <h2
            id="dossier-heading"
            className="text-xs font-semibold tracking-wider uppercase text-[#5C5852]"
          >
            Coordinate Dossier
          </h2>

          {activeLocation ? (
            <div className="mt-3.5 space-y-4" data-testid="location-dossier">
              <div>
                <h3 className="font-serif text-2xl font-semibold text-[#181715] text-balance">
                  {activeLocation.cityStateLabel}
                </h3>
                <p className="mt-1 text-sm text-[#5C5852] leading-relaxed">
                  {activeLocation.formattedAddress}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#E4DFD3] pt-3.5 text-xs">
                <div>
                  <dt className="text-[#78726A]">Latitude</dt>
                  <dd className="mt-0.5 font-mono font-medium tabular-nums text-[#181715]">
                    {activeLocation.location.lat.toFixed(6)}°
                  </dd>
                </div>
                <div>
                  <dt className="text-[#78726A]">Longitude</dt>
                  <dd className="mt-0.5 font-mono font-medium tabular-nums text-[#181715]">
                    {activeLocation.location.lng.toFixed(6)}°
                  </dd>
                </div>
                <div>
                  <dt className="text-[#78726A]">Granularity</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-[#181715]">
                    {activeLocation.granularity}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#78726A]">Country</dt>
                  <dd className="mt-0.5 text-[#181715] truncate">
                    {activeLocation.country || '—'}
                  </dd>
                </div>
                {activeLocation.placeId && (
                  <div className="col-span-2">
                    <dt className="text-[#78726A]">Place ID</dt>
                    <dd className="mt-0.5 font-mono text-[11px] tabular-nums text-[#5C5852] truncate">
                      {activeLocation.placeId}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <div className="mt-3.5 rounded-lg border border-dashed border-[#D8D1C3] bg-[#F4F1EA]/60 p-4">
              <div className="flex items-start gap-2.5 text-sm text-[#5C5852]">
                <MapPin className="h-4 w-4 shrink-0 text-[#78726A] mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">
                  Select a featured destination or enter a place above to geocode its coordinates
                  and inspect local insights.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Editorial Footer */}
      <footer className="border-t border-[#E4DFD3] px-6 py-4 sm:px-8 text-xs text-[#78726A]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Google Maps Platform</span>
          <span aria-hidden="true">·</span>
          <span>Geocoding V4</span>
          <span aria-hidden="true">·</span>
          <span>Local Guide</span>
        </div>
      </footer>
    </aside>
  );
}
