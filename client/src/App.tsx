import { useEffect, useState } from "react";

interface Me {
  id: string;
  username: string;
  role: string;
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMe(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Login failed");
      return;
    }
    setMe(await res.json());
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
  }

  if (loading) return null;

  if (!me) {
    return (
      <div style={{ maxWidth: 320, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Asset Vantage Metrics</h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label>Username</label>
            <input
              style={{ display: "block", width: "100%" }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Password</label>
            <input
              type="password"
              style={{ display: "block", width: "100%" }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button type="submit">Log in</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Asset Vantage Metrics</h1>
      <p>
        Logged in as <strong>{me.username}</strong> ({me.role})
      </p>
      <button onClick={handleLogout}>Log out</button>
      <p style={{ marginTop: 24, color: "#666" }}>Screeners not yet wired up.</p>
    </div>
  );
}
