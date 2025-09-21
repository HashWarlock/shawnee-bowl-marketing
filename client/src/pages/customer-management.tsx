import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Customer } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Tags, Phone, Trash2, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";

export default function CustomerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [consentFilter, setConsentFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const perPage = 25;

  const { data: customersData, isLoading } = useQuery({
    queryKey: ["/api/customers", { search, consentFilter, state: stateFilter, page, perPage }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
      });
      if (search) params.append("search", search);
      if (consentFilter && consentFilter !== "all") params.append("consentMailing", consentFilter);
      if (stateFilter && stateFilter !== "all") params.append("state", stateFilter);
      
      const response = await fetch(`/api/customers?${params}`, {
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

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Customer deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomers(new Set());
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
        description: "Failed to delete customer. Please try again.",
        variant: "destructive",
      });
    },
  });

  const customers = customersData?.customers || [];
  const total = customersData?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(new Set(customers.map(c => c.id)));
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleSelectCustomer = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedCustomers(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedCustomers.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedCustomers.size} customers?`);
    if (!confirmed) return;

    for (const id of selectedCustomers) {
      deleteCustomerMutation.mutate(id);
    }
  };

  const renderConsentBadges = (customer: Customer) => {
    const badges = [];
    if (customer.consentMailing) badges.push(<Badge key="mail" variant="secondary">Mail</Badge>);
    if (customer.consentEmail) badges.push(<Badge key="email" variant="outline">Email</Badge>);
    if (customer.consentPhone) badges.push(<Badge key="phone" variant="outline">Phone</Badge>);
    return badges;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading customers...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Customer Management</CardTitle>
            <CardDescription>Manage customer records and generate exports</CardDescription>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-muted-foreground" data-testid="text-total-customers">
              {total} customers
            </span>
            {selectedCustomers.size > 0 && (
              <>
                <div className="h-4 border-l border-border"></div>
                <span className="text-sm text-muted-foreground" data-testid="text-selected-customers">
                  {selectedCustomers.size} selected
                </span>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Search and Filter Controls */}
      <div className="p-6 border-b border-border bg-muted/30">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers by name, email, or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={consentFilter} onValueChange={setConsentFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-consent-filter">
                <SelectValue placeholder="All Mailing Consent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mailing Consent</SelectItem>
                <SelectItem value="true">Mailing Consent: Yes</SelectItem>
                <SelectItem value="false">Mailing Consent: No</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-state-filter">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="CA">California</SelectItem>
                <SelectItem value="IL">Illinois</SelectItem>
                <SelectItem value="NY">New York</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCustomers.size > 0 && (
        <div className="px-6 py-3 border-b border-border bg-accent/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground font-medium" data-testid="text-bulk-selected">
              {selectedCustomers.size} customers selected
            </span>
            <div className="flex items-center space-x-3">
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-generate-labels"
              >
                <Tags className="h-4 w-4 mr-1" />
                Generate Labels
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid="button-export-call-list"
              >
                <Phone className="h-4 w-4 mr-1" />
                Export Call List
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={deleteCustomerMutation.isPending}
                data-testid="button-delete-selected"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-12 px-6 py-3 text-left">
                <Checkbox
                  checked={selectedCustomers.size === customers.length && customers.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Consent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="hover:bg-muted/30 transition-colors"
                data-testid={`row-customer-${customer.id}`}
              >
                <td className="px-6 py-4">
                  <Checkbox
                    checked={selectedCustomers.has(customer.id)}
                    onCheckedChange={(checked) => handleSelectCustomer(customer.id, checked as boolean)}
                    data-testid={`checkbox-customer-${customer.id}`}
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-foreground" data-testid={`text-name-${customer.id}`}>
                    {customer.firstName} {customer.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`text-created-${customer.id}`}>
                    Added {format(new Date(customer.createdAt), "MMM d, yyyy")}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-foreground" data-testid={`text-company-${customer.id}`}>
                    {customer.company || "-"}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-foreground" data-testid={`text-address-${customer.id}`}>
                    {customer.addressLine1}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`text-city-state-${customer.id}`}>
                    {customer.city}, {customer.state} {customer.zip}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-foreground" data-testid={`text-phone-${customer.id}`}>
                    {customer.phone || "-"}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`text-email-${customer.id}`}>
                    {customer.email || "-"}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1" data-testid={`consent-badges-${customer.id}`}>
                    {renderConsentBadges(customer)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:text-primary/80"
                      data-testid={`button-edit-${customer.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive/80"
                      onClick={() => deleteCustomerMutation.mutate(customer.id)}
                      disabled={deleteCustomerMutation.isPending}
                      data-testid={`button-delete-${customer.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {customers.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground" data-testid="text-no-customers">
            No customers found. {search && "Try adjusting your search criteria."}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
              Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} customers
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-foreground" data-testid="text-current-page">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
