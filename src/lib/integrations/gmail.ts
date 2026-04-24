const GOOGLE_OAUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_OAUTH_SCOPES = [GMAIL_READONLY_SCOPE, "openid", "email", "profile"];

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    data?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
};

export type GmailApiMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

export type GmailApiThread = {
  id: string;
  historyId?: string;
  messages?: GmailApiMessage[];
};

export type GoogleUserInfo = {
  sub: string;
  email?: string;
  name?: string;
};

export type GmailProfile = {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
};

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scopes: string[];
};

export type NormalizedGmailMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  toEmails: string[];
  ccEmails: string[];
  sentAt: string | null;
  snippet: string | null;
  bodyText: string;
  rawPayload: Record<string, unknown>;
};

export type NormalizedGmailThread = {
  gmailThreadId: string;
  subject: string;
  messages: NormalizedGmailMessage[];
  anchorMessageId: string;
  customerName: string | null;
  customerEmail: string | null;
  transcript: string;
};

export function getGoogleOauthRedirectUri(request: Request) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || new URL("/api/gmail/callback", request.url).toString();
}

export function buildGoogleOauthUrl({
  state,
  redirectUri,
}: {
  state: string;
  redirectUri: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Missing GOOGLE_CLIENT_ID");
  }

  const url = new URL(GOOGLE_OAUTH_BASE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCodeForTokens({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  return exchangeGoogleToken({
    code,
    redirectUri,
    grantType: "authorization_code",
  });
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  return exchangeGoogleToken({
    refreshToken,
    grantType: "refresh_token",
  });
}

export async function fetchGoogleUserInfo(accessToken: string) {
  return fetchGoogleJson<GoogleUserInfo>(GOOGLE_USERINFO_URL, accessToken);
}

export async function fetchGmailProfile(accessToken: string) {
  return fetchGoogleJson<GmailProfile>(`${GMAIL_API_BASE_URL}/profile`, accessToken);
}

export async function fetchGmailThread(accessToken: string, threadId: string) {
  return fetchGoogleJson<GmailApiThread>(
    `${GMAIL_API_BASE_URL}/threads/${encodeURIComponent(threadId)}?format=full`,
    accessToken,
  );
}

export async function fetchGmailMessage(accessToken: string, messageId: string) {
  return fetchGoogleJson<GmailApiMessage>(
    `${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(messageId)}?format=full`,
    accessToken,
  );
}

export function extractGmailCandidateId(input: string) {
  const value = input.trim();
  if (!value) {
    throw new Error("Paste a Gmail message/thread id or a supported Gmail link.");
  }

  if (!value.includes("://")) {
    return normalizeGmailObjectId(value);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Paste a valid Gmail message/thread id or a supported Gmail link.");
  }

  if (!/(^|\.)mail\.google\.com$/i.test(url.hostname)) {
    throw new Error("Paste a Gmail URL from mail.google.com or a raw Gmail id.");
  }

  const directParams = [
    url.searchParams.get("th"),
    url.searchParams.get("permthid"),
    url.searchParams.get("message_id"),
    url.searchParams.get("msgid"),
  ];

  for (const candidate of directParams) {
    if (candidate) {
      return normalizeGmailObjectId(candidate);
    }
  }

  const hash = url.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash.includes("?") ? hash.split("?")[1] : "");
  for (const key of ["th", "permthid", "message_id", "msgid"]) {
    const candidate = hashParams.get(key);
    if (candidate) {
      return normalizeGmailObjectId(candidate);
    }
  }

  const tokenCandidates = [
    ...url.pathname.split("/"),
    ...hash.split(/[/?&=#]/),
  ];

  for (const candidate of tokenCandidates.reverse()) {
    if (looksLikeGmailId(candidate)) {
      return normalizeGmailObjectId(candidate);
    }
  }

  throw new Error("Could not find a Gmail thread or message id in that URL.");
}

export function normalizeGmailThread(thread: GmailApiThread, workspaceMailboxEmail: string) {
  const rawMessages = thread.messages ?? [];
  if (rawMessages.length === 0) {
    throw new Error("The selected Gmail thread did not contain any messages.");
  }

  const messages = rawMessages
    .map((message) => normalizeGmailMessage(message))
    .sort(compareNormalizedMessages);

  const anchorMessage = messages[0];
  const customerMessage =
    messages.find(
      (message) =>
        message.fromEmail &&
        message.fromEmail.toLowerCase() !== workspaceMailboxEmail.toLowerCase(),
    ) ?? anchorMessage;

  return {
    gmailThreadId: thread.id,
    subject: messages.find((message) => message.subject)?.subject ?? `Gmail thread ${thread.id}`,
    messages,
    anchorMessageId: anchorMessage.gmailMessageId,
    customerName: customerMessage.fromName,
    customerEmail: customerMessage.fromEmail,
    transcript: buildThreadTranscript(thread.id, messages),
  } satisfies NormalizedGmailThread;
}

export function normalizeGmailMessage(message: GmailApiMessage) {
  const headers = headerMap(message.payload?.headers ?? []);
  const from = parseMailbox(headers.get("from") ?? null);
  const subject = headers.get("subject") ?? null;
  const sentAt = parseMessageTimestamp(headers.get("date") ?? null, message.internalDate);
  const bodyText = extractMessageBodyText(message.payload) || message.snippet || "(no plain-text body available)";

  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId,
    subject,
    fromName: from.name,
    fromEmail: from.email,
    toEmails: parseMailboxList(headers.get("to") ?? null),
    ccEmails: parseMailboxList(headers.get("cc") ?? null),
    sentAt,
    snippet: message.snippet ?? null,
    bodyText,
    rawPayload: (message as unknown as Record<string, unknown>) ?? {},
  } satisfies NormalizedGmailMessage;
}

export function tokenExpiresAtFromNow(expiresInSeconds: number | null | undefined) {
  if (!expiresInSeconds || expiresInSeconds <= 0) {
    return null;
  }

  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function scopesFromGoogleToken(token: Pick<GoogleTokenResponse, "scope">) {
  return (token.scope ?? "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function exchangeGoogleToken(
  params:
    | { code: string; redirectUri: string; grantType: "authorization_code" }
    | { refreshToken: string; grantType: "refresh_token" },
) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: params.grantType,
  });

  if (params.grantType === "authorization_code") {
    body.set("code", params.code);
    body.set("redirect_uri", params.redirectUri);
  } else {
    body.set("refresh_token", params.refreshToken);
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google token exchange failed (${response.status}). ${detail || "No response body."}`);
  }

  const token = (await response.json()) as GoogleTokenResponse;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresIn: token.expires_in ?? null,
    scopes: scopesFromGoogleToken(token),
  } satisfies GoogleTokens;
}

async function fetchGoogleJson<T>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google API request failed (${response.status}). ${detail || "No response body."}`);
  }

  return (await response.json()) as T;
}

function buildThreadTranscript(threadId: string, messages: NormalizedGmailMessage[]) {
  const subject = messages.find((message) => message.subject)?.subject ?? `Gmail thread ${threadId}`;
  const sections = [
    `Subject: ${subject}`,
    `Imported from Gmail thread ${threadId}`,
  ];

  for (const message of messages) {
    sections.push(
      [
        "",
        `From: ${formatMailbox(message.fromName, message.fromEmail)}`,
        `Date: ${message.sentAt ?? "Unknown"}`,
        "",
        message.bodyText,
      ].join("\n"),
    );
    sections.push("---");
  }

  if (sections[sections.length - 1] === "---") {
    sections.pop();
  }

  return sections.join("\n\n").trim();
}

function compareNormalizedMessages(a: NormalizedGmailMessage, b: NormalizedGmailMessage) {
  const left = a.sentAt ? Date.parse(a.sentAt) : Number.NaN;
  const right = b.sentAt ? Date.parse(b.sentAt) : Number.NaN;

  if (!Number.isNaN(left) && !Number.isNaN(right) && left !== right) {
    return left - right;
  }

  return a.gmailMessageId.localeCompare(b.gmailMessageId);
}

function extractMessageBodyText(payload: GmailMessagePart | undefined): string {
  if (!payload) {
    return "";
  }

  if (payload.mimeType?.startsWith("text/plain") && payload.body?.data) {
    return cleanDecodedBody(decodeBase64Url(payload.body.data));
  }

  if (payload.parts?.length) {
    const plainPart = payload.parts
      .map((part) => extractMessageBodyText(part))
      .find(Boolean);
    if (plainPart) {
      return plainPart;
    }

    const htmlPart = payload.parts
      .map((part) => extractHtmlBodyText(part))
      .find(Boolean);
    if (htmlPart) {
      return htmlPart;
    }
  }

  if (payload.mimeType?.startsWith("text/html") && payload.body?.data) {
    return cleanDecodedBody(stripHtml(decodeBase64Url(payload.body.data)));
  }

  if (payload.body?.data) {
    return cleanDecodedBody(decodeBase64Url(payload.body.data));
  }

  return "";
}

function extractHtmlBodyText(payload: GmailMessagePart | undefined): string {
  if (!payload) {
    return "";
  }

  if (payload.mimeType?.startsWith("text/html") && payload.body?.data) {
    return cleanDecodedBody(stripHtml(decodeBase64Url(payload.body.data)));
  }

  return (payload.parts ?? []).map((part) => extractHtmlBodyText(part)).find(Boolean) ?? "";
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function cleanDecodedBody(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function headerMap(headers: GmailHeader[]) {
  return new Map(
    headers
      .map((header) => [header.name?.toLowerCase().trim() ?? "", header.value?.trim() ?? ""] as const)
      .filter(([name]) => Boolean(name)),
  );
}

function parseMessageTimestamp(dateHeader: string | null, internalDate: string | undefined) {
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (internalDate) {
    const parsed = new Date(Number(internalDate));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function parseMailbox(value: string | null) {
  if (!value) {
    return { name: null, email: null };
  }

  const match = value.match(/^(.*?)(?:<([^>]+)>)?$/);
  if (!match) {
    return { name: null, email: value.trim().toLowerCase() };
  }

  const displayName = match[1]?.replace(/(^\"|\"$)/g, "").trim() || null;
  const email = match[2]?.trim().toLowerCase() || extractEmail(value);
  return {
    name: displayName && email && displayName.toLowerCase() === email ? null : displayName,
    email,
  };
}

function parseMailboxList(value: string | null) {
  if (!value) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => parseMailbox(item).email)
        .filter((email): email is string => Boolean(email)),
    ),
  );
}

function extractEmail(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function formatMailbox(name: string | null, email: string | null) {
  if (name && email) {
    return `${name} <${email}>`;
  }

  return name ?? email ?? "Unknown sender";
}

function looksLikeGmailId(value: string) {
  return /^[A-Za-z0-9_-]{8,}$/.test(value);
}

function normalizeGmailObjectId(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.includes(":") ? trimmed.split(":").pop() ?? trimmed : trimmed;

  if (/^FMfc/i.test(normalized)) {
    throw new Error(
      "This Gmail browser URL uses a web UI token. Paste the raw Gmail message/thread id instead.",
    );
  }

  if (!looksLikeGmailId(normalized)) {
    throw new Error("Paste a valid Gmail thread or message id.");
  }

  return normalized;
}
