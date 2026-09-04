"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ChevronLeft, ChevronRight, Lock, Plus, Search, Trash2, Unlock } from "lucide-react";
import { api, AuthResponse, ManagedUser, Workspace } from "@/lib/api";
import { Card, Field, Modal, PageHeader, PrimaryButton, inputClass } from "@/components/ui";

export default function UsersPage() {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "READ_ONLY">("READ_ONLY");
  const [existingMode, setExistingMode] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [workspacePage, setWorkspacePage] = useState(1);
  const [pendingRemoval, setPendingRemoval] = useState<ManagedUser | null>(null);
  const [removing, setRemoving] = useState(false);
  const [pendingWorkspaceAction, setPendingWorkspaceAction] = useState<{ type: "restrict" | "delete"; workspace: Workspace } | null>(null);
  const [workspaceActionBusy, setWorkspaceActionBusy] = useState(false);
  const [workspaceCreateBusy, setWorkspaceCreateBusy] = useState(false);

  async function loadUsers(companyId = selectedWorkspace?.id) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    setUsers(await api.get<ManagedUser[]>(`/auth/users${query}`));
  }

  useEffect(() => {
    Promise.all([
      api.get<AuthResponse>("/auth/me"),
      api.get<Workspace[]>("/auth/workspaces"),
      api.get<ManagedUser[]>("/auth/users"),
    ])
      .then(([currentUser, availableWorkspaces, workspaceUsers]) => {
        setUser(currentUser.user);
        setWorkspaces(availableWorkspaces);
        setUsers(workspaceUsers);
        setSelectedWorkspace(availableWorkspaces.find((item) => item.id === currentUser.user.companyId) ?? availableWorkspaces[0] ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      if (existingMode) {
        await api.post("/auth/users/existing", { email, role, companyId: selectedWorkspace?.id });
      } else {
        await api.post("/auth/users", { name, email, password, role, companyId: selectedWorkspace?.id });
      }
      setName(""); setEmail(""); setPassword("");
      setMessage(existingMode ? "Existing user added to this workspace." : "User added to this workspace.");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add user");
    }
  }

  async function removeUser(id: string) {
    setError("");
    try {
      setRemoving(true);
      await api.delete(`/auth/users/${id}?companyId=${encodeURIComponent(selectedWorkspace?.id ?? "")}`);
      setPendingRemoval(null);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove user");
    } finally {
      setRemoving(false);
    }
  }

  async function updateRole(workspaceUser: ManagedUser, nextRole: "ADMIN" | "READ_ONLY") {
    try {
      setError("");
      await api.patch(`/auth/users/${workspaceUser.id}`, { role: nextRole, companyId: selectedWorkspace?.id });
      setMessage("User role updated.");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update user");
    }
  }

  async function renameWorkspace(workspace: Workspace) {
    const nextName = window.prompt("Workspace name", workspace.name)?.trim();
    if (!nextName || nextName === workspace.name) return;
    try {
      setError("");
      await api.patch(`/auth/workspaces/${workspace.id}`, { name: nextName });
      setWorkspaces(await api.get<Workspace[]>("/auth/workspaces"));
      setMessage("Workspace renamed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename workspace");
    }
  }

  async function createWorkspace() {
    const workspaceName = window.prompt("New workspace name")?.trim();
    if (!workspaceName) return;
    try {
      setError("");
      setWorkspaceCreateBusy(true);
      const created = await api.post<Workspace>("/auth/workspaces", { name: workspaceName });
      const refreshed = await api.get<Workspace[]>("/auth/workspaces");
      setWorkspaces(refreshed);
      await selectWorkspace(created);
      setMessage(`Workspace “${created.name}” created.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create workspace");
    } finally {
      setWorkspaceCreateBusy(false);
    }
  }

  async function switchWorkspace(workspace: Workspace) {
    if (workspace.id === user?.companyId) return;
    try {
      setError("");
      await api.post<AuthResponse>("/auth/switch-workspace", { companyId: workspace.id });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to switch workspace");
    }
  }

  async function confirmWorkspaceAction() {
    if (!pendingWorkspaceAction) return;
    setWorkspaceActionBusy(true);
    try {
      const workspace = pendingWorkspaceAction.workspace;
      if (pendingWorkspaceAction.type === "delete") {
        await api.delete(`/auth/workspaces/${workspace.id}`);
        const refreshed = await api.get<Workspace[]>("/auth/workspaces");
        setWorkspaces(refreshed);
        if (selectedWorkspace?.id === workspace.id) {
          const fallback = refreshed.find((item) => item.name === "Default Company") ?? refreshed[0] ?? null;
          setSelectedWorkspace(fallback);
          if (fallback) await loadUsers(fallback.id);
        }
        setMessage("Workspace deleted permanently.");
      } else {
        await api.patch(`/auth/workspaces/${workspace.id}`, { name: workspace.name, isRestricted: !workspace.isRestricted });
        const refreshed = await api.get<Workspace[]>("/auth/workspaces");
        setWorkspaces(refreshed);
        setSelectedWorkspace((current) => current?.id === workspace.id ? refreshed.find((item) => item.id === workspace.id) ?? current : current);
        setMessage(workspace.isRestricted ? "Workspace unrestricted." : "Workspace restricted.");
      }
      setPendingWorkspaceAction(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace change failed");
    } finally {
      setWorkspaceActionBusy(false);
    }
  }

  const isSystemAdmin = user?.email.trim().toLowerCase() === "admin@girjasoft.com";
  const filteredWorkspaces = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase();
    return query
      ? workspaces.filter((workspace) => workspace.name.toLowerCase().includes(query))
      : workspaces;
  }, [workspaceSearch, workspaces]);
  const workspacePageSize = 10;
  const workspacePageCount = Math.max(1, Math.ceil(filteredWorkspaces.length / workspacePageSize));
  const visibleWorkspaces = filteredWorkspaces.slice(
    (workspacePage - 1) * workspacePageSize,
    workspacePage * workspacePageSize,
  );

  async function selectWorkspace(workspace: Workspace) {
    try {
      setSelectedWorkspace(workspace);
      await loadUsers(workspace.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workspace users");
    }
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Create users and assign their access for the active workspace." />
      {error ? <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card> : null}
      {message ? <Card className="mb-4 p-3 text-sm text-emerald-600">{message}</Card> : null}

      {isSystemAdmin ? (
        <Card className="mb-6 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Workspaces</h2>
              <p className="mt-1 text-sm text-slate-500">Manage access, restrictions, and workspace data from one place.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label className="relative block w-full sm:w-64">
                <span className="sr-only">Search workspaces</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={`${inputClass} pl-9`} placeholder="Search workspaces..." value={workspaceSearch} onChange={(e) => { setWorkspaceSearch(e.target.value); setWorkspacePage(1); }} />
              </label>
              <PrimaryButton type="button" disabled={workspaceCreateBusy} onClick={createWorkspace} className="shrink-0"><Plus className="h-4 w-4" />{workspaceCreateBusy ? "Creating..." : "Create workspace"}</PrimaryButton>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Workspace</span><span>Actions</span></div>
            <div className="max-h-[min(55vh,32rem)] overflow-y-auto divide-y divide-slate-100">
              {visibleWorkspaces.map((workspace) => (
                <div key={workspace.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm sm:px-4 ${workspace.id === user?.companyId ? "bg-blue-50/60" : "bg-white"}`}>
                  <button type="button" onClick={() => selectWorkspace(workspace)} className={`min-w-0 rounded-md px-2 py-1.5 text-left hover:bg-blue-50 ${workspace.id === selectedWorkspace?.id ? "bg-blue-50" : ""}`}><p className="truncate font-medium text-slate-900">{workspace.name}</p><span className="text-[11px] uppercase tracking-wide text-slate-500">{workspace.id === user?.companyId ? "Current session" : "Management view"}{workspace.isRestricted ? " · Restricted" : ""}</span></button>
                  <div className="flex items-center gap-1">{workspace.id !== user?.companyId ? <button type="button" onClick={() => switchWorkspace(workspace)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"><ArrowRightLeft className="h-3.5 w-3.5" />Switch</button> : <span className="px-2 text-xs text-slate-400">Current</span>}{workspace.name !== "Default Company" ? <><button type="button" onClick={() => renameWorkspace(workspace)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Rename</button><button type="button" aria-label={`${workspace.isRestricted ? "Unrestrict" : "Restrict"} ${workspace.name}`} title={`${workspace.isRestricted ? "Unrestrict" : "Restrict"} workspace`} onClick={() => setPendingWorkspaceAction({ type: "restrict", workspace })} className="rounded p-2 text-amber-600 hover:bg-amber-50">{workspace.isRestricted ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</button><button type="button" aria-label={`Delete ${workspace.name}`} title="Delete workspace" onClick={() => setPendingWorkspaceAction({ type: "delete", workspace })} className="rounded p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></> : <span className="text-xs text-slate-400">Protected</span>}</div>
                </div>
              ))}
            </div>
          </div>
          {visibleWorkspaces.length === 0 ? <p className="mt-3 text-sm text-slate-500">No workspaces match your search.</p> : null}
          {workspacePageCount > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>Showing {Math.min((workspacePage - 1) * workspacePageSize + 1, filteredWorkspaces.length)}–{Math.min(workspacePage * workspacePageSize, filteredWorkspaces.length)} of {filteredWorkspaces.length} workspaces</span>
              <div className="flex gap-2">
                <button type="button" aria-label="Previous workspace page" disabled={workspacePage === 1} onClick={() => setWorkspacePage((page) => Math.max(1, page - 1))} className="rounded-md border border-slate-200 p-2 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" aria-label="Next workspace page" disabled={workspacePage === workspacePageCount} onClick={() => setWorkspacePage((page) => Math.min(workspacePageCount, page + 1))} className="rounded-md border border-slate-200 p-2 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">{existingMode ? "Add existing user" : "Create user"} <span className="font-normal text-slate-500">in {selectedWorkspace?.name ?? "this workspace"}</span></h2><button type="button" className="text-sm text-blue-600" onClick={() => setExistingMode((value) => !value)}>{existingMode ? "Create new user" : "Add existing user"}</button></div>
        <form onSubmit={createUser} className="space-y-3">
          {!existingMode ? <Field label="Name"><input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field> : null}
          <Field label="Email"><input required type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {!existingMode ? <Field label="Temporary password"><input required minLength={12} type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} /></Field> : null}
          <Field label="Role"><select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="READ_ONLY">Read only</option><option value="ADMIN">Write</option></select></Field>
          <PrimaryButton type="submit">Add user</PrimaryButton>
        </form>
      </Card>

      <Card className="mt-6 lg:mt-0">
        <div className="divide-y divide-slate-100">
          {users.map((workspaceUser) => (
            <div key={workspaceUser.id} className="flex justify-between gap-4 p-4 text-sm">
              <span className="min-w-0"><b>{workspaceUser.name}</b><span className="ml-2 text-slate-500">{workspaceUser.email}</span></span>
              <span className="flex shrink-0 items-center gap-3 text-slate-500"><select aria-label={`Role for ${workspaceUser.name}`} value={workspaceUser.role === "READ_ONLY" ? "READ_ONLY" : "ADMIN"} onChange={(e) => updateRole(workspaceUser, e.target.value as "ADMIN" | "READ_ONLY")} className="rounded border border-slate-200 px-2 py-1 text-xs"><option value="READ_ONLY">Read only</option><option value="ADMIN">Write</option></select><button type="button" className="text-rose-600" onClick={() => setPendingRemoval(workspaceUser)}>Remove</button></span>
            </div>
          ))}
        </div>
      </Card>
      </div>
      <Modal open={Boolean(pendingRemoval)} title="Remove user from workspace?" onClose={() => removing ? undefined : setPendingRemoval(null)}>
        {pendingRemoval ? <div className="space-y-4"><p className="text-sm leading-6 text-slate-600">Remove <b>{pendingRemoval.name}</b> from <b>{selectedWorkspace?.name}</b>? Their account and access to other workspaces will remain unchanged.</p><div className="flex justify-end gap-2"><button type="button" disabled={removing} onClick={() => setPendingRemoval(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 disabled:opacity-50">Cancel</button><PrimaryButton type="button" disabled={removing} onClick={() => removeUser(pendingRemoval.id)} className="bg-rose-600 hover:bg-rose-700">{removing ? "Removing..." : "Remove user"}</PrimaryButton></div></div> : null}
      </Modal>
      <Modal open={Boolean(pendingWorkspaceAction)} title={pendingWorkspaceAction?.type === "delete" ? "Delete workspace permanently?" : pendingWorkspaceAction?.workspace.isRestricted ? "Unrestrict workspace?" : "Restrict workspace?"} onClose={() => workspaceActionBusy ? undefined : setPendingWorkspaceAction(null)}>
        {pendingWorkspaceAction ? <div className="space-y-4"><p className="text-sm leading-6 text-slate-600">{pendingWorkspaceAction.type === "delete" ? <>This permanently deletes <b>{pendingWorkspaceAction.workspace.name}</b> and all of its data. This cannot be undone.</> : <>While <b>{pendingWorkspaceAction.workspace.name}</b> is restricted, users cannot perform business operations in it.</>}</p><div className="flex justify-end gap-2"><button type="button" disabled={workspaceActionBusy} onClick={() => setPendingWorkspaceAction(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 disabled:opacity-50">Cancel</button><PrimaryButton type="button" disabled={workspaceActionBusy} onClick={confirmWorkspaceAction} className={pendingWorkspaceAction.type === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}>{workspaceActionBusy ? "Applying..." : pendingWorkspaceAction.type === "delete" ? "Delete permanently" : pendingWorkspaceAction.workspace.isRestricted ? "Unrestrict workspace" : "Restrict workspace"}</PrimaryButton></div></div> : null}
      </Modal>
    </div>
  );
}
