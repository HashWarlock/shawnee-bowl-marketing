import { AddressProvider, AddressValidationInput, IAddressValidator, NormalizedResult } from '@shared/schema';

// Google Address Validation API types
interface GoogleAddressValidationRequest {
  address: {
    addressLines: string[];
    administrativeArea?: string;
    locality?: string;
    postalCode?: string;
  };
  enableUspsCass?: boolean;
}

interface GoogleAddressValidationResponse {
  result: {
    verdict: {
      inputGranularity: string;
      validationGranularity: string;
      geocodeGranularity: string;
      addressComplete: boolean;
      hasUnconfirmedComponents: boolean;
      hasInferredComponents: boolean;
      hasReplacedComponents: boolean;
    };
    address: {
      formattedAddress: string;
      postalAddress: {
        addressLines: string[];
        administrativeArea: string;
        locality: string;
        postalCode: string;
        subAdministrativeArea?: string;
      };
      addressComponents: Array<{
        componentName: {
          text: string;
          languageCode: string;
        };
        componentType: string;
        confirmationLevel: string;
        inferred?: boolean;
        spellCorrected?: boolean;
        replaced?: boolean;
        unexpected?: boolean;
      }>;
    };
    uspsData?: {
      standardizedAddress: {
        firstAddressLine: string;
        secondAddressLine?: string;
        cityName: string;
        stateAbbreviation: string;
        zipCode: string;
        zipCodeExtension?: string;
      };
      deliveryPointCode: string;
      deliveryPointCheckDigit: string;
      dpvConfirmation: string;
      dpvFootnote: string;
      cmra: string;
      vacant: string;
      ews: string;
    };
  };
}

interface GoogleErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

export class GoogleService implements IAddressValidator {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://addressvalidation.googleapis.com/v1:validateAddress';
  private readonly isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.GOOGLE_CLOUD_API_KEY || '';
    this.isConfigured = !!this.apiKey;
    
