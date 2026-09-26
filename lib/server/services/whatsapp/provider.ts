import "server-only";

/**
 * WhatsApp transport adapters.
 *
 * The booking lifecycle never talks to a vendor directly — it hands a rendered
 * message to whichever provider `WHATSAPP_PROVIDER` selects. Adding a second
 * vendor means adding an adapter here; nothing in `services/bookings.ts` or
 * `services/gate.ts` changes.
 *
 * CONFIGURATION REQUIRED: with no credentials in the environment the factory
 * falls back to the `mock` adapter, which records the message and reports
 * exactly that. It never claims a message reached WhatsApp.
 */

export type WhatsAppProviderName = "meta" | "mock";

export interface OutboundMessage {
  /** Recipient in E.164 without the leading `+`, e.g. `919876543210`. */
  to: string;
  body: string;
  /** Optional image (the QR pass) when the provider supports media. */
  media?: { url: string; caption?: string };
  /**
   * Ordered body parameters for an approved template.
   *
   * Meta only accepts free-form text inside a 24-hour customer service window,
   * and a booking confirmation is business-initiated. When
   * `WHATSAPP_TEMPLATE_NAME` names an approved template these values fill its
   * `{{1}}…{{n}}` placeholders; without one the adapter falls back to a text
   * message, which Meta delivers only inside that window.
   */
  templateVariables?: string[];
  /**
   * Overrides the default template for this message.
   *
   * The faculty notification is a different approved template from the
   * visitor one, because Meta approves templates per body shape.
   */
  templateName?: string;
}

export interface SendResult {
  /** True only when the provider accepted the message for delivery. */
  accepted: boolean;
  providerMessageId?: string;
  error?: string;
  /** False for the mock adapter — the caller records this honestly. */
  real: boolean;
}

export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName;
  /** True when every credential this adapter needs is present. */
  readonly configured: boolean;
  /** Why it is not configured, for the admin settings screen. */
  readonly configurationHint?: string;
  /** True when the adapter can deliver the QR as an image message. */
  readonly supportsMedia: boolean;
  send(message: OutboundMessage): Promise<SendResult>;
}

/* ------------------------------------------------------------------ *
 * Meta WhatsApp Business Platform (Cloud API)
 * ------------------------------------------------------------------ */

const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
const FACULTY_TEMPLATE_NAME = process.env.WHATSAPP_FACULTY_TEMPLATE_NAME?.trim();
const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en";

class MetaCloudProvider implements WhatsAppProvider {
  readonly name = "meta" as const;
  readonly supportsMedia = true;

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {}

  get configured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  get configurationHint(): string | undefined {
    if (!this.configured) return "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.";
    if (!TEMPLATE_NAME) {
      return (
        "Connected, but no approved template is configured. Set WHATSAPP_TEMPLATE_NAME to " +
        "reach visitors outside the 24-hour customer service window."
      );
    }
    return undefined;
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    if (!this.configured) {
      return { accepted: false, real: false, error: this.configurationHint };
    }

    const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`;

    // An approved template is the only reliable way to open a conversation, so
    // it takes precedence whenever one is configured and the caller supplied
    // its variables.
    const template = message.templateName ?? TEMPLATE_NAME;
    const useTemplate = Boolean(template && message.templateVariables?.length);

    const payload = useTemplate
      ? {
          messaging_product: "whatsapp",
          to: message.to,
          type: "template",
          template: {
            name: template,
            language: { code: TEMPLATE_LANGUAGE },
            components: [
              {
                type: "body",
                parameters: (message.templateVariables ?? []).map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ],
          },
        }
      : message.media
      ? {
          messaging_product: "whatsapp",
          to: message.to,
          type: "image",
          image: { link: message.media.url, caption: message.media.caption ?? message.body },
        }
      : {
          messaging_product: "whatsapp",
          to: message.to,
          type: "text",
          text: { preview_url: true, body: message.body },
        };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        // A slow vendor must not hold a booking request open.
        signal: AbortSignal.timeout(10_000),
      });

      const data = (await response.json().catch(() => ({}))) as {
        messages?: { id: string }[];
        error?: { message?: string };
      };

      if (!response.ok) {
        return {
          accepted: false,
          real: true,
          error: data.error?.message ?? `WhatsApp API responded ${response.status}.`,
        };
      }

      return {
        accepted: true,
        real: true,
        providerMessageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown transport failure.";
      return { accepted: false, real: true, error: reason };
    }
  }
}

/* ------------------------------------------------------------------ *
 * Development adapter
 * ------------------------------------------------------------------ */

/**
 * Records the message and says plainly that nothing was transmitted.
 *
 * `accepted: true` means "the pipeline ran end to end"; `real: false` is what
 * the delivery log and the admin screen use to label the row as simulated, so
 * a demo can never be mistaken for a delivered notification.
 */
class MockProvider implements WhatsAppProvider {
  readonly name = "mock" as const;
  readonly supportsMedia = false;
  readonly configured = true;
  readonly configurationHint =
    "No WhatsApp credentials configured — messages are recorded locally, not delivered.";

  async send(message: OutboundMessage): Promise<SendResult> {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[whatsapp:mock] would send to +${message.to}:\n${message.body.slice(0, 400)}`,
      );
    }
    return {
      accepted: true,
      real: false,
      providerMessageId: `mock-${Date.now().toString(36)}`,
    };
  }
}

/* ------------------------------------------------------------------ *
 * Factory
 * ------------------------------------------------------------------ */

export interface ProviderStatus {
  provider: WhatsAppProviderName;
  configured: boolean;
  /** False whenever messages are only simulated. */
  live: boolean;
  supportsMedia: boolean;
  senderId?: string;
  businessAccountId?: string;
  /** Approved template in use, or null when sending plain text. */
  template?: string | null;
  /** Approved template for the faculty notification. */
  facultyTemplate?: string | null;
  /** The campus WhatsApp Business number, for display. */
  businessNumber?: string;
  hint?: string;
}

let cached: WhatsAppProvider | null = null;

export function getProvider(): WhatsAppProvider {
  if (cached) return cached;

  const requested = (process.env.WHATSAPP_PROVIDER ?? "").trim().toLowerCase();
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";

  if (requested === "meta") {
    const meta = new MetaCloudProvider(token, phoneId);
    // A provider named but not credentialed would silently drop every message;
    // fall back to the mock so the delivery log still records the attempt.
    cached = meta.configured ? meta : new MockProvider();
  } else {
    cached = new MockProvider();
  }

  return cached;
}

/** Test hook — clears the memoised adapter after the environment changes. */
export function resetProvider(): void {
  cached = null;
}

export function providerStatus(): ProviderStatus {
  const provider = getProvider();
  const live = provider.name !== "mock";
  return {
    provider: provider.name,
    configured: provider.configured,
    live,
    supportsMedia: provider.supportsMedia,
    // Only the identifier, never the token.
    senderId: live ? process.env.WHATSAPP_PHONE_NUMBER_ID : undefined,
    template: live ? (TEMPLATE_NAME ?? null) : undefined,
    facultyTemplate: live ? (FACULTY_TEMPLATE_NAME ?? null) : undefined,
    // Display only — the sender is always the number behind the phone number
    // ID. Shown so staff know which number visitors will see.
    businessNumber: process.env.SECURITY_HEAD_WHATSAPP_NUMBER ?? undefined,
    businessAccountId: live ? process.env.WHATSAPP_BUSINESS_ACCOUNT_ID : undefined,
    hint: provider.configurationHint,
  };
}
