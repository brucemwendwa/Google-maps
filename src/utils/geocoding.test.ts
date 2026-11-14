import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGeocodeV4Url,
  formatGeocodeError,
  parseGeocodeV4Response,
  PRESET_DESTINATIONS,
} from './geocoding';

test('PRESET_DESTINATIONS contains the exact five requested presets', () => {
  const labels = PRESET_DESTINATIONS.map((p) => p.label);
  assert.deepEqual(labels, ['Buenos Aires', 'Shibuya', 'Copacabana', 'Cologne', 'Lima']);
});

test('buildGeocodeV4Url properly encodes addresses for Geocoding V4 REST endpoint', () => {
  const url = buildGeocodeV4Url('Miami, Florida');
  assert.equal(
    url,
    'https://geocode.googleapis.com/v4/geocode/address/Miami%2C%20Florida?languageCode=en'
  );

  const slashUrl = buildGeocodeV4Url('7/1 King St #2');
  assert.ok(slashUrl.includes('7%2F1%20King%20St%20%232'));
});

test('buildGeocodeV4Url rejects empty queries', () => {
  assert.throws(() => buildGeocodeV4Url('   '), /Please enter a city/);
});

test('parseGeocodeV4Response extracts location, viewport, and City, State label', () => {
  const mockPayload = {
    results: [
      {
        placeId: 'ChIJEcHIDqKw2YgRZU-t3XHylv8',
        formattedAddress: 'Miami, FL, USA',
        granularity: 'APPROXIMATE',
        location: {
          latitude: 25.7616798,
          longitude: -80.1917902,
        },
        viewport: {
          low: { latitude: 25.709042, longitude: -80.31976 },
          high: { latitude: 25.855773, longitude: -80.139157 },
        },
        addressComponents: [
          { longText: 'Miami', shortText: 'Miami', types: ['locality', 'political'] },
          { longText: 'Florida', shortText: 'FL', types: ['administrative_area_level_1', 'political'] },
          { longText: 'United States', shortText: 'US', types: ['country', 'political'] },
        ],
      },
    ],
  };

  const parsed = parseGeocodeV4Response(mockPayload, 'Miami, Florida');
  assert.equal(parsed.cityStateLabel, 'Miami, Florida');
  assert.equal(parsed.location.lat, 25.7616798);
  assert.equal(parsed.location.lng, -80.1917902);
  assert.equal(parsed.placeId, 'ChIJEcHIDqKw2YgRZU-t3XHylv8');
  assert.ok(parsed.viewport);
  assert.equal(parsed.viewport.low.lat, 25.709042);
});

test('parseGeocodeV4Response avoids duplicate City, City when locality matches state', () => {
  const mockPayload = {
    results: [
      {
        placeId: 'ChIJ_city_state',
        formattedAddress: 'Buenos Aires, Argentina',
        location: { latitude: -34.6037, longitude: -58.3816 },
        addressComponents: [
          { longText: 'Buenos Aires', types: ['locality'] },
          { longText: 'Buenos Aires', types: ['administrative_area_level_1'] },
          { longText: 'Argentina', types: ['country'] },
        ],
      },
    ],
  };

  const parsed = parseGeocodeV4Response(mockPayload, 'Buenos Aires');
  assert.equal(parsed.cityStateLabel, 'Buenos Aires, Argentina');
});

test('parseGeocodeV4Response throws clear error when results are empty', () => {
  assert.throws(
    () => parseGeocodeV4Response({ results: [] }, 'NowherevilleXYZ'),
    /No geocoded location was found/
  );
});

test('formatGeocodeError formats 403 and 429 troubleshooting responses clearly', () => {
  const forbidden = formatGeocodeError(403, {
    error: { code: 403, message: 'API key restricted', status: 'PERMISSION_DENIED' },
  });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.title, 'Google Maps Authorization Error');
  assert.equal(forbidden.detail, 'PERMISSION_DENIED');

  const rateLimited = formatGeocodeError(429, {});
  assert.equal(rateLimited.statusCode, 429);
  assert.equal(rateLimited.title, 'Geocoding Rate Limit Reached');
});
