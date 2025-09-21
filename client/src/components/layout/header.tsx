import { useAuth } from "@/hooks/useAuth";
import { NotebookTabs, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <NotebookTabs className="text-primary text-2xl" />
            <h1 className="text-xl font-semibold text-foreground">Customer Management System</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground" data-testid="text-username">
              {(user as any)?.firstName || (user as any)?.email || "Admin User"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