    if (!this.isConfigured) {
      console.warn('Google Cloud API key not found in environment variables. Google address validation will be unavailable.');
    }
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }

  getProviderName(): AddressProvider {
    return AddressProvider.GOOGLE;
  }

  async validate(input: AddressValidationInput): Promise<NormalizedResult> {
    const startTime = Date.now();
    
    if (!this.isConfigured) {
      return {
        isValid: false,
        serviceUnavailable: true,
        errors: ['Google address validation is not configured.'],
        provider: AddressProvider.GOOGLE,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const requestBody = this.buildRequest(input);
      const result = await this.callGoogleAPI(requestBody);
      
      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      if (error instanceof Error) {
        // Check for quota exceeded or rate limiting
        if (error.message.includes('QUOTA_EXCEEDED') || error.message.includes('RATE_LIMIT_EXCEEDED')) {
          return {
            isValid: false,
            serviceUnavailable: true,
            errors: ['Google service quota exceeded. Please try again later.'],
            provider: AddressProvider.GOOGLE,
            latencyMs,
          };
        }
        
        // Check for authentication errors
        if (error.message.includes('UNAUTHENTICATED') || error.message.includes('401')) {
          return {
            isValid: false,
            serviceUnavailable: true,
            errors: ['Google authentication failed. Please check API key.'],
            provider: AddressProvider.GOOGLE,
            latencyMs,
          };
        }
      }
      
      console.error('Google address validation error:', error);
      return {
        isValid: false,
        errors: ['Address validation failed. Please try again.'],
        provider: AddressProvider.GOOGLE,
        latencyMs,
      };
    }
  }

  private buildRequest(input: AddressValidationInput): GoogleAddressValidationRequest {
    const addressLines = [input.streetAddress];
    if (input.secondaryAddress) {
      addressLines.push(input.secondaryAddress);
    }

    return {
      address: {
        addressLines,
        administrativeArea: input.state,
        locality: input.city,
        postalCode: input.ZIPCode,
      },
      enableUspsCass: true, // Enable USPS CASS validation for US addresses
    };
  }

  private async callGoogleAPI(requestBody: GoogleAddressValidationRequest): Promise<GoogleAddressValidationResponse> {
    const url = `${this.baseUrl}?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `Google API error: ${response.status}`;
      
      try {
        const errorData: GoogleErrorResponse = await response.json();
        errorMessage = errorData.error.message || errorMessage;
        
        if (errorData.error.status === 'QUOTA_EXCEEDED') {
          throw new Error('QUOTA_EXCEEDED');
        }
        if (errorData.error.status === 'UNAUTHENTICATED') {
          throw new Error('UNAUTHENTICATED');
        }
      } catch (parseError) {
        // If we can't parse error response, use generic message
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  private mapResponse(response: GoogleAddressValidationResponse, latencyMs: number): NormalizedResult {
    const { result } = response;
    const { verdict, address, uspsData } = result;
    
    // Determine validity based on Google's verdict and USPS data
    const isAddressComplete = verdict.addressComplete;
    const hasUnconfirmedComponents = verdict.hasUnconfirmedComponents;
    const uspsValid = uspsData?.dpvConfirmation === 'Y';
    const isVacant = uspsData?.vacant === 'Y';
    
    // Address is valid if it's complete and either confirmed by USPS or has no unconfirmed components
    const isValid = isAddressComplete && (uspsValid || !hasUnconfirmedComponents) && !isVacant;

    // Build standardized address - prefer USPS data if available
    const standardizedAddress = uspsData ? {
      streetAddress: uspsData.standardizedAddress.firstAddressLine,
      secondaryAddress: uspsData.standardizedAddress.secondAddressLine,
      city: uspsData.standardizedAddress.cityName,
      state: uspsData.standardizedAddress.stateAbbreviation,
      ZIPCode: uspsData.standardizedAddress.zipCode,
      ZIPPlus4: uspsData.standardizedAddress.zipCodeExtension ? 
        `${uspsData.standardizedAddress.zipCode}-${uspsData.standardizedAddress.zipCodeExtension}` :
        uspsData.standardizedAddress.zipCode,
    } : {
      streetAddress: address.postalAddress.addressLines[0],
      secondaryAddress: address.postalAddress.addressLines[1],
      city: address.postalAddress.locality,
      state: address.postalAddress.administrativeArea,
      ZIPCode: address.postalAddress.postalCode,
    };

    // Generate suggestions based on Google's analysis
    const suggestions: string[] = [];
    
    if (verdict.hasReplacedComponents) {
      suggestions.push('Some address components were corrected');
    }
    if (verdict.hasInferredComponents) {
      suggestions.push('Some address components were inferred');
    }
    if (uspsData?.dpvConfirmation === 'Y') {
      suggestions.push('Address validated by USPS');
    }
    if (uspsData?.standardizedAddress.zipCodeExtension) {
      suggestions.push('ZIP+4 code available for better delivery');
    }

    // Generate errors/warnings
    const errors: string[] = [];
    
    if (isVacant) {
      errors.push('This address appears to be vacant.');
    }
    
    if (hasUnconfirmedComponents) {
      const unconfirmedComponents = address.addressComponents
        .filter(component => component.confirmationLevel === 'UNCONFIRMED_BUT_PLAUSIBLE')
        .map(component => component.componentType);
      
      if (unconfirmedComponents.length > 0) {
        errors.push(`Unconfirmed address components: ${unconfirmedComponents.join(', ')}`);
      }
    }
    
    if (uspsData?.dpvConfirmation === 'N') {
      errors.push('Address not deliverable according to USPS');
    }

    // Calculate confidence score
    let confidence = 0;
    if (isAddressComplete) confidence += 40;
    if (uspsValid) confidence += 30;
    if (!hasUnconfirmedComponents) confidence += 20;
    if (uspsData?.standardizedAddress.zipCodeExtension) confidence += 10;

    return {
      isValid: isValid,
      standardizedAddress: isValid ? standardizedAddress : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      errors: errors.length > 0 ? errors : undefined,
      provider: AddressProvider.GOOGLE,
      latencyMs,
      confidence,
    };
  }
}