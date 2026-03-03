import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import LeadDetail from "./pages/LeadDetail";
import LeadsList from "./pages/LeadsList";
import Pipeline from "@/pages/Pipeline";
import Discover from "@/pages/Discover";
import Import from "./pages/Import";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={LeadsList} />
      <Route path="/leads/:id" component={LeadDetail} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/discover" component={Discover} />
      <Route path="/import" component={Import} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
