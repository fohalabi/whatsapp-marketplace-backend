import axios from 'axios';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/**
 * Geocode address to coordinates using Google Maps API
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY not set, using fallback location');
      return null;
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: `${address}, Lagos, Nigeria`, // Force Lagos context
        key: apiKey,
      },
    });

    if (response.data.status !== 'OK' || response.data.results.length === 0) {
      console.warn('⚠️ Geocoding failed:', response.data.status);
      return null;
    }

    const result = response.data.results[0];
    const location = result.geometry.location;

    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
    };
  } catch (error: any) {
    console.error('❌ Geocoding error:', error.message);
    return null;
  }
}

/**
 * Fallback location (Lagos center)
 */
export const FALLBACK_LOCATION = {
  latitude: 6.5355,
  longitude: 3.3087,
};