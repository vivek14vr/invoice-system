"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, Company, ManagedUser } from "@/lib/api";
import { Card, Field, PageHeader, PrimaryButton, inputClass } from "@/components/ui";

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState<"ADMIN" | "READ_ONLY">("READ_ONLY");
  const [companyId, setCompanyId] = useState(""); const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function load() { const [u, c] = await Promise.all([api.get<ManagedUser[]>("/auth/users"), api.get<Company[]>("/auth/companies")]); setUsers(u); setCompanies(c); if (!companyId && c[0]) setCompanyId(c[0].id); }
  useEffect(() => {
    void Promise.all([api.get<ManagedUser[]>("/auth/users"), api.get<Company[]>("/auth/companies")])
      .then(([u, c]) => { setUsers(u); setCompanies(c); if (c[0]) setCompanyId(c[0].id); })
      .catch((e: Error) => setError(e.message));
  }, []);
  async function createUser(e: FormEvent) { e.preventDefault(); try { await api.post("/auth/users", { name, email, password, role, companyId }); setName(""); setEmail(""); setPassword(""); setMessage("User created."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function createCompany(e: FormEvent) { e.preventDefault(); try { await api.post("/auth/companies", { name: companyName }); setCompanyName(""); setMessage("Company created."); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  const removeUser = async (id: string) => { if (!confirm("Delete this user?")) return; await api.delete(`/auth/users/${id}`); await load(); };
  return <div><PageHeader title="Users & Companies" subtitle="Create users, assign roles, and manage companies." />{error ? <Card className="mb-4 p-3 text-sm text-rose-600">{error}</Card> : null}{message ? <Card className="mb-4 p-3 text-sm text-emerald-600">{message}</Card> : null}<div className="grid gap-6 lg:grid-cols-2"><Card className="p-5"><h2 className="mb-4 font-semibold">Create user</h2><form onSubmit={createUser} className="space-y-3"><Field label="Name"><input required className={inputClass} value={name} onChange={e=>setName(e.target.value)} /></Field><Field label="Email"><input required type="email" className={inputClass} value={email} onChange={e=>setEmail(e.target.value)} /></Field><Field label="Temporary password"><input required minLength={12} type="password" className={inputClass} value={password} onChange={e=>setPassword(e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Role"><select className={inputClass} value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="READ_ONLY">Read only</option><option value="ADMIN">Admin</option></select></Field><Field label="Company"><select className={inputClass} value={companyId} onChange={e=>setCompanyId(e.target.value)}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div><PrimaryButton type="submit">Create user</PrimaryButton></form></Card><Card className="p-5"><h2 className="mb-4 font-semibold">Create company</h2><form onSubmit={createCompany} className="flex gap-2"><input required className={inputClass} placeholder="Company name" value={companyName} onChange={e=>setCompanyName(e.target.value)} /><PrimaryButton type="submit">Add</PrimaryButton></form><div className="mt-5 space-y-2">{companies.map(c=><div key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">{c.name}</div>)}</div></Card></div><Card className="mt-6"><div className="divide-y divide-slate-100">{users.map(u=><div key={u.id} className="flex justify-between p-4 text-sm"><span><b>{u.name}</b><span className="ml-2 text-slate-500">{u.email}</span></span><span className="flex gap-3 text-slate-500">{u.role} · {u.company?.name ?? "No company"}<button className="text-rose-600" onClick={()=>removeUser(u.id)}>Delete</button></span></div>)}</div></Card></div>;
}
