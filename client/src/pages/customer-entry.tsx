import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertCustomerSchema, type InsertCustomer } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, RotateCcw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

interface AddressValidationResult {
  isValid: boolean;
  standardizedAddress?: {
    streetAddress: string;
    city: string;
    state: string;
    ZIPCode: string;
    ZIPPlus4?: string;
  };
  suggestions?: string[];
  errors?: string[];
  serviceUnavailable?: boolean;
}

export default function CustomerEntry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addressValidation, setAddressValidation] = useState<AddressValidationResult | null>(null);

  const form = useForm<InsertCustomer>({
    resolver: zodResolver(insertCustomerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      company: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      zip: "",
      phone: "",
      email: "",
      consentMailing: true,
      consentEmail: true,
      consentPhone: true,
    },
  });

  const validateAddressMutation = useMutation<AddressValidationResult, Error, {
    streetAddress: string;
    city: string;
    state: string;
    ZIPCode?: string;
    secondaryAddress?: string;
  }>({
    mutationFn: async (address) => {
      const response = await apiRequest("POST", "/api/validate-address", address);
      return await response.json();
    },
    onSuccess: (result: AddressValidationResult) => {
      setAddressValidation(result);
      if (result.isValid && result.standardizedAddress) {
        // Auto-fill with standardized address
        form.setValue("addressLine1", result.standardizedAddress.streetAddress);
        form.setValue("city", result.standardizedAddress.city);
        form.setValue("state", result.standardizedAddress.state);
        form.setValue("zip", result.standardizedAddress.ZIPPlus4 
          ? `${result.standardizedAddress.ZIPCode}-${result.standardizedAddress.ZIPPlus4}`
          : result.standardizedAddress.ZIPCode
        );
        toast({
          title: "Address Validated",
          description: "Address is valid and has been standardized.",
        });
      } else if (result.errors && result.errors.length > 0) {
        toast({
          title: "Address Invalid",
          description: result.errors[0],
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Validation Error",
        description: "Failed to validate address. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: InsertCustomer) => {
      return await apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Customer added successfully!",
      });
      form.reset();
      setAddressValidation(null);
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCustomer) => {
    // Check if address validation is required and has been performed
    if (!addressValidation) {
      toast({
        title: "Address Validation Required",
        description: "Please validate the customer's address before saving to ensure data quality.",
        variant: "destructive",
      });
      return;
    }

    // Check if address validation failed due to invalid address (not service unavailable)
    if (!addressValidation.isValid && !addressValidation.serviceUnavailable) {
      toast({
        title: "Invalid Address",
        description: "Cannot save customer with invalid address. Please correct the address and try again.",
        variant: "destructive",
      });
      return;
    }

    // If service is unavailable, allow saving with warning
    if (addressValidation.serviceUnavailable) {
      toast({
        title: "Address Not Validated",
        description: "Customer saved without address validation due to service unavailability.",
        variant: "default",
      });
    }

    // Proceed with customer creation
    createCustomerMutation.mutate(data);
  };

  const clearForm = () => {
    form.reset();
    setAddressValidation(null);
  };

  const validateAddress = () => {
    const formValues = form.getValues();
    if (!formValues.addressLine1 || !formValues.city || !formValues.state) {
      toast({
        title: "Missing Information",
        description: "Please fill in Address Line 1, City, and State before validating.",
        variant: "destructive",
      });
      return;
    }

    validateAddressMutation.mutate({
      streetAddress: formValues.addressLine1,
      city: formValues.city,
      state: formValues.state,
      ZIPCode: formValues.zip || undefined,
      secondaryAddress: formValues.addressLine2 || undefined,
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add New Customer</CardTitle>
          <CardDescription>
            Enter customer information to generate mailing labels and call lists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        First Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} data-testid="input-firstName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Last Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} data-testid="input-lastName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corporation" {...field} value={field.value || ""} data-testid="input-company" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Address Line 1 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} data-testid="input-addressLine1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Apt 4B, Suite 200" {...field} value={field.value || ""} data-testid="input-addressLine2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        City <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Chicago" {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        State <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-state">
                            <SelectValue placeholder="Select State" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        ZIP Code <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="60605" {...field} data-testid="input-zip" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address Validation Section */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-foreground">US Address Validation</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={validateAddress}
                    disabled={validateAddressMutation.isPending}
                    data-testid="button-validate-address"
                  >
                    {validateAddressMutation.isPending ? (
                      <>
                        <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Validate Address
                      </>
                    )}
                  </Button>
                </div>
                
                {addressValidation && (
                  <div className="space-y-2">
                    {addressValidation.isValid ? (
                      <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700 dark:text-green-300">
                          ✓ Address is valid and has been standardized by USPS
                        </AlertDescription>
                      </Alert>
                    ) : addressValidation.serviceUnavailable ? (
                      <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-700 dark:text-orange-300">
                          ⚠️ {addressValidation.errors?.[0] || "Address validation service unavailable"}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          {addressValidation.errors?.[0] || "Address validation failed"}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {addressValidation.suggestions && addressValidation.suggestions.length > 0 && (
                      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-700 dark:text-blue-300">
                          <div className="font-medium">USPS Suggestions:</div>
                          <ul className="mt-1 list-disc list-inside space-y-1">
                            {addressValidation.suggestions.map((suggestion, index) => (
                              <li key={index} className="text-sm">{suggestion}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                <div className="text-xs text-muted-foreground mt-2">
                  Validates address against USPS standards to ensure accurate delivery for mailing campaigns.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="(312) 555-1234" {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john.doe@email.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-muted rounded-lg p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Communication Preferences</h3>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="consentMailing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-consentMailing"
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          I consent to receiving postal mail
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="consentEmail"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-consentEmail"
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          I consent to receiving emails
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="consentPhone"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-consentPhone"
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          I consent to receiving phone calls
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={clearForm}
                  data-testid="button-clear"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear Form
                </Button>
                <Button
                  type="submit"
                  disabled={createCustomerMutation.isPending || (!addressValidation || (!addressValidation.isValid && !addressValidation.serviceUnavailable))}
                  data-testid="button-submit"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createCustomerMutation.isPending ? "Adding..." : "Add Customer"}
                </Button>
                {!addressValidation && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Address validation required before saving customer
                  </p>
                )}
                {addressValidation && !addressValidation.isValid && !addressValidation.serviceUnavailable && (
                  <p className="text-xs text-destructive mt-2">
                    Please correct address errors before saving
                  </p>
                )}
                {addressValidation && addressValidation.serviceUnavailable && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ Address validation unavailable - customer can be saved with warning
                  </p>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
