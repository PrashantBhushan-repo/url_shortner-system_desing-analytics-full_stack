const normalize = (value) => (typeof value === "string" ? value.trim() : "");

const TOOL_USER_AGENTS = [
  { pattern: /postman/i, name: "Postman" },
  { pattern: /curl/i, name: "curl" },
  { pattern: /wget/i, name: "wget" },
  { pattern: /python-requests/i, name: "Python Requests" },
  { pattern: /axios/i, name: "Axios" },
  { pattern: /node-fetch/i, name: "Node Fetch" },
  { pattern: /fetch/i, name: "Fetch" },
];

const HOSTNAME_MAP = [
  { pattern: /(^|\.)linkedin\.com$/, label: "LinkedIn" },
  { pattern: /(^|\.)instagram\.com$/, label: "Instagram" },
  { pattern: /(^|\.)twitter\.com$|(^|\.)x\.com$/, label: "Twitter/X" },
  { pattern: /(^|\.)facebook\.com$/, label: "Facebook" },
  { pattern: /(^|\.)whatsapp\.com$|^wa\.me$/, label: "WhatsApp" },
  { pattern: /(^|\.)t\.me$|(^|\.)telegram\.me$|(^|\.)telegram\.org$/, label: "Telegram" },
  { pattern: /(^|\.)slack\.com$/, label: "Slack" },
  { pattern: /(^|\.)github\.com$/, label: "GitHub" },
  { pattern: /(^|\.)quora\.com$/, label: "Quora" },
  { pattern: /(^|\.)pinterest\.com$/, label: "Pinterest" },
  { pattern: /(^|\.)naukri\.com$/, label: "Naukri" },
  { pattern: /(^|\.)google\.(com|co\.[a-z]{2})$/, label: "Google Search" },
  { pattern: /(^|\.)bing\.com$/, label: "Bing" },
  { pattern: /(^|\.)yahoo\.com$/, label: "Yahoo" },
  { pattern: /(^|\.)duckduckgo\.com$/, label: "DuckDuckGo" },
  { pattern: /(^|\.)reddit\.com$/, label: "Reddit" },
  { pattern: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, label: "YouTube" },
];

const parseUrl = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
};

export const parseReferrer = (referrer, userAgent) => {
  const normalizedReferrer = normalize(referrer);
  const parsedReferrer = parseUrl(normalizedReferrer);

  let referrerHost = null;
  let utmSource = null;
  let utmMedium = null;
  let utmCampaign = null;

  if (parsedReferrer) {
    const hostname = (parsedReferrer.hostname || "").toLowerCase();
    referrerHost = mapHostnameToFriendlySource(hostname) || hostname || "Unknown";

    const searchParams = parsedReferrer.searchParams;
    utmSource = normalize(searchParams.get("utm_source"));
    utmMedium = normalize(searchParams.get("utm_medium"));
    utmCampaign = normalize(searchParams.get("utm_campaign"));
  }

  if (!referrerHost) {
    const toolLabel = getToolFromUserAgent(userAgent);
    if (toolLabel) {
      referrerHost = toolLabel;
    }
  }

  return {
    referrer: normalizedReferrer,
    referer_host: referrerHost,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
  };
};

const getToolFromUserAgent = (userAgent) => {
  if (!userAgent || typeof userAgent !== "string") return null;
  const normalized = userAgent.trim();

  for (const tool of TOOL_USER_AGENTS) {
    if (tool.pattern.test(normalized)) {
      return tool.name;
    }
  }

  return null;
};

const mapHostnameToFriendlySource = (hostname) => {
  if (!hostname) return null;

  for (const entry of HOSTNAME_MAP) {
    if (entry.pattern.test(hostname)) {
      return entry.label;
    }
  }

  return null;
};
