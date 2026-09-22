import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Building2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAccounts, useCreateAccount } from "../hooks/use-accounts";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Loader } from "@/shared/ui/loader";

export function AccountsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", website: "", industry: "" });
  const { data, isLoading } = useAccounts(search, 100);
  const createAccount = useCreateAccount();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const created = await createAccount.mutateAsync(form);
      toast.success("Company created");
      setOpen(false);
      setForm({ name: "", website: "", industry: "" });
      navigate(`/dashboard/crm/companies/${created._id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create company");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-muted-foreground">Manage customer accounts, people, opportunities, and activity.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="cursor-pointer"><Plus className="mr-2 h-4 w-4" />Add company</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies…" className="pl-9" />
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader size="lg" /></div> : data?.accounts.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.accounts.map((account) => (
            <Link key={account.id} to={`/dashboard/crm/companies/${account.id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2"><Building2 className="h-5 w-5 text-primary" /></div>
                      <div className="min-w-0"><CardTitle className="truncate text-base">{account.name}</CardTitle><p className="truncate text-sm text-muted-foreground">{account.industry || account.domain || "No industry added"}</p></div>
                    </div>
                    <Badge variant="outline" className="capitalize">{account.lifecycleStage}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div><p className="font-semibold">{account.contactCount}</p><p className="text-xs text-muted-foreground">Contacts</p></div>
                  <div><p className="font-semibold">{account.opportunityCount}</p><p className="text-xs text-muted-foreground">Deals</p></div>
                  <div><p className="font-semibold">{account.pipelineValue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Pipeline</p></div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground"><Building2 className="mx-auto mb-3 h-8 w-8" /><p>No companies found.</p></div>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add company</DialogTitle><DialogDescription>Create a shared profile for contacts and opportunities.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-2"><Label htmlFor="company-name">Company name</Label><Input id="company-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="company-website">Website</Label><Input id="company-website" type="url" placeholder="https://example.com" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="company-industry">Industry</Label><Input id="company-industry" value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={createAccount.isPending}>{createAccount.isPending ? "Creating…" : "Create company"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
