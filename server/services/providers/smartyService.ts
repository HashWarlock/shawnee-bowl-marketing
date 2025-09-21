import { AddressProvider, AddressValidationInput, IAddressValidator, NormalizedResult } from '@shared/schema';

// Smarty API types
interface SmartyStreetLookup {
  street: string;
  city?: string;
  state: string;
  zipcode?: string;
  secondary?: string;
}

interface SmartyStreetResponse {
  input_index: number;
  candidate_index: number;
  addressee?: string;
  delivery_line_1: string;
  delivery_line_2?: string;
  last_line: string;
  delivery_point_barcode: string;
  components: {
    primary_number: string;
    street_name: string;
    street_suffix?: string;
    street_predirection?: string;
    street_postdirection?: string;
    secondary_number?: string;
    secondary_designator?: string;
    extra_secondary_number?: string;
    extra_secondary_designator?: string;
    pmb_designator?: string;
    pmb_number?: string;
    city_name: string;
    default_city_name: string;
    state_abbreviation: string;
    zipcode: string;
    plus4_code: string;
  };
  metadata: {
    record_type: string;
    zip_type: string;
    county_fips: string;
    county_name: string;
    carrier_route: string;
    congressional_district: string;
    building_default_indicator?: string;
    rdi: string;
    elot_sequence: string;
    elot_sort: string;
    utc_offset: number;
    dst: boolean;
    ews_match?: boolean;
  };
  analysis: {
    dpv_match_y?: boolean;
    dpv_match_n?: boolean;
    dpv_match_s?: boolean;
    dpv_match_d?: boolean;
    dpv_match_code?: string; // Could be "Y", "N", "S", "D"
    dpv_vacancy?: string;
    dpv_cmra?: string;
    dpv_footnotes?: string;
    ews_match?: boolean;
    footnotes?: string;
    lacslink_code?: string;
    lacslink_indicator?: string;
    suitelink_match?: boolean;
  };
}

interface SmartyErrorResponse {
  error: string;
  message: string;
}

export class SmartyService implements IAddressValidator {
  private readonly authId: string;
  private readonly authToken: string;
  private readonly baseUrl = 'https://us-street.api.smarty.com/street-address';
  private readonly isConfigured: boolean;

  constructor() {
    this.authId = process.env.SMARTY_AUTH_ID || '';
    this.authToken = process.env.SMARTY_AUTH_TOKEN || '';
    this.isConfigured = !!(this.authId && this.authToken);
    
    if (!this.isConfigured) {
      console.warn('Smarty credentials not found in environment variables. Smarty address validation will be unavailable.');
    }
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }

  getProviderName(): AddressProvider {
    return AddressProvider.SMARTY;
  }

  async validate(input: AddressValidationInput): Promise<NormalizedResult> {
    const startTime = Date.now();
    
    if (!this.isConfigured) {
      return {
        isValid: false,
        serviceUnavailable: true,
        errors: ['Smarty address validation is not configured.'],
        provider: AddressProvider.SMARTY,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const lookup = this.buildLookup(input);
      const result = await this.callSmartyAPI([lookup]);
      
      const latencyMs = Date.now() - startTime;
      
      // Log response size for debugging (avoid logging PII)
      console.log('Smarty API response received, candidate count:', result?.length || 0);
      
      if (!result || result.length === 0) {
        return {
          isValid: false,
          errors: ['Address not found or invalid.'],
          suggestions: ['Please check the address and try again.'],
          provider: AddressProvider.SMARTY,
          latencyMs,
        };
      }

      const candidate = result[0];
      // Process candidate (logging removed to prevent PII exposure)
      return this.mapResponse(candidate, latencyMs);
      
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      if (error instanceof Error) {
        // Check for rate limiting or service unavailable
        if (error.message.includes('429') || error.message.includes('quota') || 
            error.message.includes('rate limit')) {
          return {
            isValid: false,
            serviceUnavailable: true,
            errors: ['Smarty service rate limit reached. Please try again later.'],
            provider: AddressProvider.SMARTY,
            latencyMs,
          };
        }
        
        // Check for authentication errors
        if (error.message.includes('401') || error.message.includes('403')) {
          return {
            isValid: false,
            serviceUnavailable: true,
            errors: ['Smarty authentication failed. Please check API credentials.'],
            provider: AddressProvider.SMARTY,
            latencyMs,
          };
        }
      }
      
      console.error('Smarty address validation error:', error);
      return {
        isValid: false,
        errors: ['Address validation failed. Please try again.'],
        provider: AddressProvider.SMARTY,
        latencyMs,
      };
    }
  }

  private buildLookup(input: AddressValidationInput): SmartyStreetLookup {
    return {
      street: input.streetAddress,
      city: input.city,
      state: input.state,
      zipcode: input.ZIPCode,
      secondary: input.secondaryAddress,
    };
  }

  private async callSmartyAPI(lookups: SmartyStreetLookup[]): Promise<SmartyStreetResponse[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('auth-id', this.authId);
    url.searchParams.set('auth-token', this.authToken);
    url.searchParams.set('match', 'strict'); // Only return valid addresses
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lookups),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Smarty rate limit exceeded');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('Smarty authentication failed');
      }
      
