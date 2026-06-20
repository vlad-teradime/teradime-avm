import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, KeyRound, Trash2, UserPlus, ShieldCheck, ShieldOff } from "lucide-react";

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  role: "admin" | "user";
}

interface Restriction {
  id: string;
  userId: string;
  screenerKey: string;
}

const SCREENER_KEY = "pe-evaluator";
const SCREENER_LABEL = "PE Evaluator";

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

function PeAccessToggle({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: restrictions, isLoading } = useQuery<Restriction[]>({
    queryKey: ["/api/admin/users", userId, "restrictions"],
    queryFn: () => fetchJson(`/api/admin/users/${userId}/restrictions`),
  });

  const restricted = restrictions?.some((r) => r.screenerKey === SCREENER_KEY) ?? false;

  const toggleMutation = useMutation({
    mutationFn: () =>
      restricted
        ? fetchJson(`/api/admin/users/${userId}/restrictions/${SCREENER_KEY}`, { method: "DELETE" })
        : fetchJson(`/api/admin/users/${userId}/restrictions`, { method: "POST", body: JSON.stringify({ screenerKey: SCREENER_KEY }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/users", userId, "restrictions"] }),
  });

  if (isLoading) return <Skeleton className="h-6 w-20" />;

  return (
    <button
      onClick={() => toggleMutation.mutate()}
      disabled={toggleMutation.isPending}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        restricted
          ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
          : "bg-green-600/10 text-green-700 dark:text-green-400 hover:bg-green-600/20"
      }`}
      title={restricted ? "Click to grant access" : "Click to restrict access"}
    >
      {restricted ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
      {restricted ? "Restricted" : "Allowed"}
    </button>
  );
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  const mutation = useMutation({
    mutationFn: () => fetchJson("/api/admin/users", { method: "POST", body: JSON.stringify({ username, email, password, role }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUsername(""); setEmail(""); setPassword(""); setRole("user");
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New User</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="new-username">Username</Label>
            <Input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password</Label>
            <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-role">Role</Label>
            <select
              id="new-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{(mutation.error as Error).message}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Create User
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyUserDialog({ source, onClose }: { source: AdminUser | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => fetchJson(`/api/admin/users/${source!.id}/copy`, { method: "POST", body: JSON.stringify({ username, email, password }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUsername(""); setEmail(""); setPassword("");
      onClose();
    },
  });

  return (
    <Dialog open={!!source} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy User — {source?.username}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <p className="text-sm text-muted-foreground">
            Creates a new {source?.role} account with the same screener access as <strong>{source?.username}</strong>.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="copy-username">New Username</Label>
            <Input id="copy-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="copy-email">Email</Label>
            <Input id="copy-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="copy-password">Password</Label>
            <Input id="copy-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{(mutation.error as Error).message}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Copy User
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ target, onClose }: { target: AdminUser | null; onClose: () => void }) {
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => fetchJson(`/api/admin/users/${target!.id}/password`, { method: "PATCH", body: JSON.stringify({ newPassword: password }) }),
    onSuccess: () => {
      setPassword("");
      onClose();
    },
  });

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password — {target?.username}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">New Password</Label>
            <Input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoFocus />
          </div>
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{(mutation.error as Error).message}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            Update Password
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ target, onClose }: { target: AdminUser | null; onClose: () => void }) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => fetchJson(`/api/admin/users/${target!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onClose();
    },
  });

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User — {target?.username}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently deletes <strong>{target?.username}</strong> and their screener access. This cannot be undone.
        </p>
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{(mutation.error as Error).message}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsersPage() {
  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => fetchJson("/api/admin/users"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [copySource, setCopySource] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Users</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage accounts and screener access</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            New User
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border text-left">
                  <th className="py-2.5 px-4 font-medium">Username</th>
                  <th className="py-2.5 px-4 font-medium">Email</th>
                  <th className="py-2.5 px-4 font-medium">Role</th>
                  <th className="py-2.5 px-4 font-medium">{SCREENER_LABEL}</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 px-4 font-medium">{u.username}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{u.email || "—"}</td>
                    <td className="py-2.5 px-4 capitalize">{u.role}</td>
                    <td className="py-2.5 px-4">
                      <PeAccessToggle userId={u.id} />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Copy user" onClick={() => setCopySource(u)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Reset password" onClick={() => setResetTarget(u)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete user" onClick={() => setDeleteTarget(u)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CopyUserDialog source={copySource} onClose={() => setCopySource(null)} />
      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
      <DeleteUserDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </AppShell>
  );
}
