import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tags, Phone, Download, CheckCircle, Clock, Info } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";

export default function Exports() {
  const { toast } = useToast();
  const [location] = useLocation();
  
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  
  const [labelOptions, setLabelOptions] = useState({
    template: "avery_5160",
    paperSize: "letter",
    copies: 1,
    includeCompany: true,
  });

  const [csvOptions, setCsvOptions] = useState({
    fields: ["firstName", "lastName", "phone", "email"],
    consentFilter: "all",
  });

  // Load selected customer IDs from session storage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('selectedCustomerIds');
    if (stored) {
      try {
        const ids = JSON.parse(stored);
        setSelectedCustomerIds(Array.isArray(ids) ? ids : []);
      } catch (e) {
        console.error('Failed to parse selected customer IDs:', e);
        setSelectedCustomerIds([]);
      }
    }
  }, []);

  const { data: recentExports, isLoading: exportsLoading } = useQuery({
    queryKey: ["/api/exports/recent"],
    queryFn: async () => {
      const response = await fetch("/api/exports/recent", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        throw new Error("401: Unauthorized");
      }
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
  });

  const generateLabelsMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/exports/labels", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: "Labels generated successfully!",
      });
      // Auto-download the file
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
      // Refresh the recent exports table
      queryClient.invalidateQueries({ queryKey: ["/api/exports/recent"] });
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
        description: "Failed to generate labels. Please try again.",
        variant: "destructive",
      });
    },
  });

  const exportCallListMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/exports/calllist", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: "Call list exported successfully!",
      });
      // Auto-download the file
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
      // Refresh the recent exports table
      queryClient.invalidateQueries({ queryKey: ["/api/exports/recent"] });
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
        description: "Failed to export call list. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateLabels = () => {
    if (selectedCustomerIds.length === 0) {
      toast({
        title: "No Customers Selected",
        description: "Please select customers from the Customer Management tab first.",
        variant: "destructive",
      });
      return;
    }

    generateLabelsMutation.mutate({
      customerIds: selectedCustomerIds,
      labelTemplate: labelOptions.template,
      paperSize: labelOptions.paperSize,
      includeCompany: labelOptions.includeCompany,
      copies: labelOptions.copies,
    });
  };

  const handleExportCallList = () => {
    if (selectedCustomerIds.length === 0) {
      toast({
        title: "No Customers Selected",
        description: "Please select customers from the Customer Management tab first.",
        variant: "destructive",
      });
      return;
    }

    exportCallListMutation.mutate({
      customerIds: selectedCustomerIds,
      fields: csvOptions.fields,
      consentFilter: csvOptions.consentFilter,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <CheckCircle className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Options Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mailing Labels Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center mb-4">
              <div className="bg-primary/10 p-3 rounded-lg mr-4">
                <Tags className="text-primary text-xl" />
              </div>
              <div>
                <CardTitle className="text-lg">Mailing Labels</CardTitle>
                <CardDescription>Generate print-ready PDF labels (Avery 5160)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Label Template</label>
              <Select 
                value={labelOptions.template} 
                onValueChange={(value) => setLabelOptions({...labelOptions, template: value})}
              >
                <SelectTrigger data-testid="select-label-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avery_5160">Avery 5160 (3×10 per sheet)</SelectItem>
                  <SelectItem value="avery_5161">Avery 5161 (2×10 per sheet)</SelectItem>
                  <SelectItem value="avery_5162">Avery 5162 (2×7 per sheet)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Paper Size</label>
                <Select 
                  value={labelOptions.paperSize} 
                  onValueChange={(value) => setLabelOptions({...labelOptions, paperSize: value})}
                >
                  <SelectTrigger data-testid="select-paper-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="letter">Letter (8.5×11)</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Copies</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={labelOptions.copies}
                  onChange={(e) => setLabelOptions({...labelOptions, copies: parseInt(e.target.value)})}
                  data-testid="input-copies"
                />
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">Label Content Options</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <Checkbox
                    checked={labelOptions.includeCompany}
                    onCheckedChange={(checked) => setLabelOptions({...labelOptions, includeCompany: checked as boolean})}
                    data-testid="checkbox-include-company"
                  />
                  <span className="ml-2 text-sm text-foreground">Include company name</span>
                </label>
              </div>
            </div>

            <div className="bg-accent/10 rounded-lg p-4">
              <div className="flex items-center">
                <Info className="text-accent mr-2 h-4 w-4" />
                <span className="text-sm text-foreground" data-testid="text-selected-for-labels">
                  {selectedCustomerIds.length} customers selected for label generation
                </span>
              </div>
            </div>

            <Button
              onClick={handleGenerateLabels}
              disabled={generateLabelsMutation.isPending || selectedCustomerIds.length === 0}
              className="w-full"
              data-testid="button-generate-labels"
            >
              <Download className="h-4 w-4 mr-2" />
              {generateLabelsMutation.isPending ? "Generating..." : "Generate Label PDF"}
            </Button>
          </CardContent>
        </Card>

        {/* Call List Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center mb-4">
              <div className="bg-accent/10 p-3 rounded-lg mr-4">
                <Phone className="text-accent text-xl" />
              </div>
              <div>
                <CardTitle className="text-lg">Call List Export</CardTitle>
                <CardDescription>Export customer data as CSV for calling campaigns</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Export Fields</label>
              <div className="bg-muted rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                {[
                  { id: "firstName", label: "First Name" },
                  { id: "lastName", label: "Last Name" },
                  { id: "phone", label: "Phone Number" },
                  { id: "email", label: "Email Address" },
                  { id: "company", label: "Company" },
                  { id: "addressLine1", label: "Address Line 1" },
                  { id: "city", label: "City" },
                  { id: "state", label: "State" },
                  { id: "zip", label: "ZIP Code" },
                  { id: "consentMailing", label: "Consent Flags" },
                ].map((field) => (
                  <label key={field.id} className="flex items-center">
                    <Checkbox
                      checked={csvOptions.fields.includes(field.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setCsvOptions({
                            ...csvOptions,
                            fields: [...csvOptions.fields, field.id]
                          });
                        } else {
                          setCsvOptions({
                            ...csvOptions,
                            fields: csvOptions.fields.filter(f => f !== field.id)
                          });
                        }
                      }}
                      data-testid={`checkbox-field-${field.id}`}
                    />
                    <span className="ml-2 text-sm text-foreground">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Filter by Consent</label>
              <Select 
                value={csvOptions.consentFilter} 
                onValueChange={(value) => setCsvOptions({...csvOptions, consentFilter: value})}
              >
                <SelectTrigger data-testid="select-consent-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  <SelectItem value="phone_only">Phone consent only</SelectItem>
                  <SelectItem value="email_only">Email consent only</SelectItem>
                  <SelectItem value="both">Both phone and email consent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-accent/10 rounded-lg p-4">
              <div className="flex items-center">
                <Info className="text-accent mr-2 h-4 w-4" />
                <span className="text-sm text-foreground" data-testid="text-selected-for-csv">
                  {selectedCustomerIds.length} customers selected for call list export
                </span>
              </div>
            </div>

            <Button
              onClick={handleExportCallList}
              disabled={exportCallListMutation.isPending || selectedCustomerIds.length === 0}
              className="w-full"
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              {exportCallListMutation.isPending ? "Exporting..." : "Download CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Exports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Exports</CardTitle>
          <CardDescription>Download history and export status</CardDescription>
        </CardHeader>
        <CardContent>
          {exportsLoading ? (
            <div className="text-center py-4">
              <div className="text-muted-foreground">Loading recent exports...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Records
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {recentExports?.map((exportJob: any) => (
                    <tr key={exportJob.id} data-testid={`row-export-${exportJob.id}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {exportJob.type === 'labels' ? (
                            <Tags className="text-primary mr-2 h-4 w-4" />
                          ) : (
                            <Phone className="text-accent mr-2 h-4 w-4" />
                          )}
                          <span className="text-sm font-medium text-foreground">
                            {exportJob.type === 'labels' ? 'Mailing Labels' : 'Call List CSV'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground" data-testid={`text-records-${exportJob.id}`}>
                          {exportJob.customerCount} customers
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground" data-testid={`text-created-${exportJob.id}`}>
                          {format(new Date(exportJob.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </td>
                      <td className="px-6 py-4" data-testid={`status-${exportJob.id}`}>
                        {getStatusBadge(exportJob.status)}
                      </td>
                      <td className="px-6 py-4">
                        {exportJob.status === 'completed' && exportJob.filePath ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(exportJob.filePath, '_blank')}
                            data-testid={`button-download-${exportJob.id}`}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {exportJob.status === 'processing' ? 'Processing...' : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center">
                        <span className="text-muted-foreground" data-testid="text-no-exports">
                          No recent exports found.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
