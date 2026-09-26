"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Clock,
  MessageCircle,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { SectionHeader } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { EmptyState, InlineLoader } from "@/components/shared/states";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage } from "@/lib/api";
import type {
  WhatsAppMessageRecord,
  WhatsAppOverview,
  WhatsAppStatus,
  WhatsAppTemplate,
} from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

/**
 * WhatsApp integration status and delivery log.
 *
 * The panel reports what the server actually did. When no provider credentials
 * are configured, messages are recorded by the development adapter and every
 * row here is labelled "Simulated" — the interface never presents a simulated
 * message as a delivered one.
 */

const statusTone: Record<WhatsAppStatus, "muted" | "accent" | "success" | "destructive"> = {
  QUEUED: "muted",
  SENT: "accent",
  DELIVERED: "success",
  READ: "success",
  FAILED: "destructive",
};

const statusIcon: Record<WhatsAppStatus, typeof Clock> = {
  QUEUED: Clock,
  SENT: Send,
  DELIVERED: CheckCircle2,
  READ: CheckCheck,
  FAILED: XCircle,
};

export function WhatsAppStatusBadge({ status }: { status: WhatsAppStatus }) {
  const Icon = statusIcon[status] ?? Clock;
  return (
    <Badge variant={statusTone[status] ?? "muted"} size="sm">
      <Icon aria-hidden />
      {status}
    </Badge>
  );
}

