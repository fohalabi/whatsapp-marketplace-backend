// src/utils/deliveryFee.utils.ts

interface Location {
  latitude: number;
  longitude: number;
}

type Zone = 'MAINLAND' | 'ISLAND';

interface DeliveryFeeConfig {
  MAINLAND_TO_ISLAND: number;
  ISLAND_TO_MAINLAND: number;
  MAINLAND_TO_MAINLAND: number;
  ISLAND_TO_ISLAND: number;
}

// Lagos zones - simplified boundary
// Island: VI, Lekki, Ikoyi, Ajah (generally east of Third Mainland Bridge)
// Mainland: Ikeja, Yaba, Surulere, etc.
const LAGOS_ISLAND_BOUNDS = {
  minLat: 6.42, // approximate southern boundary (near Ikoyi/VI)
  maxLat: 6.50, // approximate northern boundary (near Lekki/Ajah)
  minLng: 3.38, // approximate western boundary (near Third Mainland Bridge)
  maxLng: 3.70 // approximate eastern boundary (near Ajah/Epe axis)
};

// Default delivery fees (in Naira)
const DELIVERY_FEES: DeliveryFeeConfig = {
  MAINLAND_TO_ISLAND: 2500,
  ISLAND_TO_MAINLAND: 2500,
  MAINLAND_TO_MAINLAND: 1500,
  ISLAND_TO_ISLAND: 1500
};

/**
 * Determine if location is on Lagos Island or Mainland
 */
export function getZone(location: Location): Zone {
  const { latitude, longitude } = location;

  // Simple boundary check for Lagos Island
  const isIsland = 
    latitude >= LAGOS_ISLAND_BOUNDS.minLat &&
    latitude <= LAGOS_ISLAND_BOUNDS.maxLat &&
    longitude >= LAGOS_ISLAND_BOUNDS.minLng &&
    longitude <= LAGOS_ISLAND_BOUNDS.maxLng;

  return isIsland ? 'ISLAND' : 'MAINLAND';
}

/**
 * Calculate delivery fee based on pickup and delivery zones
 */
export function calculateDeliveryFee(
  pickupLocation: Location,
  deliveryLocation: Location
): number {
  const pickupZone = getZone(pickupLocation);
  const deliveryZone = getZone(deliveryLocation);

  if (pickupZone === 'MAINLAND' && deliveryZone === 'ISLAND') {
    return DELIVERY_FEES.MAINLAND_TO_ISLAND;
  }

  if (pickupZone === 'ISLAND' && deliveryZone === 'MAINLAND') {
    return DELIVERY_FEES.ISLAND_TO_MAINLAND;
  }

  if (pickupZone === 'MAINLAND' && deliveryZone === 'MAINLAND') {
    return DELIVERY_FEES.MAINLAND_TO_MAINLAND;
  }

  if (pickupZone === 'ISLAND' && deliveryZone === 'ISLAND') {
    return DELIVERY_FEES.ISLAND_TO_ISLAND;
  }

  // Fallback
  return DELIVERY_FEES.MAINLAND_TO_MAINLAND;
}

/**
 * Get delivery fee description
 */
export function getDeliveryFeeDescription(
  pickupLocation: Location,
  deliveryLocation: Location
): string {
  const pickupZone = getZone(pickupLocation);
  const deliveryZone = getZone(deliveryLocation);

  return `${pickupZone} → ${deliveryZone}`;
}