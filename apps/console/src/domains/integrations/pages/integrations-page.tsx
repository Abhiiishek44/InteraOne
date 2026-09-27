import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { DeleteConfirmDialog } from "@/shared/components/delete-confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  useConnectFacebookLeadAds,
  useConnectGoogleForms,
  useDeleteLeadSource,
  useLeadSources,
  useSyncFacebookLeadForms,
  useUpdateLeadSourceForm,
} from "@/domains/channels/hooks/use-channels";
import type { LeadSourceConnection } from "@/domains/channels/types/types";

type Provider = "facebook_lead_ads" | "google_forms";

function FacebookLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#1877F2" />
      <path
        fill="#fff"
        d="M32.6 30.4 33.7 24h-6.1v-4.2c0-1.8.9-3.5 3.6-3.5H34v-5.5s-2.5-.4-4.9-.4c-5 0-8.3 3-8.3 8.6v5h-5.6v6.4h5.6V46a22.4 22.4 0 0 0 6.8 0V30.4h5Z"
      />
    </svg>
  );
}

function GoogleFormsLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#7248B9" d="M10 3h19l10 10v32H10z" />
      <path fill="#A487D5" d="M29 3v10h10z" />
      <g fill="#fff">
        <rect x="16" y="21" width="4" height="4" rx="1" />
        <rect x="23" y="21" width="10" height="3" rx="1.5" />
        <rect x="16" y="29" width="4" height="4" rx="1" />
        <rect x="23" y="29" width="10" height="3" rx="1.5" />
        <rect x="16" y="37" width="4" height="4" rx="1" />
        <rect x="23" y="37" width="10" height="3" rx="1.5" />
      </g>
    </svg>
  );
}

const providers = [
  {
    id: "facebook_lead_ads" as const,
    name: "Facebook Lead Ads",
    brand: "Meta",
    description:
      "Send instant-form submissions directly into your CRM as qualified contacts.",
    benefit: "Capture leads automatically",
    icon: FacebookLogo,
  },
  {
    id: "google_forms" as const,
    name: "Google Forms",
    brand: "Google Workspace",
    description:
      "Turn every new form response into a structured lead without manual data entry.",
    benefit: "Import responses instantly",
    icon: GoogleFormsLogo,
  },
];

function ResultBanner({ success, text }: { success: boolean; text: string }) {
  const Icon = success ? CheckCircle2 : XCircle;
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
        success
          ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300"
          : "border-destructive/20 bg-destructive/[0.06] text-destructive"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}

