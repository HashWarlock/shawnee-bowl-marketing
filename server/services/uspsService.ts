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

export class USPSService {
  private static instance: USPSService;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = 'https://api.usps.com';
  private readonly isEnabled: boolean;

  private constructor() {
    this.clientId = process.env.USPS_CLIENT_ID || '';
    this.clientSecret = process.env.USPS_CLIENT_SECRET || '';
    this.isEnabled = !!(this.clientId && this.clientSecret);
    
    if (!this.isEnabled) {
      console.warn('USPS API credentials not found in environment variables. Address validation will be unavailable.');
    }
  }

  static getInstance(): USPSService {
    if (!USPSService.instance) {
      USPSService.instance = new USPSService();
    }
    return USPSService.instance;
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      console.log('Using cached USPS access token');
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
        throw new Error(`USPS OAuth failed: ${response.status} ${errorText}`);
      }

      const data: USPSAuthResponse = await response.json();
      console.log('USPS OAuth success, token received');
      
      this.accessToken = data.access_token;
      
      // Set expiry to 5 minutes before actual expiry for safety
      const expirySeconds = parseInt(data.expires_in) - 300;
      this.tokenExpiry = new Date(Date.now() + expirySeconds * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('USPS OAuth error:', error);
      throw new Error('Failed to obtain USPS access token');
    }
  }

  async validateAddress(address: USPSAddressRequest): Promise<{
    isValid: boolean;
    standardizedAddress?: USPSAddressResponse['address'];
    suggestions?: string[];
    errors?: string[];
    serviceUnavailable?: boolean;
  }> {
    // Check if service is enabled
    if (!this.isEnabled) {
      return {
        isValid: false,
        serviceUnavailable: true,
        errors: ['USPS address validation is not configured. You may save the customer with a warning.'],
      };
    }

    try {
      const token = await this.getAccessToken();
      
      // Build query parameters
      const params = new URLSearchParams({
        streetAddress: address.streetAddress,
        state: address.state,
      });
      
      if (address.city) {
        params.append('city', address.city);
      }
      if (address.ZIPCode) {
        params.append('ZIPCode', address.ZIPCode);
      }
      if (address.secondaryAddress) {
        params.append('secondaryAddress', address.secondaryAddress);
      }

      const response = await fetch(`${this.baseUrl}/addresses/v3/address?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData: USPSErrorResponse = await response.json().catch(() => ({}));
        
        // Handle specific USPS error responses
        if (response.status === 404) {
          return {
            isValid: false,
            errors: ['Address not found. Please verify the address and try again.'],
          };
        }
        
        if (response.status === 400) {
          const errorMessages = this.extractErrorMessages(errorData);
          return {
            isValid: false,
            errors: errorMessages.length > 0 ? errorMessages : ['Invalid address format. Please check your input.'],
          };
        }

        throw new Error(`USPS API error: ${response.status}`);
      }

      const data: USPSAddressResponse = await response.json();
      
      // Extract suggestions from corrections and matches
      const suggestions: string[] = [];
      if (data.corrections) {
        suggestions.push(...data.corrections.map(c => c.text));
      }
      if (data.matches) {
        suggestions.push(...data.matches.map(m => m.text));
      }
      if (data.warnings) {
        suggestions.push(...data.warnings);
      }

      // Check if the address is deliverable
      const isDeliverable = data.additionalInfo?.DPVConfirmation === 'Y';
      const isVacant = data.additionalInfo?.vacant === 'Y';
      
      return {
        isValid: isDeliverable && !isVacant,
        standardizedAddress: data.address,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        errors: isVacant ? ['This address appears to be vacant.'] : undefined,
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
      };
    }
  }

  private extractErrorMessages(errorData: USPSErrorResponse): string[] {
    const messages: string[] = [];
    
    if (errorData.error?.message) {
      messages.push(errorData.error.message);
    }
    
    if (errorData.error?.errors) {
      messages.push(...errorData.error.errors.map(e => e.message || e.detail || 'Unknown error'));
    }
    
    if (errorData.errors) {
      messages.push(...errorData.errors.map(e => e.message || e.detail || 'Unknown error'));
    }
    
    return messages;
  }
}

export const uspsService = USPSService.getInstance();