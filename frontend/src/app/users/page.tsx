"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ManagedUser } from "@/lib/api";
import { Card, Field, PageHeader, PrimaryButton, inputClass } from "@/components/ui";

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState<"ADMIN" | "READ_ONLY">("READ_ONLY");

  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() { const users = await api.get<ManagedUser[]>("/auth/users"); setUsers(users); }
  useEffect(() => {
    void api.get<ManagedUser[]>("/auth/users")
      .then((users) => setUsers(users))
      .catch((e: Error) => setError(e.message));
  }, []);
  async function createUser(e: FormEvent) { e.preventDefault(); try { await api.post("/auth/users", { name, email, password, role }); setName(""); setEmail(""); setPassword(""); setMessage("User added to this workspace."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  const removeUser = async (id: string) => { if (!confirm("Remove this user from the workspace?")) return; try { await api.delete(`/auth/users/${id}`); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } };
  return <div><PageHeader title="Users" subtitle="Create users and assign their access for the active workspace." />{error ? <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card> : null}{message ? <Card className="mb-4 p-3 text-sm text-emerald-600">{message}</Card> : null}<Card className="max-w-xl p-5"><h2 className="mb-4 font-semibold">Add user to this workspace</h2><form onSubmit={createUser} className="space-y-3"><Field label="Name"><input required className={inputClass} value={name} onChange={e=>setName(e.target.value)} /></Field><Field label="Email"><input required type="email" className={inputClass} value={email} onChange={e=>setEmail(e.target.value)} /></Field><Field label="Temporary password"><input required minLength={12} type="password" className={inputClass} value={password} onChange={e=>setPassword(e.target.value)} /></Field><Field label="Role"><select className={inputClass} value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="READ_ONLY">Read only</option><option value="ADMIN">Admin</option></select></Field><PrimaryButton type="submit">Add user</PrimaryButton></form></Card><Card className="mt-6"><div className="divide-y divide-slate-100">{users.map(u=><div key={u.id} className="flex justify-between p-4 text-sm"><span><b>{u.name}</b><span className="ml-2 text-slate-500">{u.email}</span></span><span className="flex gap-3 text-slate-500">{u.role}<button className="text-rose-600" onClick={()=>removeUser(u.id)}>Remove</button></span></div>)}</div></Card></div>;
}
