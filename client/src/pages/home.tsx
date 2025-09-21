import { useAuth } from "@/hooks/useAuth";
import { Switch, Route } from "wouter";
import CustomerEntry from "./customer-entry";
import CustomerManagement from "./customer-management";
import Exports from "./exports";
import Header from "@/components/layout/header";
import TabNavigation from "@/components/layout/tab-navigation";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <TabNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Switch>
          <Route path="/" component={CustomerEntry} />
          <Route path="/customers" component={CustomerManagement} />
          <Route path="/exports" component={Exports} />
          <Route>
            <CustomerEntry />
          </Route>
        </Switch>
      </main>
    </div>
  );
}
