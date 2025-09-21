import { AddressProvider, AddressValidationInput, IAddressValidator, NormalizedResult } from '@shared/schema';
import { SmartyService } from './providers/smartyService';
import { GoogleService } from './providers/googleService';
import { USPSService } from './uspsService';
import { addressCache } from './addressCache';
import { getAddressConfig } from './addressConfig';

// Circuit breaker for provider health tracking
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number,
    private resetTimeoutMs: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }
}

export class AddressOrchestrator {
  private providers: Map<AddressProvider, IAddressValidator> = new Map();
  private circuitBreakers: Map<AddressProvider, CircuitBreaker> = new Map();
  private config = getAddressConfig();

  constructor() {
    this.initializeProviders();
    this.initializeCircuitBreakers();
  }

  private initializeProviders(): void {
    // Initialize all providers
    this.providers.set(AddressProvider.SMARTY, new SmartyService());
    this.providers.set(AddressProvider.GOOGLE, new GoogleService());
    this.providers.set(AddressProvider.USPS, USPSService.getInstance());
  }

  private initializeCircuitBreakers(): void {
    const { failureThreshold, resetTimeoutMs } = this.config.circuitBreaker;
    
    for (const provider of Object.values(AddressProvider)) {
      this.circuitBreakers.set(
        provider,
        new CircuitBreaker(failureThreshold, resetTimeoutMs)
      );
    }
  }

  async validateAddress(
    input: AddressValidationInput,
    options?: {
      preferredProvider?: AddressProvider;
      mode?: 'waterfall' | 'hedged';
    }
  ): Promise<NormalizedResult> {
    const { preferredProvider, mode = this.config.mode } = options || {};
    
    // Get provider order
    const providerOrder = this.getProviderOrder(preferredProvider);
    
    // Check cache first
    const cacheResult = await addressCache.getOrExecute(
      input,
      () => this.executeValidation(input, providerOrder, mode),
      this.config.cacheTtlMs,
      this.config.negativeCacheTtlMs
    );

    return cacheResult;
  }

  private getProviderOrder(preferredProvider?: AddressProvider): AddressProvider[] {
    if (preferredProvider) {
      // Put preferred provider first, then follow configured order
      const order = [preferredProvider];
      this.config.order.forEach(provider => {
        if (provider !== preferredProvider) {
          order.push(provider);
        }
      });
      return order;
    }
    
    return [...this.config.order];
  }

  private async executeValidation(
    input: AddressValidationInput,
    providerOrder: AddressProvider[],
    mode: 'waterfall' | 'hedged'
  ): Promise<NormalizedResult> {
    if (mode === 'hedged') {
      return this.executeHedgedValidation(input, providerOrder);
    } else {
      return this.executeWaterfallValidation(input, providerOrder);
    }
  }

  private async executeWaterfallValidation(
    input: AddressValidationInput,
    providerOrder: AddressProvider[]
  ): Promise<NormalizedResult> {
    const errors: string[] = [];
    const triedProviders: AddressProvider[] = [];

    for (const providerType of providerOrder) {
      const provider = this.providers.get(providerType);
      if (!provider || !provider.isEnabled()) {
        continue;
      }

      const circuitBreaker = this.circuitBreakers.get(providerType)!;
      triedProviders.push(providerType);

      try {
        const result = await circuitBreaker.execute(async () => {
          return this.executeWithTimeout(provider, input);
        });

        // If we got a valid result, return it
        if (result.isValid) {
          return {
            ...result,
            didFallback: triedProviders.length > 1,
          };
        }

        // If service is unavailable, try next provider
        if (result.serviceUnavailable) {
          errors.push(`${providerType}: ${result.errors?.[0] || 'Service unavailable'}`);
          continue;
        }

        // If address is invalid (not service unavailable), return the result
        return {
          ...result,
          didFallback: triedProviders.length > 1,
        };

      } catch (error) {
        console.error(`Provider ${providerType} failed:`, error);
        errors.push(`${providerType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }

    // If we reach here, all providers failed or are unavailable
    return {
      isValid: false,
      serviceUnavailable: true,
      errors: [`All address validation services are unavailable: ${errors.join(', ')}`],
      provider: triedProviders[0] || AddressProvider.SMARTY, // Default to first attempted
      latencyMs: 0,
      didFallback: true,
    };
  }

  private async executeHedgedValidation(
    input: AddressValidationInput,
    providerOrder: AddressProvider[]
  ): Promise<NormalizedResult> {
    const enabledProviders = providerOrder.filter(providerType => {
      const provider = this.providers.get(providerType);
      return provider && provider.isEnabled();
    });

    if (enabledProviders.length === 0) {
      return {
        isValid: false,
        serviceUnavailable: true,
        errors: ['No address validation providers are configured'],
        provider: AddressProvider.SMARTY,
        latencyMs: 0,
      };
    }

    // Start with the first provider
    const promises: Promise<NormalizedResult>[] = [];
    
    for (let i = 0; i < enabledProviders.length; i++) {
      const providerType = enabledProviders[i];
      const provider = this.providers.get(providerType)!;
      const circuitBreaker = this.circuitBreakers.get(providerType)!;

      // Start each provider with a delay (except the first one)
      const delay = i * this.config.hedgeDelayMs;
      
      const promise = new Promise<NormalizedResult>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await circuitBreaker.execute(async () => {
              return this.executeWithTimeout(provider, input);
            });
            resolve(result);
          } catch (error) {
            // Don't resolve on error, let other providers compete
          }
        }, delay);
      });

      promises.push(promise);
    }

    // Return the first valid result
    return Promise.race(promises);
  }

  private async executeWithTimeout(
    provider: IAddressValidator,
    input: AddressValidationInput
  ): Promise<NormalizedResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Provider ${provider.getProviderName()} timed out`));
      }, this.config.perProviderTimeoutMs);

      provider.validate(input)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // Health check methods
  getProviderHealth(): Record<AddressProvider, { enabled: boolean; circuitState: string }> {
    const health: Record<string, { enabled: boolean; circuitState: string }> = {};
    
    this.providers.forEach((provider, providerType) => {
      const circuitBreaker = this.circuitBreakers.get(providerType)!;
      health[providerType] = {
        enabled: provider.isEnabled(),
        circuitState: circuitBreaker.getState(),
      };
    });
    
    return health as Record<AddressProvider, { enabled: boolean; circuitState: string }>;
  }

  getCacheStats() {
    return addressCache.getStats();
  }
}

// Singleton instance
export const addressOrchestrator = new AddressOrchestrator();