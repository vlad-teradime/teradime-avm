import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPageLayout } from "@/components/AuthPageLayout";
import { Link } from "wouter";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, loginError } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
    } catch {
      // Error surfaced via loginError below
    }
  };

  const getErrorMessage = (error: unknown) => {
    if (!error) return null;
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Invalid username or password")) return "Incorrect username or password. Please try again.";
    if (msg.includes("Not authenticated")) return "Session expired. Please log in again.";
    return "Login failed. Please try again.";
  };

  return (
    <AuthPageLayout
      subtitle="Sign in to your account"
      footer={
        <p className="text-sm" style={{ color: "rgba(90,173,212,0.50)" }}>
          Don't have an account?{" "}
          <Link href="/signup" className="hover:underline font-medium" style={{ color: "#5AADD4" }}>
            Sign up →
          </Link>
        </p>
      }
    >
      <h2 className="text-center text-base font-semibold mb-6" style={{ color: "rgba(221,234,245,0.85)" }}>
        Sign In
      </h2>
      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="username" style={{ color: "rgba(221,234,245,0.80)", fontSize: "0.8rem" }}>
            Username
          </Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
            disabled={isLoggingIn}
            className="login-input"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" style={{ color: "rgba(221,234,245,0.80)", fontSize: "0.8rem" }}>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            disabled={isLoggingIn}
            className="login-input"
          />
        </div>
        <Button type="submit" className="w-full login-btn" disabled={isLoggingIn}>
          {isLoggingIn ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Sign In
            </>
          )}
        </Button>
      </form>
      {loginError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{getErrorMessage(loginError)}</AlertDescription>
        </Alert>
      ) : null}
    </AuthPageLayout>
  );
}
