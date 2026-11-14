import type { ExplorerError, GeocodedLocation, PresetDestination } from '../types/explorer';

export const GEOCODE_V4_BASE_URL = 'https://geocode.googleapis.com/v4/geocode/address/';

export const PRESET_DESTINATIONS: readonly PresetDestination[] = [
  {
    id: 'buenos-aires',
    label: 'Buenos Aires',
    query: 'Buenos Aires, Argentina',
    regionHint: 'South America',
  },
  {
    id: 'shibuya',
    label: 'Shibuya',
    query: 'Shibuya, Tokyo, Japan',
    regionHint: 'East Asia',
  },
  {
    id: 'copacabana',
    label: 'Copacabana',
    query: 'Copacabana, Rio de Janeiro, Brazil',
    regionHint: 'South America',
  },
  {
    id: 'cologne',
    label: 'Cologne',
    query: 'Cologne, Germany',
    regionHint: 'Central Europe',
  },
  {
    id: 'lima',
    label: 'Lima',
    query: 'Lima, Peru',
    regionHint: 'South America',
  },
];

interface GeocodeV4AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
  languageCode?: string;
}

interface GeocodeV4LatLng {
  latitude?: number;
  longitude?: number;
}

interface GeocodeV4Result {
  placeId?: string;
  formattedAddress?: string;
  granularity?: string;
  location?: GeocodeV4LatLng;
  viewport?: {
    low?: GeocodeV4LatLng;
    high?: GeocodeV4LatLng;
  };
  postalAddress?: {
    regionCode?: string;
    administrativeArea?: string;
    locality?: string;
    sublocality?: string;
  };
  addressComponents?: GeocodeV4AddressComponent[];
}

interface GeocodeV4Payload {
  results?: GeocodeV4Result[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export function buildGeocodeV4Url(addressQuery: string): string {
  const trimmed = addressQuery.trim();
  if (!trimmed) {
    throw new Error('Please enter a city, neighborhood, or street address to explore.');
  }
  const encodedAddress = encodeURIComponent(trimmed);
  return `${GEOCODE_V4_BASE_URL}${encodedAddress}?languageCode=en`;
}

function findComponent(
  components: GeocodeV4AddressComponent[] | undefined,
  candidateTypes: string[]
): GeocodeV4AddressComponent | undefined {
  if (!Array.isArray(components)) return undefined;
  for (const type of candidateTypes) {
    const match = components.find((comp) => Array.isArray(comp.types) && comp.types.includes(type));
    if (match?.longText || match?.shortText) {
      return match;
    }
  }
  return undefined;
}

export function parseGeocodeV4Response(payload: unknown, originalQuery: string): GeocodedLocation {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Received an invalid response format from the Geocoding V4 service.');
  }

  const data = payload as GeocodeV4Payload;
  const first = Array.isArray(data.results) ? data.results[0] : undefined;

  if (!first || !first.location || typeof first.location.latitude !== 'number' || typeof first.location.longitude !== 'number') {
    throw new Error(`No geocoded location was found for "${originalQuery}". Try adding a city or country.`);
  }

  const components = first.addressComponents;
  const localityComp = findComponent(components, [
    'locality',
    'sublocality_level_1',
    'sublocality',
    'administrative_area_level_2',
    'postal_town',
  ]);
  const stateComp = findComponent(components, [
    'administrative_area_level_1',
    'administrative_area_level_2',
  ]);
  const countryComp = findComponent(components, ['country']);

  const city =
    localityComp?.longText ??
    first.postalAddress?.locality ??
    first.postalAddress?.sublocality ??
    '';

  const state =
    stateComp?.longText ??
    first.postalAddress?.administrativeArea ??
    '';

  const country =
    countryComp?.longText ??
    first.postalAddress?.regionCode ??
    '';

  let cityStateLabel = '';
  if (city && state && city.toLowerCase() !== state.toLowerCase()) {
    cityStateLabel = `${city}, ${state}`;
  } else if (city && country) {
    cityStateLabel = `${city}, ${country}`;
  } else if (state && country) {
    cityStateLabel = `${state}, ${country}`;
  } else {
    cityStateLabel = first.formattedAddress ?? originalQuery.trim();
  }

  const lowLat = first.viewport?.low?.latitude;
  const lowLng = first.viewport?.low?.longitude;
  const highLat = first.viewport?.high?.latitude;
  const highLng = first.viewport?.high?.longitude;

  const viewport =
    typeof lowLat === 'number' &&
    typeof lowLng === 'number' &&
    typeof highLat === 'number' &&
    typeof highLng === 'number'
      ? {
          low: { lat: lowLat, lng: lowLng },
          high: { lat: highLat, lng: highLng },
        }
      : null;

  return {
    query: originalQuery.trim(),
    formattedAddress: first.formattedAddress ?? originalQuery.trim(),
    placeId: first.placeId ?? '',
    granularity: first.granularity ?? 'APPROXIMATE',
    location: {
      lat: first.location.latitude,
      lng: first.location.longitude,
    },
    viewport,
    city: city || cityStateLabel,
    state,
    country,
    cityStateLabel,
  };
}

export function formatGeocodeError(statusCode: number, body: unknown): ExplorerError {
  const payload = body && typeof body === 'object' ? (body as GeocodeV4Payload) : null;
  const apiMessage = payload?.error?.message;
  const apiStatus = payload?.error?.status;

  if (statusCode === 400) {
    return {
      source: 'geocode',
      title: 'Invalid Location Query',
      message: apiMessage || 'The Geocoding V4 endpoint could not parse this address format.',
      statusCode,
      endpoint: GEOCODE_V4_BASE_URL,
      detail: apiStatus || 'INVALID_ARGUMENT',
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      source: 'geocode',
      title: 'Google Maps Authorization Error',
      message:
        apiMessage ||
        'Geocoding V4 API access was denied. Verify that your Google Maps API key is valid and has the Geocoding API enabled.',
      statusCode,
      endpoint: GEOCODE_V4_BASE_URL,
      detail: apiStatus || 'PERMISSION_DENIED',
    };
  }

  if (statusCode === 404) {
    return {
      source: 'geocode',
      title: 'Location Not Found',
      message: apiMessage || 'No matching coordinates were found for that query.',
      statusCode,
      endpoint: GEOCODE_V4_BASE_URL,
      detail: apiStatus || 'NOT_FOUND',
    };
  }

  if (statusCode === 429) {
    return {
      source: 'geocode',
      title: 'Geocoding Rate Limit Reached',
      message: apiMessage || 'Too many requests were sent to the Geocoding API. Please wait a moment and try again.',
      statusCode,
      endpoint: GEOCODE_V4_BASE_URL,
      detail: apiStatus || 'RESOURCE_EXHAUSTED',
    };
  }

  return {
    source: 'geocode',
    title: 'Geocoding Service Error',
    message: apiMessage || 'Unable to resolve coordinates from the Google Geocoding V4 API.',
    statusCode,
    endpoint: GEOCODE_V4_BASE_URL,
    detail: apiStatus || 'UPSTREAM_ERROR',
  };
}