/** Compact delivery list — reused on the booking detail dialog. */
export function WhatsAppDeliveryList({
  messages,
  onRetry,
  retrying,
}: {
  messages: WhatsAppMessageRecord[];
  onRetry?: (id: string) => void;
  retrying?: string | null;
}) {
  if (messages.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No WhatsApp messages have been sent for this booking.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {messages.map((message) => (
        <li key={message.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{message.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDateTime(message.sentAt ?? message.createdAt)}
              {message.attempts > 1 ? ` · ${message.attempts} attempts` : ""}
            </p>
            {message.errorMessage ? (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-destructive">
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
                {message.errorMessage}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {message.simulated ? (
              <Badge variant="outline" size="sm" title="Recorded locally — no provider configured">
                Simulated
              </Badge>
            ) : null}
            <WhatsAppStatusBadge status={message.status} />
            {message.status === "FAILED" && onRetry ? (
              <Button
                variant="outline"
                size="sm"
                loading={retrying === message.id}
                onClick={() => onRetry(message.id)}
              >
                Retry
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * Settings panel
 * ------------------------------------------------------------------ */

export function WhatsAppPanel() {
  const { db } = useData();

  const [overview, setOverview] = React.useState<WhatsAppOverview | null>(null);
  const [testNumber, setTestNumber] = React.useState("");
  const [testCode, setTestCode] = React.useState("+91");
  const [testing, setTesting] = React.useState(false);
  const [retrying, setRetrying] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<WhatsAppTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);

  // Loaded on demand: eight full message bodies are a lot to carry on a
  // settings page nobody has asked to see them on.
  const loadTemplates = React.useCallback(async () => {
    setLoadingTemplates(true);
    try {
      setTemplates(await api.whatsappTemplates());
    } catch (error) {
      toast.error(errorMessage(error, "The message templates could not be loaded."));
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      setOverview(await api.whatsapp(25));
    } catch {
      setOverview(null);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load, db.syncedAt]);

  async function sendTest() {
    if (!testNumber.trim()) {
      toast.error("Enter a WhatsApp number to test.");
      return;
    }
    setTesting(true);
    try {
      const result = await api.sendWhatsAppTest(testCode, testNumber);
      if (result.simulated) {
        toast.warning("Test recorded, but not delivered.", {
          description:
            result.reason ?? "No WhatsApp provider is configured, so nothing was transmitted.",
        });
      } else if (result.sent) {
        toast.success("Test message accepted by the provider.", {
          description: `Sent to ${testCode} ${testNumber}.`,
        });
      } else {
        toast.error(result.reason ?? "The provider refused the test message.");
      }
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "The test message could not be sent."));
    } finally {
      setTesting(false);
    }
  }

  async function retry(id: string) {
    setRetrying(id);
    try {
      const result = await api.retryWhatsApp(id);
      if (result.sent) {
        toast.success(result.simulated ? "Message re-recorded (simulated)." : "Message resent.");
      } else {
        toast.error(result.reason ?? "The message failed again.");
      }
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "That message could not be retried."));
    } finally {
      setRetrying(null);
    }
  }

  if (!overview) return <InlineLoader label="Loading WhatsApp status…" />;

  const { status, counts, recent } = overview;

  return (
    <>
      <Card>
        <SectionHeader
          title="WhatsApp integration"
          description="Booking confirmations, passes and gate updates sent to visitors"
          actions={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          }
        />

        <div className="space-y-4 p-4">
          {/* Connection state — deliberately blunt about the mock adapter. */}
          <div
            className={
              status.live
                ? "flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4"
                : "flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4"
            }
          >
            <MessageCircle
              className={
                status.live
                  ? "mt-0.5 h-5 w-5 shrink-0 text-success-strong"
                  : "mt-0.5 h-5 w-5 shrink-0 text-warning-strong"
              }
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {status.live ? "Connected" : "Configuration required — not connected"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {status.live
                  ? "Messages are being handed to the configured WhatsApp Business provider."
                  : "Messages are recorded in the delivery log below but are not transmitted to anyone. Set the WhatsApp environment variables to enable real delivery."}
              </p>
              {status.hint ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground">{status.hint}</p>
              ) : null}
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Provider
              </dt>
              <dd className="mt-0.5 text-sm font-medium">
                {status.provider === "meta"
                  ? "Meta WhatsApp Business Platform"
                  : "Development adapter (no delivery)"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Sender number ID
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-medium">
                {status.senderId ?? "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Business account
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-medium">
                {status.businessAccountId ?? "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                QR image delivery
              </dt>
              <dd className="mt-0.5 text-sm font-medium">
                {status.supportsMedia
                  ? "Supported by this provider"
                  : "Not available — the pass is sent as a secure link"}
              </dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(Object.keys(counts) as WhatsAppStatus[]).map((key) => (
              <div key={key} className="rounded-md border border-border p-3 text-center">
                <p className="text-lg font-semibold tabular-nums">{counts[key]}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{key}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Send a test message"
          description="Confirms the provider end to end"
        />
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="sm:w-28">
            <FormField id="wa-test-code" label="Code">
              <Input value={testCode} onChange={(e) => setTestCode(e.target.value)} />
            </FormField>
          </div>
          <div className="min-w-0 flex-1">
            <FormField id="wa-test-number" label="WhatsApp number">
              <Input
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value.replace(/[^\d\s-]/g, ""))}
                placeholder="9876500011"
                inputMode="numeric"
              />
            </FormField>
          </div>
          <Button onClick={() => void sendTest()} loading={testing}>
            <Send className="h-4 w-4" />
            Send test
          </Button>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Message templates"
          description="Rendered from a real booking, so this is the text a visitor receives"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadTemplates()}
              loading={loadingTemplates}
            >
              {templates.length ? "Reload" : "Show templates"}
            </Button>
          }
        />
        {templates.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Eight templates are defined: booking created, approved, rejected, rescheduled, checked
            in, meeting started, meeting completed and checked out. Load them to preview the exact
            wording.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((template) => (
              <li key={template.type}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-3 p-4 text-sm font-medium hover:bg-muted/40">
                    <span className="flex-1">{template.label}</span>
                    <code className="font-mono text-xs text-muted-foreground">
                      {template.type}
                    </code>
                  </summary>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-border bg-muted/40 p-4 text-xs leading-relaxed">
                    {template.preview}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeader
          title="Delivery log"
          description="The 25 most recent outbound messages"
        />
        {recent.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={MessageCircle}
              title="No messages yet"
              description="Booking confirmations and gate updates will be listed here as they are sent."
            />
          </div>
        ) : (
          <WhatsAppDeliveryList messages={recent} onRetry={(id) => void retry(id)} retrying={retrying} />
        )}
      </Card>
    </>
  );
}
