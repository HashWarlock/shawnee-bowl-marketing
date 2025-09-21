import { AddressValidationInput, NormalizedResult } from '@shared/schema';

interface CacheEntry {
  result: NormalizedResult;
  timestamp: number;
  ttl: number;
}

// In-flight request tracking to prevent duplicate API calls
const inFlightRequests = new Map<string, Promise<NormalizedResult>>();

export class AddressCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Canonicalize address for consistent cache keys
   */
  private canonicalizeAddress(input: AddressValidationInput): string {
    const parts = [
      input.streetAddress?.trim().toUpperCase().replace(/\s+/g, ' '),
      input.secondaryAddress?.trim().toUpperCase().replace(/\s+/g, ' '),
      input.city?.trim().toUpperCase().replace(/\s+/g, ' '),
      input.state?.trim().toUpperCase(),
      input.ZIPCode?.trim().replace(/[^\d-]/g, ''), // Keep only digits and hyphens
    ].filter(Boolean);
    
    return parts.join('|');
  }

  /**
   * Get cached result if available and not expired
   */
  get(input: AddressValidationInput): NormalizedResult | null {
    const key = this.canonicalizeAddress(input);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // Return a copy to prevent mutation
    return {
      ...entry.result,
      // Update metadata to indicate this came from cache
      latencyMs: 0,
    };
  }

  /**
   * Store result in cache with appropriate TTL
   */
  set(input: AddressValidationInput, result: NormalizedResult, ttl: number): void {
    const key = this.canonicalizeAddress(input);
    
    // Evict oldest entries if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get or execute with in-flight deduplication
   */
  async getOrExecute(
    input: AddressValidationInput,
    executor: () => Promise<NormalizedResult>,
    positiveTtl: number,
    negativeTtl: number
  ): Promise<NormalizedResult> {
    // Check cache first
    const cached = this.get(input);
    if (cached) {
      return cached;
    }
    
    const key = this.canonicalizeAddress(input);
    
    // Check if request is already in flight
    const inFlight = inFlightRequests.get(key);
    if (inFlight) {
      return inFlight;
    }
    
    // Execute and cache result
    const promise = executor().then(result => {
      // Remove from in-flight tracking
      inFlightRequests.delete(key);
      
      // Cache the result
      const ttl = result.isValid ? positiveTtl : negativeTtl;
      this.set(input, result, ttl);
      
      return result;
    }).catch(error => {
      // Remove from in-flight tracking on error
      inFlightRequests.delete(key);
      throw error;
    });
    
    // Track in-flight request
    inFlightRequests.set(key, promise);
    
    return promise;
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; inFlightCount: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      inFlightCount: inFlightRequests.size,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    inFlightRequests.clear();
  }
}

// Singleton instance
export const addressCache = new AddressCache();

// Cleanup job every 10 minutes
setInterval(() => {
  addressCache.cleanup();
}, 10 * 60 * 1000);