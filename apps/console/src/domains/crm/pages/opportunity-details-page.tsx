import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Mail,
  Phone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import {
  useOpportunities,
  useSalesPipeline,
  useUpdateOpportunityStage,
} from "../hooks/use-opportunities";
import type { Opportunity } from "../types/types";

const formatMoney = (value: number, currency: Opportunity["currency"]) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function OpportunityDetailsPage() {
  const navigate = useNavigate();
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { data: opportunities = [], isLoading } = useOpportunities();
  const { data: pipeline, isLoading: pipelineLoading } = useSalesPipeline();
  const updateStage = useUpdateOpportunityStage();
  const opportunity = opportunities.find((item) => item.id === opportunityId);
  const stages = pipeline?.stages || [];
  const currentStageIndex = stages.findIndex(
    (stage) => stage.id === opportunity?.stage,
  );
  const currentStage = stages[currentStageIndex];

  const changeStage = async (stage: string) => {
    if (!opportunity || stage === opportunity.stage) return;
    try {
      await updateStage.mutateAsync({ id: opportunity.id, stage });
      toast.success(
        `Opportunity moved to ${stages.find((item) => item.id === stage)?.label || "stage"}`,
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change stage",
      );
    }
  };

  if (isLoading || pipelineLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
        Loading opportunity…
      </div>
    );
  }

  if (!opportunity) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <h1 className="text-lg font-semibold">Opportunity not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been removed or is not available in this organization.
          </p>
          <Button
            className="mt-5"
            onClick={() => navigate("/dashboard/crm/pipeline")}
          >
            Back to pipeline
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate("/dashboard/crm/pipeline")}
            title="Back to pipeline"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{opportunity.title}</h1>
              <Badge variant="outline">
                {currentStage?.label || opportunity.stage}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {opportunity.contact?.name || "Unknown contact"}
              {opportunity.company ? ` · ${opportunity.company}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Stage</span>
          <select
            value={opportunity.stage}
            onChange={(event) => void changeStage(event.target.value)}
            disabled={updateStage.isPending}
            className="h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm"
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pipeline progress — select a stage to move this opportunity
        </p>
        <div className="overflow-x-auto rounded-lg border bg-muted/15 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center px-1">
            {stages.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => void changeStage(stage.id)}
                disabled={updateStage.isPending}
                style={{
                  clipPath:
                    index === 0
                      ? "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)"
                      : "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)",
                }}
                className={`relative min-w-40 py-3 pl-6 pr-7 text-center text-xs font-semibold transition-colors first:pl-4 ${index > 0 ? "-ml-3" : ""} ${
                  index === currentStageIndex
                    ? "z-20 bg-primary text-primary-foreground shadow-sm"
                    : index < currentStageIndex
                      ? "z-10 bg-primary/15 text-primary hover:bg-primary/25"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={CircleDollarSign}
          label="Opportunity value"
          value={formatMoney(opportunity.value, opportunity.currency)}
        />
        <MetricCard
          icon={CalendarDays}
          label="Expected close"
          value={
            opportunity.expectedCloseAt
              ? new Date(opportunity.expectedCloseAt).toLocaleDateString()
              : "No close date"
          }
        />
        <MetricCard
          icon={UserRound}
          label="Opportunity owner"
          value={opportunity.owner?.name || "Unassigned"}
          supporting={opportunity.owner?.email}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Contact and company</h2>
          </div>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
            <InfoRow
              icon={UserRound}
              label="Contact"
              value={opportunity.contact?.name || "Unknown contact"}
            />
            <InfoRow
              icon={Building2}
              label="Company"
              value={
                opportunity.company ||
                opportunity.contact?.company ||
                "Not provided"
              }
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={opportunity.contact?.email || "Not provided"}
            />
            <InfoRow
              icon={Phone}
              label="Phone"
              value={opportunity.contact?.phone || "Not provided"}
            />
          </CardContent>
        </Card>

        <Card>
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Next action</h2>
          </div>
          <CardContent className="p-5">
            <p className="min-h-20 whitespace-pre-wrap text-sm text-muted-foreground">
              {opportunity.nextAction || "No next action has been added."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Clock3 className="h-4 w-4" /> Record activity
          </h2>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Created {new Date(opportunity.createdAt).toLocaleString()}</p>
            <p>
              Last updated {new Date(opportunity.updatedAt).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  supporting,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  supporting?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </p>
        <p className="mt-2 text-xl font-semibold">{value}</p>
        {supporting && (
          <p className="mt-1 text-xs text-muted-foreground">{supporting}</p>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}
