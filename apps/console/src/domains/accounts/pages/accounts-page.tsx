import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Building2, Filter, MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAccounts, useCreateAccount } from "../hooks/use-accounts";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Loader } from "@/shared/ui/loader";

const emptyForm = { name: "", address: "", website: "", industry: "" };

export function AccountsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { data, isLoading } = useAccounts(search, 100);
  const createAccount = useCreateAccount();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const created = await createAccount.mutateAsync(form);
      toast.success("Organization created");
      setOpen(false);
      setForm(emptyForm);
      navigate(`/dashboard/crm/organizations/${created._id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create organization");
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Organizations</h1><p className="text-sm text-muted-foreground">Manage organizations, people, deals, and upcoming activity.</p></div>
      <div className="flex items-center gap-2"><span className="text-sm font-semibold">{data?.total || 0} organizations</span><Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filter</Button><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Organization</Button></div>
    </div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search organizations…" className="pl-9" /></div>
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      {isLoading ? <div className="flex justify-center py-16"><Loader size="lg" /></div> : data?.accounts.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1120px] border-collapse text-sm"><thead className="bg-muted/50 text-left"><tr><th className="w-10 border-b border-r p-3"><input type="checkbox" aria-label="Select all organizations" /></th><th className="min-w-64 border-b border-r p-3 font-semibold">Name</th><th className="min-w-64 border-b border-r p-3 font-semibold">Address</th><th className="min-w-48 border-b border-r p-3 font-semibold">Owner</th><th className="w-28 border-b border-r p-3 font-semibold">People</th><th className="w-32 border-b border-r p-3 font-semibold">Closed deals</th><th className="w-32 border-b border-r p-3 font-semibold">Open deals</th><th className="min-w-44 border-b border-r p-3 font-semibold">Next activity</th><th className="w-12 border-b p-3" /></tr></thead><tbody>{data.accounts.map((organization) => <tr key={organization.id} className="group hover:bg-muted/30"><td className="border-b border-r p-3"><input type="checkbox" aria-label={`Select ${organization.name}`} /></td><td className="border-b border-r p-3"><Link to={`/dashboard/crm/organizations/${organization.id}`} className="flex items-center gap-2 font-medium text-primary hover:underline"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700"><Building2 className="h-4 w-4" /></span>{organization.name}</Link></td><td className="border-b border-r p-3 text-muted-foreground">{organization.address || "—"}</td><td className="border-b border-r p-3">{organization.owner?.name || "Unassigned"}</td><td className="border-b border-r p-3">{organization.contactCount}</td><td className="border-b border-r p-3">{organization.closedDeals}</td><td className="border-b border-r p-3">{organization.openDeals}</td><td className="border-b border-r p-3 text-muted-foreground">{organization.nextActivityAt ? new Date(organization.nextActivityAt).toLocaleDateString() : "—"}</td><td className="border-b p-2"><Button variant="ghost" size="icon-xs" aria-label={`More actions for ${organization.name}`}><MoreHorizontal className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div> : <div className="py-16 text-center text-muted-foreground"><Building2 className="mx-auto mb-3 h-8 w-8" /><p>No organizations found.</p></div>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add organization</DialogTitle><DialogDescription>Create an organization profile and connect people and deals.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="grid gap-2"><Label htmlFor="organization-name">Organization name *</Label><Input id="organization-name" required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="organization-address">Address</Label><Input id="organization-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="organization-website">Website</Label><Input id="organization-website" type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="organization-industry">Industry</Label><Input id="organization-industry" value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={createAccount.isPending}>{createAccount.isPending ? "Creating…" : "Create organization"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
