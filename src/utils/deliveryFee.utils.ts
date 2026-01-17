import { getRedis } from '../config/redis';
import prisma from '../config/database';

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

const LAGOS_ISLAND_BOUNDS = {
  minLat: 6.42, // approximate southern boundary (near Ikoyi/VI)
  maxLat: 6.50, // approximate northern boundary (near Lekki/Ajah)
  minLng: 3.38, // approximate western boundary (near Third Mainland Bridge)
  maxLng: 3.70 // approximate eastern boundary (near Ajah/Epe axis)
};

// Fallback delivery fees (used if config unavailable)
const FALLBACK_FEES: DeliveryFeeConfig = {
  MAINLAND_TO_ISLAND: 2500,
  ISLAND_TO_MAINLAND: 2500,
  MAINLAND_TO_MAINLAND: 1500,
  ISLAND_TO_ISLAND: 1500
};

const REDIS_CONFIG_KEY = 'platform:config';

/**
 * Get delivery fees from Redis cache or database
 */
async function getDeliveryFees(): Promise<DeliveryFeeConfig> {
  try {
    const redis = getRedis();

    // Try Redis cache first
    const cached = await redis.get(REDIS_CONFIG_KEY);
    if (cached) {
      const config = JSON.parse(cached);
      return {
        MAINLAND_TO_ISLAND: config.mainlandToIsland,
        ISLAND_TO_MAINLAND: config.islandToMainland,
        MAINLAND_TO_MAINLAND: config.mainlandToMainland,
        ISLAND_TO_ISLAND: config.islandToIsland
      };
    }

    // Fallback to database
    const config = await prisma.platformConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    });

    if (config) {
      // Cache for next time (7 days)
      await redis.setex(REDIS_CONFIG_KEY, 7 * 24 * 60 * 60, JSON.stringify(config));

      return {
        MAINLAND_TO_ISLAND: config.mainlandToIsland,
        ISLAND_TO_MAINLAND: config.islandToMainland,
        MAINLAND_TO_MAINLAND: config.mainlandToMainland,
        ISLAND_TO_ISLAND: config.islandToIsland
      };
    }

    // Final fallback to hardcoded values
    console.warn('⚠️ No platform config found, using fallback fees');
    return FALLBACK_FEES;

  } catch (error) {
    console.error('❌ Error fetching delivery fees:', error);
    return FALLBACK_FEES;
  }
}

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
export async function calculateDeliveryFee(
  pickupLocation: Location,
  deliveryLocation: Location
): Promise<number> {
  const pickupZone = getZone(pickupLocation);
  const deliveryZone = getZone(deliveryLocation);

  // Fetch current fees from config
  const fees = await getDeliveryFees();

  if (pickupZone === 'MAINLAND' && deliveryZone === 'ISLAND') {
    return fees.MAINLAND_TO_ISLAND;
  }

  if (pickupZone === 'ISLAND' && deliveryZone === 'MAINLAND') {
    return fees.ISLAND_TO_MAINLAND;
  }

  if (pickupZone === 'MAINLAND' && deliveryZone === 'MAINLAND') {
    return fees.MAINLAND_TO_MAINLAND;
  }

  if (pickupZone === 'ISLAND' && deliveryZone === 'ISLAND') {
    return fees.ISLAND_TO_ISLAND;
  }

  // Fallback
  return fees.MAINLAND_TO_MAINLAND;
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