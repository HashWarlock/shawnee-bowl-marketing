import { useLocation } from "wouter";
import { UserPlus, Users, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TabNavigation() {
  const [location, setLocation] = useLocation();

  const tabs = [
    {
      id: "customer-entry",
      label: "Customer Entry",
      icon: UserPlus,
      path: "/",
    },
    {
      id: "customer-management", 
      label: "Customer Management",
      icon: Users,
      path: "/customers",
    },
    {
      id: "exports",
      label: "Exports", 
      icon: Download,
      path: "/exports",
    },
  ];

  return (
    <div className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location === tab.path;
            
            return (
              <button
                key={tab.id}
                onClick={() => setLocation(tab.path)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 border-transparent hover:border-primary transition-colors",
                  isActive && "border-primary text-primary bg-primary/5"
                )}
                data-testid={`tab-${tab.id}`}
              >
                <Icon className="h-4 w-4 mr-2 inline" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
