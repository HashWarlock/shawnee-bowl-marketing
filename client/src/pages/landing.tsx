import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotebookTabs, Tags, Phone, Shield } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <NotebookTabs className="text-primary text-2xl" />
              <h1 className="text-xl font-semibold text-foreground">Customer Management System</h1>
            </div>
            <Button onClick={handleLogin} data-testid="button-login">
              Login
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-6">
            Streamline Your Direct Marketing Campaigns
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Collect customer information, generate professional mailing labels, and create targeted call lists 
            for your marketing campaigns. All in one secure, easy-to-use platform.
          </p>
          <Button size="lg" onClick={handleLogin} data-testid="button-get-started">
            Get Started
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <Card>
            <CardHeader>
              <div className="bg-primary/10 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <NotebookTabs className="text-primary text-xl" />
              </div>
              <CardTitle>Customer Management</CardTitle>
              <CardDescription>
                Easily collect and manage customer contact information with validation and consent tracking.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="bg-primary/10 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Tags className="text-primary text-xl" />
              </div>
              <CardTitle>Mailing Labels</CardTitle>
              <CardDescription>
                Generate print-ready PDF labels in Avery 5160 format, perfectly sized for standard mailing.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="bg-primary/10 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Phone className="text-primary text-xl" />
              </div>
              <CardTitle>Call Lists</CardTitle>
              <CardDescription>
                Export customer data as CSV files for phone campaigns and email marketing automation.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Security Notice */}
        <Card className="mt-20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-4">
              <Shield className="text-primary text-2xl" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Secure & Compliant</h3>
                <p className="text-muted-foreground">
                  Your customer data is protected with enterprise-grade security and consent management.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
