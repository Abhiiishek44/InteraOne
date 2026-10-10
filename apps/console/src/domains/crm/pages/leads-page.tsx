import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  CalendarClock,
  CircleDollarSign,
  Filter,
  Flame,
  MoreHorizontal,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { LeadDialog } from "../components/lead-dialog";
import { useLeads } from "../hooks/use-opportunities";

const labelClass = (label: string) => {
  if (/hot/i.test(label))
    return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";
  if (/warm/i.test(label))
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function LeadsPage() {
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useLeads();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [labelFilter, setLabelFilter] = useState("all");

  const labels = useMemo(
    () => [...new Set(leads.flatMap((lead) => lead.labels || []))].sort(),
    [leads],
  );
  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesLabel =
        labelFilter === "all" || lead.labels?.includes(labelFilter);
      const matchesSearch =
        !query ||
        [
          lead.title,
          lead.contact?.name,
          lead.contact?.email,
          lead.company,
          lead.owner?.name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      return matchesLabel && matchesSearch;
    });
  }, [labelFilter, leads, search]);
  const totalValue = leads.reduce((sum, lead) => sum + lead.value, 0);

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-emerald-500/[0.07] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
                <Badge variant="secondary" className="rounded-full">
                  {leads.length}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Qualify new opportunities before moving them into Deals.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => setDialogOpen(true)}
            className="shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" /> Add lead
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Active leads"
          value={String(leads.length)}
          icon={UserRound}
        />
        <Stat
          label="Total lead value"
          value={money(totalValue, leads[0]?.currency || "INR")}
          icon={CircleDollarSign}
        />
        <Stat
          label="Due next"
          value={String(leads.filter((lead) => lead.expectedCloseAt).length)}
          icon={CalendarClock}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search leads by title, person, organization, email, or owner"
              className="bg-muted/25 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={labelFilter} onValueChange={setLabelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All labels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All labels</SelectItem>
                {labels.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead className="bg-muted/45 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 border-b p-3">
                    <input type="checkbox" aria-label="Select all leads" />
                  </th>
                  <th className="min-w-60 border-b p-3 font-semibold">Title</th>
                  <th className="min-w-48 border-b p-3 font-semibold">
                    Contact person
                  </th>
                  <th className="min-w-48 border-b p-3 font-semibold">
                    Organization
                  </th>
                  <th className="min-w-44 border-b p-3 font-semibold">
                    Next activity
                  </th>
                  <th className="min-w-40 border-b p-3 font-semibold">
                    Labels
                  </th>
                  <th className="min-w-40 border-b p-3 font-semibold">
                    Source origin
                  </th>
                  <th className="min-w-40 border-b p-3 font-semibold">
                    Lead created
                  </th>
                  <th className="min-w-44 border-b p-3 font-semibold">Owner</th>
                  <th className="w-12 border-b p-3" />
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const nextActivity = lead.activities
                    .filter(
                      (activity) => activity.dueAt && !activity.completedAt,
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.dueAt!).getTime() -
                        new Date(b.dueAt!).getTime(),
                    )[0];
                  return (
                    <tr
                      key={lead.id}
                      onClick={() =>
                        navigate(`/dashboard/crm/leads/${lead.id}`)
                      }
                      className="cursor-pointer border-b transition-colors hover:bg-muted/35"
                    >
                      <td
                        className="p-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${lead.title}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-primary">
                          {lead.title}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {money(lead.value, lead.currency)}
                        </div>
                      </td>
                      <td className="p-3">{lead.contact?.name || "—"}</td>
                      <td className="p-3">{lead.company || "—"}</td>
                      <td className="p-3">
                        {nextActivity ? (
                          <span className="text-emerald-700 dark:text-emerald-300">
                            {new Date(nextActivity.dueAt!).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-amber-600">No activity</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {lead.labels?.length ? (
                            lead.labels.map((label) => (
                              <span
                                key={label}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${labelClass(label)}`}
                              >
                                {label}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {lead.sourceOrigin === "manual"
                          ? "Manually created"
                          : lead.sourceOrigin}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        {lead.owner?.name || "Unassigned"}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`More actions for ${lead.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!isLoading && filteredLeads.length === 0 && (
            <div className="py-16 text-center">
              <Flame className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No leads found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a lead or adjust your search.
              </p>
            </div>
          )}
          {isLoading && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading leads…
            </div>
          )}
        </CardContent>
      </Card>

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => navigate(`/dashboard/crm/leads/${id}`)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
        </div>
        <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}
