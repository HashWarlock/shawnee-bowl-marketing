import { AddressProvider, AddressValidationInput, IAddressValidator, NormalizedResult } from '@shared/schema';

interface USPSAuthResponse {
  access_token: string;
  token_type: string;
  issued_at: string;
  expires_in: string;
  status: string;
  scope: string;
  issuer: string;
}

interface USPSAddressRequest {
  streetAddress: string;
  city?: string;
  state: string;
  ZIPCode?: string;
  secondaryAddress?: string;
}

interface USPSAddressResponse {
  firm?: string;
  address: {
    streetAddress: string;
    streetAddressAbbreviation?: string;
    secondaryAddress?: string;
    cityAbbreviation?: string;
    city: string;
    state: string;
    ZIPCode: string;
    ZIPPlus4?: string;
    urbanization?: string;
  };
  additionalInfo?: {
    deliveryPoint?: string;
    carrierRoute?: string;
    DPVConfirmation?: string;
    DPVCMRA?: string;
    business?: string;
    centralDeliveryPoint?: string;
    vacant?: string;
  };
  corrections?: Array<{
    code: string;
    text: string;
  }>;
  matches?: Array<{
    code: string;
    text: string;
  }>;
  warnings?: string[];
}

interface USPSErrorResponse {
  error?: {
    code: string;
    message: string;
    errors?: Array<{
      code: string;
      message: string;
      detail?: string;
    }>;
  };
  errors?: Array<{
    code: string;
    message: string;
    detail?: string;
  }>;
}

export class USPSService implements IAddressValidator {
  private static instance: USPSService;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = 'https://api.usps.com';
  private readonly serviceEnabled: boolean;

  private constructor() {
    this.clientId = process.env.USPS_CLIENT_ID || '';
    this.clientSecret = process.env.USPS_CLIENT_SECRET || '';
    this.serviceEnabled = !!(this.clientId && this.clientSecret);
    
    if (!this.serviceEnabled) {
      console.warn('USPS API credentials not found in environment variables. Address validation will be unavailable.');
    }
  }

  static getInstance(): USPSService {
    if (!USPSService.instance) {
      USPSService.instance = new USPSService();
    }
    return USPSService.instance;
  }

  isEnabled(): boolean {
    return this.serviceEnabled;
  }

  getProviderName(): AddressProvider {
    return AddressProvider.USPS;
  }

  async validate(input: AddressValidationInput): Promise<NormalizedResult> {
    const startTime = Date.now();
    
    // Convert from shared interface to USPS format
    const address: USPSAddressRequest = {
      streetAddress: input.streetAddress,
      secondaryAddress: input.secondaryAddress,
      city: input.city,
      state: input.state,
      ZIPCode: input.ZIPCode,
    };

    return this.validateAddress(address, startTime);
  }

