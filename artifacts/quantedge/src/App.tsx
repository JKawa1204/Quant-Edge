import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";

import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

// Pages
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Portfolio from "@/pages/portfolio";
import Watchlist from "@/pages/watchlist";
import Signals from "@/pages/signals";
import Orders from "@/pages/orders";
import Analytics from "@/pages/analytics";
import Backtests from "@/pages/backtests";
import Regime from "@/pages/regime";
import StockDetail from "@/pages/stock-detail";
import IciciCallback from "@/pages/icici-callback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  
  return (
    <Route
      {...rest}
      component={(props) => 
        isAuthenticated ? (
          <Layout>
            <Component {...props} />
          </Layout>
        ) : (
          <Redirect to="/login" />
        )
      }
    />
  );
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/icici-callback" component={IciciCallback} />
      
      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>

      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/portfolio" component={Portfolio} />
      <ProtectedRoute path="/watchlist" component={Watchlist} />
      <ProtectedRoute path="/signals" component={Signals} />
      <ProtectedRoute path="/orders" component={Orders} />
      <ProtectedRoute path="/analytics" component={Analytics} />
      <ProtectedRoute path="/backtests" component={Backtests} />
      <ProtectedRoute path="/regime" component={Regime} />
      <ProtectedRoute path="/stocks/:symbol" component={StockDetail} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Set dark mode class on document
  if (typeof window !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

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

export default App;