      let errorMessage = `Smarty API error: ${response.status}`;
      try {
        const errorData: SmartyErrorResponse = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If we can't parse error response, use generic message
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  private mapResponse(candidate: SmartyStreetResponse, latencyMs: number): NormalizedResult {
    const { components, analysis } = candidate;
    
    // Add defensive checks for required fields
    if (!components || !analysis) {
      console.error('Smarty response missing required components or analysis:', candidate);
      return {
        isValid: false,
        errors: ['Invalid response from address validation service'],
        provider: AddressProvider.SMARTY,
        latencyMs,
      };
    }
    
    // Smarty's DPV (Delivery Point Validation) determines validity
    // Check both dpv_match_y boolean and dpv_match_code string formats
    const isValid = analysis.dpv_match_y === true || analysis.dpv_match_code === 'Y';
    const isVacant = analysis.dpv_vacancy === 'Y';
    
    // Build standardized address with defensive checks
    const standardizedAddress = {
      streetAddress: candidate.delivery_line_1 || '',
      secondaryAddress: candidate.delivery_line_2,
      city: components.city_name || '',
      state: components.state_abbreviation || '',
      ZIPCode: components.zipcode || '',
      ZIPPlus4: components.plus4_code ? `${components.zipcode}-${components.plus4_code}` : components.zipcode,
    };

    // Generate suggestions based on analysis
    const suggestions: string[] = [];
    
    if (analysis.footnotes?.includes('A')) {
      suggestions.push('Address matched at the ZIP+4 level');
    }
    if (analysis.footnotes?.includes('B')) {
      suggestions.push('Address validated to building/unit level');
    }
    if (analysis.suitelink_match) {
      suggestions.push('Suite/apartment number verified');
    }
    if (analysis.ews_match) {
      suggestions.push('Address found in Early Warning System');
    }

    // Generate errors/warnings
    const errors: string[] = [];
    
    if (isVacant) {
      errors.push('This address appears to be vacant.');
    }
    
    if (analysis.dpv_footnotes?.includes('CC')) {
      errors.push('Invalid city/state/ZIP combination.');
    }
    
    if (analysis.dpv_footnotes?.includes('N1')) {
      errors.push('Primary number is invalid.');
    }

    // Calculate confidence score
    let confidence = 0;
    if (analysis.dpv_match_y || analysis.dpv_match_code === 'Y') confidence += 60;
    if (analysis.suitelink_match) confidence += 20;
    if (components.plus4_code) confidence += 10;
    if (analysis.footnotes?.includes('A')) confidence += 10;

    return {
      isValid: isValid && !isVacant,
      standardizedAddress: isValid ? standardizedAddress : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      errors: errors.length > 0 ? errors : undefined,
      provider: AddressProvider.SMARTY,
      latencyMs,
      confidence,
    };
  }
}