import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Me {
  id: string;
  username: string;
  role: string;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? `${res.status}`);
  }
  return res.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<Me | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      fetchJson("/api/auth/login", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: (data) => queryClient.setQueryData(["/api/auth/me"], data),
  });

  const logoutMutation = useMutation({
    mutationFn: () => fetchJson("/api/auth/logout", { method: "POST" }),
    onSuccess: () => queryClient.setQueryData(["/api/auth/me"], null),
  });

  return {
    user,
    isLoading,
    login: (username: string, password: string) => loginMutation.mutateAsync({ username, password }),
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: () => logoutMutation.mutateAsync(),
  };
}