  private async validateAddress(address: USPSAddressRequest, startTime: number): Promise<NormalizedResult> {
    // Check if service is enabled
    if (!this.serviceEnabled) {
      return {
        isValid: false,
        serviceUnavailable: true,
        errors: ['USPS address validation is not configured. You may save the customer with a warning.'],
        provider: AddressProvider.USPS,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const token = await this.getAccessToken();
      
      // Build query parameters
      const params = new URLSearchParams({
        streetAddress: address.streetAddress,
        state: address.state,
      });
      
      if (address.secondaryAddress) {
        params.set('secondaryAddress', address.secondaryAddress);
      }
      if (address.city) {
        params.set('city', address.city);
      }
      if (address.ZIPCode) {
        params.set('ZIPCode', address.ZIPCode);
      }

      console.log('USPS address validation request:', params.toString());
      
      const response = await fetch(`${this.baseUrl}/addresses/v3/address?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      console.log('USPS address validation response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 404) {
          return {
            isValid: false,
            errors: ['Address not found. Please check the address and try again.'],
            provider: AddressProvider.USPS,
            latencyMs: Date.now() - startTime,
          };
        }
        
        const errorText = await response.text();
        console.error('USPS address validation error response:', errorText);
        
        return {
          isValid: false,
          errors: ['Address validation failed. Please check the address and try again.'],
          provider: AddressProvider.USPS,
          latencyMs: Date.now() - startTime,
        };
      }
      
      const result: USPSAddressResponse = await response.json();
      console.log('USPS address validation result:', JSON.stringify(result, null, 2));
      
      // Check delivery point validation
      const dpvConfirmation = result.additionalInfo?.DPVConfirmation;
      const isVacant = result.additionalInfo?.vacant === 'Y';
      const isValid = dpvConfirmation === 'Y' && !isVacant;
      
      // Build standardized address
      const standardizedAddr = result.address;
      
      // Extract suggestions from corrections and matches
      const suggestions: string[] = [];
      
      if (result.corrections?.length) {
        result.corrections.forEach(correction => {
          suggestions.push(`Correction: ${correction.text}`);
        });
      }
      
      if (result.matches?.length) {
        result.matches.forEach(match => {
          suggestions.push(`Match: ${match.text}`);
        });
      }
      
      if (result.warnings?.length) {
        suggestions.push(...result.warnings);
      }

      const latencyMs = Date.now() - startTime;
      
      return {
        isValid,
        standardizedAddress: {
          streetAddress: standardizedAddr.streetAddress,
          city: standardizedAddr.city,
          state: standardizedAddr.state,
          ZIPCode: standardizedAddr.ZIPCode,
          ZIPPlus4: standardizedAddr.ZIPPlus4,
          secondaryAddress: standardizedAddr.secondaryAddress,
        },
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        errors: isVacant ? ['This address appears to be vacant.'] : undefined,
        provider: AddressProvider.USPS,
        latencyMs,
        confidence: isVacant ? 60 : 80, // Lower confidence for vacant addresses
      };

    } catch (error) {
      console.error('USPS address validation error:', error);
      
      // Check if this is an authentication/service unavailable error
      const isServiceUnavailable = error instanceof Error && 
        (error.message.includes('Failed to obtain USPS access token') ||
         error.message.includes('USPS OAuth failed'));
      
      return {
        isValid: false,
        serviceUnavailable: isServiceUnavailable,
        errors: isServiceUnavailable 
          ? ['USPS address validation service is temporarily unavailable. You may save the customer with a warning.']
          : ['Address validation failed. Please check the address and try again.'],
        provider: AddressProvider.USPS,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    console.log('Requesting new USPS access token...');
    
    try {
      // USPS requires application/x-www-form-urlencoded format, not JSON
      const formData = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });
      
      console.log('USPS OAuth request to:', `${this.baseUrl}/oauth2/v3/token`);
      console.log('USPS Client ID:', this.clientId?.substring(0, 8) + '...');
      
      const response = await fetch(`${this.baseUrl}/oauth2/v3/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      console.log('USPS OAuth response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('USPS OAuth error response:', errorText);
        throw new Error(`USPS OAuth failed: ${response.status} - ${errorText}`);
      }
      
      const authData: USPSAuthResponse = await response.json();
      console.log('USPS OAuth success, token expires in:', authData.expires_in);
      
      this.accessToken = authData.access_token;
      // Set expiry to 90% of the actual expiry time for safety buffer
      const expiresInMs = parseInt(authData.expires_in) * 1000 * 0.9;
      this.tokenExpiry = new Date(Date.now() + expiresInMs);
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to obtain USPS access token:', error);
      throw new Error('Failed to obtain USPS access token');
    }
  }

  private extractErrorMessages(errorData: USPSErrorResponse): string[] {
    const messages: string[] = [];
    
    if (errorData.error?.message) {
      messages.push(errorData.error.message);
    }
    
    if (errorData.error?.errors) {
      errorData.error.errors.forEach(err => {
        messages.push(err.message);
      });
    }
    
    if (errorData.errors) {
      errorData.errors.forEach(err => {
        messages.push(err.message);
      });
    }
    
    return messages.length > 0 ? messages : ['Unknown error occurred'];
  }
}

// Export singleton instance for backward compatibility
export const uspsService = USPSService.getInstance();