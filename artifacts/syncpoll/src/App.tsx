import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "@workspace/replit-auth-web";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import SessionsList from "@/pages/sessions";
import CreateSession from "@/pages/sessions/new";
import SessionDetail from "@/pages/sessions/detail";
import PollsList from "@/pages/polls";
import CreatePoll from "@/pages/polls/new";
import PollDetail from "@/pages/polls/detail";
import JoinSession from "@/pages/participant/join";
import VotePoll from "@/pages/participant/vote";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/join/:sessionId" component={JoinSession} />
      <Route path="/vote/:pollId" component={VotePoll} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/sessions" component={() => <ProtectedRoute component={SessionsList} />} />
      <Route path="/sessions/new" component={() => <ProtectedRoute component={CreateSession} />} />
      <Route path="/sessions/:id" component={() => <ProtectedRoute component={SessionDetail} />} />
      <Route path="/polls" component={() => <ProtectedRoute component={PollsList} />} />
      <Route path="/polls/new" component={() => <ProtectedRoute component={CreatePoll} />} />
      <Route path="/polls/:id" component={() => <ProtectedRoute component={PollDetail} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
