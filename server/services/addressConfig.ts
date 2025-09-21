import { AddressProvider } from '@shared/schema';

export interface AddressValidationConfig {
  // Provider priority order (first = preferred)
  order: AddressProvider[];
  
  // Validation mode
  mode: 'waterfall' | 'hedged';
  
  // Timeout per provider in milliseconds
  perProviderTimeoutMs: number;
  
  // Delay before starting next provider in hedged mode
  hedgeDelayMs: number;
  
  // Cache TTL in milliseconds (7 days)
  cacheTtlMs: number;
  
  // Cache TTL for negative results (1 hour)
  negativeCacheTtlMs: number;
  
  // Circuit breaker settings
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
  };
}

export const defaultAddressConfig: AddressValidationConfig = {
  // Prefer Smarty for US addresses, fallback to Google, then USPS
  order: [AddressProvider.SMARTY, AddressProvider.GOOGLE, AddressProvider.USPS],
  
  // Use waterfall mode by default (try providers in sequence)
  mode: 'waterfall',
  
  // 2 second timeout per provider
  perProviderTimeoutMs: 2000,
  
  // In hedged mode, start next provider after 250ms
  hedgeDelayMs: 250,
  
  // Cache positive results for 7 days
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  
  // Cache negative results for 1 hour
  negativeCacheTtlMs: 60 * 60 * 1000,
  
  // Circuit breaker: open after 5 failures, reset after 30 seconds
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30 * 1000,
  },
};

// Environment-based configuration overrides
export function getAddressConfig(): AddressValidationConfig {
  const config = { ...defaultAddressConfig };
  
  // Override provider order based on environment
  if (process.env.ADDRESS_VALIDATION_ORDER) {
    const order = process.env.ADDRESS_VALIDATION_ORDER.split(',') as AddressProvider[];
    config.order = order.filter(provider => Object.values(AddressProvider).includes(provider));
  }
  
  // Override mode based on environment
  if (process.env.ADDRESS_VALIDATION_MODE === 'hedged') {
    config.mode = 'hedged';
  }
  
  // Override timeout
  if (process.env.ADDRESS_VALIDATION_TIMEOUT_MS) {
    const timeout = parseInt(process.env.ADDRESS_VALIDATION_TIMEOUT_MS, 10);
    if (!isNaN(timeout) && timeout > 0) {
      config.perProviderTimeoutMs = timeout;
    }
  }
  
  return config;
}