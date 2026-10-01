import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { AlertCircle } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-fire-muted mb-6">
        <AlertCircle className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-8">This page could not be found.</p>
      <Button asChild>
        <Link to="/">Return to dashboard</Link>
      </Button>
    </div>
  );
}
