import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserPlus } from "lucide-react";
import { AuthPageLayout } from "@/components/AuthPageLayout";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function SignupPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 3) return setError("Username must be at least 3 characters");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, email: email.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Signup failed");
      }
      const me = await res.json();
      queryClient.setQueryData(["/api/auth/me"], me);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      subtitle="Create your account"
      footer={
        <p className="text-sm" style={{ color: "rgba(90,173,212,0.50)" }}>
          Already have an account?{" "}
          <Link href="/login" className="hover:underline font-medium" style={{ color: "#5AADD4" }}>
            Sign in →
          </Link>
        </p>
      }
    >
      <h2 className="text-center text-base font-semibold mb-6" style={{ color: "rgba(221,234,245,0.85)" }}>
        Sign Up
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="username" style={{ color: "rgba(221,234,245,0.80)", fontSize: "0.8rem" }}>
            Username
          </Label>
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" required disabled={isSubmitting} className="login-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" style={{ color: "rgba(221,234,245,0.80)", fontSize: "0.8rem" }}>
            Email (optional)
          </Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={isSubmitting} className="login-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" style={{ color: "rgba(221,234,245,0.80)", fontSize: "0.8rem" }}>
            Password
          </Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required disabled={isSubmitting} className="login-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" style={{ color: "rgba(221,234,245,0.80)", fontSize: "0.8rem" }}>
            Confirm Password
          </Label>
          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required disabled={isSubmitting} className="login-input" />
        </div>
        <Button type="submit" className="w-full login-btn" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Sign Up
            </>
          )}
        </Button>
      </form>
      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </AuthPageLayout>
  );
}