function ConnectedSource({
  source,
  provider,
  syncing,
  updating,
  deleting,
  onSync,
  onDelete,
  onUpdate,
}: {
  source: LeadSourceConnection;
  provider: Provider;
  syncing: boolean;
  updating: boolean;
  deleting: boolean;
  onSync: () => void;
  onDelete: () => void;
  onUpdate: (
    formId: string,
    payload: {
      status?: "active" | "paused";
      defaults?: { createOpportunity: boolean };
    },
  ) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between gap-3 bg-muted/25 px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="truncate text-sm font-semibold">{source.name}</p>
            <span className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {source.forms.length} form{source.forms.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={syncing}
            onClick={onSync}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            Sync
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            disabled={deleting}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="divide-y">
        {source.forms.length ? (
          source.forms.map((form) => (
            <div
              key={form.id}
              className="flex flex-col gap-2 px-3.5 py-2.5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${form.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                  {form.externalFormName}
                </p>
                <p className="mt-0.5 pl-3.5 text-[11px] text-muted-foreground">
                  {form.status === "active"
                    ? "Importing responses"
                    : "Import paused"}
                  {form.defaults.createOpportunity
                    ? " · Creates opportunities"
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {provider === "facebook_lead_ads" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                    disabled={updating}
                    onClick={() =>
                      onUpdate(form.id, {
                        defaults: {
                          createOpportunity: !form.defaults.createOpportunity,
                        },
                      })
                    }
                  >
                    {form.defaults.createOpportunity
                      ? "Contact + opportunity"
                      : "Contact only"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2.5 text-xs"
                  disabled={updating}
                  onClick={() =>
                    onUpdate(form.id, {
                      status: form.status === "active" ? "paused" : "active",
                    })
                  }
                >
                  {form.status === "active" ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {form.status === "active" ? "Pause" : "Resume"}
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="px-4 py-5 text-center text-xs text-muted-foreground">
            No forms found for this connection.
          </p>
        )}
      </div>
    </section>
  );
}

export function IntegrationsPage() {
  const { data: leadSources = [], isLoading } = useLeadSources();
  const connectFacebook = useConnectFacebookLeadAds();
  const connectGoogle = useConnectGoogleForms();
  const syncForms = useSyncFacebookLeadForms();
  const updateForm = useUpdateLeadSourceForm();
  const deleteSource = useDeleteLeadSource();
  const [query, setQuery] = useState("");
  const [sourceToDelete, setSourceToDelete] =
    useState<LeadSourceConnection | null>(null);
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);

  const params = new URLSearchParams(window.location.search);
  const facebookResult = params.get("facebook");
  const googleResult = params.get("google");
  const oauthError = params.get("message");
  const shownProviders = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search
      ? providers.filter((item) =>
          `${item.name} ${item.brand} ${item.description}`
            .toLowerCase()
            .includes(search),
        )
      : providers;
  }, [query]);
  const connectedCount = new Set(leadSources.map((source) => source.provider))
    .size;

  const connect = (provider: Provider) =>
    provider === "facebook_lead_ads"
      ? connectFacebook.mutate()
      : connectGoogle.mutate();
  const isConnecting = (provider: Provider) =>
    provider === "facebook_lead_ads"
      ? connectFacebook.isPending
      : connectGoogle.isPending;
  const connectionError = (provider: Provider) =>
    provider === "facebook_lead_ads"
      ? connectFacebook.error
      : connectGoogle.error;
  const selectedProvider = providers.find(
    (provider) => provider.id === activeProvider,
  );
  const selectedSources = activeProvider
    ? leadSources.filter((source) => source.provider === activeProvider)
    : [];
  const SelectedProviderIcon = selectedProvider?.icon;
  return (
    <div className="integration-water-surface mx-auto max-w-6xl space-y-6 pb-10">
      <section className="space-y-5" data-tour-id="page-integrations-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect apps and automate how leads enter your workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {connectedCount} connected
            </span>
            <label className="relative block w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search integrations"
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
        </div>

        {facebookResult === "connected" && (
          <ResultBanner
            success
            text="Facebook Lead Ads connected successfully."
          />
        )}
        {facebookResult === "error" && (
          <ResultBanner
            success={false}
            text={`Facebook could not be connected.${oauthError ? ` ${oauthError}` : ""}`}
          />
        )}
        {googleResult === "connected" && (
          <ResultBanner success text="Google Forms connected successfully." />
        )}
        {googleResult === "error" && (
          <ResultBanner
            success={false}
            text={`Google Forms could not be connected.${oauthError ? ` ${oauthError}` : ""}`}
          />
        )}

        <div>
          {shownProviders.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {shownProviders.map((provider) => {
                const sources = leadSources.filter(
                  (source) => source.provider === provider.id,
                );
                const connected = sources.length > 0;
                const pending = isConnecting(provider.id);
                const error = connectionError(provider.id);
                const Icon = provider.icon;
                return (
                  <article
                    key={provider.id}
                    data-tour-id={`page-integrations-${
                      provider.id === "facebook_lead_ads"
                        ? "facebook"
                        : "google-forms"
                    }`}
                    className="integration-float-card rounded-xl border bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md"
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background p-1.5 shadow-sm">
                          <Icon className="h-full w-full" />
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            connected
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "border-border bg-background/70 text-muted-foreground"
                          }`}
                        >
                          {connected ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                          )}
                          {connected ? "Connected" : "Not connected"}
                        </span>
                      </div>
                      <div className="mt-4">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {provider.brand}
                        </p>
                        <h3 className="mt-1 text-base font-semibold tracking-tight">
                          {provider.name}
                        </h3>
                        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                          {provider.description}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
                        <span className="text-xs font-medium text-muted-foreground">
                          {provider.benefit}
                        </span>
                        <Button
                          className="h-9 min-w-24 gap-2"
                          variant={connected ? "outline" : "default"}
                          disabled={pending}
                          onClick={() =>
                            connected
                              ? setActiveProvider(provider.id)
                              : connect(provider.id)
                          }
                        >
                          {pending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Settings2 className="h-4 w-4" />
                          )}
                          {connected ? "Manage" : "Connect"}
                        </Button>
                      </div>
                      {error && (
                        <p className="mt-3 text-xs font-medium text-destructive">
                          {error instanceof Error
                            ? error.message
                            : `Could not connect ${provider.name}`}
                        </p>
                      )}
                    </div>
                    {isLoading && (
                      <div className="mx-5 mb-5 h-2 animate-pulse rounded bg-muted" />
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[26px] border border-dashed bg-muted/20 px-6 py-16 text-center">
              <Search className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 font-medium">No integrations found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different app or provider name.
              </p>
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(activeProvider)}
        onOpenChange={(open) => !open && setActiveProvider(null)}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
          {activeProvider && selectedProvider && SelectedProviderIcon && (
            <>
              <DialogHeader className="border-b px-5 py-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background p-1.5">
                    <SelectedProviderIcon className="h-full w-full" />
                  </div>
                  <div>
                    <DialogTitle>{selectedProvider.name}</DialogTitle>
                    <DialogDescription className="mt-0.5">
                      Manage connected accounts, forms, and import settings.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="max-h-[58vh] space-y-3 overflow-y-auto px-5 py-4">
                {selectedSources.map((source) => (
                  <ConnectedSource
                    key={source.id}
                    source={source}
                    provider={activeProvider}
                    syncing={syncForms.isPending}
                    updating={updateForm.isPending}
                    deleting={deleteSource.isPending}
                    onSync={() => syncForms.mutate(source.id)}
                    onDelete={() => setSourceToDelete(source)}
                    onUpdate={(formId, payload) =>
                      updateForm.mutate({ formId, payload })
                    }
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 border-t bg-muted/15 px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  {selectedSources.length} connected account
                  {selectedSources.length === 1 ? "" : "s"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isConnecting(activeProvider)}
                  onClick={() => connect(activeProvider)}
                >
                  {isConnecting(activeProvider) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Connect another
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        isOpen={Boolean(sourceToDelete)}
        onClose={() => setSourceToDelete(null)}
        onConfirm={() => {
          if (!sourceToDelete) return;
          deleteSource.mutate(sourceToDelete.id, {
            onSuccess: () => setSourceToDelete(null),
          });
        }}
        title="Disconnect integration?"
        description={`Disconnect “${sourceToDelete?.name || "this integration"}”? New responses will stop importing until it is connected again.`}
        isDeleting={deleteSource.isPending}
      />
    </div>
  );
}
