import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Megaphone,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  useConnectFacebookLeadAds,
  useConnectGoogleForms,
  useDeleteLeadSource,
  useLeadSources,
  useSyncFacebookLeadForms,
  useUpdateLeadSourceForm,
} from "@/domains/channels/hooks/use-channels";

export function IntegrationsPage() {
  const { data: leadSources = [], isLoading } = useLeadSources();
  const connectFacebook = useConnectFacebookLeadAds();
  const connectGoogle = useConnectGoogleForms();
  const syncForms = useSyncFacebookLeadForms();
  const updateForm = useUpdateLeadSourceForm();
  const deleteSource = useDeleteLeadSource();
  const [deletingId, setDeletingId] = useState<string>();

  const facebookSources = leadSources.filter(
    (source) => source.provider === "facebook_lead_ads",
  );
  const googleSources = leadSources.filter(
    (source) => source.provider === "google_forms",
  );
  const params = new URLSearchParams(window.location.search);
  const oauthResult = params.get("facebook");
  const oauthError = params.get("message");
  const googleOauthResult = params.get("google");

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <div
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        data-tour-id="page-integrations-heading"
      >
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Business integrations
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              Connect the tools that power your workflow
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
              Bring leads and business data into InteraOne while keeping your
              messaging channels managed separately.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-muted/25 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
              <Megaphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </span>
            <div>
              <p className="text-xl font-bold leading-none text-foreground">
                {facebookSources.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Facebook Pages connected
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3" data-tour-id="page-integrations-facebook">
        <div className="px-1">
          <h2 className="text-base font-semibold text-foreground">
            Facebook Lead Ads
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Create CRM contacts automatically from Facebook instant-form submissions.
          </p>
        </div>

        {oauthResult === "connected" && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Facebook Pages connected and subscribed successfully.
          </div>
        )}
        {oauthResult === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>
              Facebook could not be connected.
              {oauthError
                ? ` ${oauthError}`
                : " Check the Meta app permissions and try again."}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        ) : facebookSources.length ? (
          <div className="space-y-4">
            {facebookSources.map((source) => (
              <div
                key={source.id}
                className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/5">
                      <Megaphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-foreground">{source.name}</p>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {source.forms.length} instant form{source.forms.length === 1 ? "" : "s"} connected
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={syncForms.isPending}
                      onClick={() => syncForms.mutate(source.id)}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncForms.isPending ? "animate-spin" : ""}`} />
                      Sync forms
                    </Button>
                    {deletingId === source.id ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleteSource.isPending}
                        onClick={() => deleteSource.mutate(source.id, { onSuccess: () => setDeletingId(undefined) })}
                      >
                        Confirm disconnect
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeletingId(source.id)}
                        title="Disconnect Facebook Page"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="divide-y rounded-lg border border-border">
                  {source.forms.length ? source.forms.map((form) => (
                    <div key={form.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{form.externalFormName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {form.status === "active" ? "New responses create CRM contacts" : "Lead imports are paused"}
                          {form.defaults.createOpportunity ? " and opportunities" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" disabled={updateForm.isPending} onClick={() => updateForm.mutate({ formId: form.id, payload: { defaults: { createOpportunity: !form.defaults.createOpportunity } } })}>
                          {form.defaults.createOpportunity ? "Contact + opportunity" : "Contact only"}
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1.5" disabled={updateForm.isPending} onClick={() => updateForm.mutate({ formId: form.id, payload: { status: form.status === "active" ? "paused" : "active" } })}>
                          {form.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          {form.status === "active" ? "Pause" : "Resume"}
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <p className="px-4 py-5 text-center text-sm text-muted-foreground">No instant forms were returned for this Page.</p>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" className="gap-2" disabled={connectFacebook.isPending} onClick={() => connectFacebook.mutate()}>
              {connectFacebook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Connect another Facebook Page
            </Button>
          </div>
        ) : (
          <button
            type="button"
            id="btn-connect-facebook-leads"
            disabled={connectFacebook.isPending}
            onClick={() => connectFacebook.mutate()}
            className="group flex w-full cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500/35 hover:shadow-md disabled:pointer-events-none disabled:opacity-60 sm:p-6"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/5">
              {connectFacebook.isPending ? <Loader2 className="h-6 w-6 animate-spin text-blue-600" /> : <Megaphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">Connect Facebook Lead Ads</p>
              <p className="mt-1 text-sm text-muted-foreground">Import instant-form submissions directly into Contacts.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
              Connect <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        )}

        {connectFacebook.isError && (
          <p className="px-1 text-xs font-medium text-destructive">
            {connectFacebook.error instanceof Error ? connectFacebook.error.message : "Could not start Facebook connection"}
          </p>
        )}
      </section>

      <section className="space-y-3" data-tour-id="page-integrations-google-forms">
        <div className="px-1">
          <h2 className="text-base font-semibold text-foreground">Google Forms</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Turn new responses from your Google Forms into CRM leads automatically.
          </p>
        </div>

        {googleOauthResult === "connected" && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Google Forms connected successfully.
          </div>
        )}
        {googleOauthResult === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Google Forms could not be connected.{oauthError ? ` ${oauthError}` : ""}</span>
          </div>
        )}

        {isLoading ? (
          <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        ) : googleSources.length ? (
          <div className="space-y-4">
            {googleSources.map((source) => (
              <div key={source.id} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xl font-bold text-emerald-600">G</div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{source.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {source.forms.length} form{source.forms.length === 1 ? "" : "s"} discovered
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={syncForms.isPending} onClick={() => syncForms.mutate(source.id)}>
                      <RefreshCw className={`h-3.5 w-3.5 ${syncForms.isPending ? "animate-spin" : ""}`} />
                      Refresh forms
                    </Button>
                    {deletingId === source.id ? (
                      <Button size="sm" variant="destructive" disabled={deleteSource.isPending} onClick={() => deleteSource.mutate(source.id, { onSuccess: () => setDeletingId(undefined) })}>
                        Confirm disconnect
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeletingId(source.id)} title="Disconnect Google Forms">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="divide-y rounded-lg border border-border">
                  {source.forms.length ? source.forms.map((form) => (
                    <div key={form.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{form.externalFormName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">New responses are imported automatically</p>
                      </div>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Active</span>
                    </div>
                  )) : <p className="px-4 py-5 text-center text-sm text-muted-foreground">No Google Forms were found in this account.</p>}
                </div>
              </div>
            ))}
            <Button variant="outline" className="gap-2" disabled={connectGoogle.isPending} onClick={() => connectGoogle.mutate()}>
              {connectGoogle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Connect another Google account
            </Button>
          </div>
        ) : (
          <button type="button" disabled={connectGoogle.isPending} onClick={() => connectGoogle.mutate()} className="group flex w-full cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/35 hover:shadow-md disabled:pointer-events-none disabled:opacity-60 sm:p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xl font-bold text-emerald-600">
              {connectGoogle.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "G"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">Connect Google Forms</p>
              <p className="mt-1 text-sm text-muted-foreground">Authorize a Google account and discover its forms.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-600">
              Connect <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        )}

        {connectGoogle.isError && (
          <p className="px-1 text-xs font-medium text-destructive">
            {connectGoogle.error instanceof Error ? connectGoogle.error.message : "Could not start Google connection"}
          </p>
        )}
      </section>
    </div>
  );
}
