import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Designer from "@/pages/Designer";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/designer/:reportType" component={Designer} />
      <Route path="/designer" component={Designer} />
      <Route>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
          <div className="text-center">
            <p className="text-xl font-bold mb-2">Page not found</p>
            <a href="/" className="text-blue-400 underline">Home pe jao</a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
