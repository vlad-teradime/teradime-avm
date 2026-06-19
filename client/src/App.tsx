import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Redirect } from "wouter";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { AppDarkBackground } from "@/components/AppDarkBackground";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import PeEvaluatorPage from "@/pages/pe-evaluator";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Protected({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Redirect to="/" />;
  return <>{children}</>;
}

function Root() {
  const { theme } = useTheme();

  return (
    <>
      {theme === "dark" && <AppDarkBackground />}
      <Switch>
        <Route path="/login">
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        </Route>
        <Route path="/signup">
          <PublicOnly>
            <SignupPage />
          </PublicOnly>
        </Route>
        <Route path="/pe-evaluator">
          <Protected>
            <PeEvaluatorPage />
          </Protected>
        </Route>
        <Route path="/">
          <Protected>
            <Dashboard />
          </Protected>
        </Route>
      </Switch>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
