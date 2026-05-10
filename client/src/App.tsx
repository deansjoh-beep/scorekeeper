import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import MatchDetails from "@/pages/MatchDetails";
import RoundEvaluation from "@/pages/RoundEvaluation";
import Setup from "@/pages/Setup";
import Bulletin from "@/pages/Bulletin";
import Games from "@/pages/Games";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/matches/:id" component={MatchDetails} />
      <Route path="/rounds" component={RoundEvaluation} />
      <Route path="/bulletin" component={Bulletin} />
      <Route path="/games" component={Games} />
      <Route path="/setup" component={Setup} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
