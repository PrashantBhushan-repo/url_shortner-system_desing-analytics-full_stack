import { dynamicKnowledgeRegistry } from "./dynamicRegistry.js";

/**
 * Common conversational stop-words and greeting noise terms to prevent irrelevant RAG hits
 */
const STOP_WORDS = new Set([
  "hi", "hii", "hiii", "hiiii", "hello", "helloo", "hey", "heyy", "heyya", "hola", "yo", "yoo", "greetings",
  "the", "a", "an", "is", "it", "so", "do", "can", "my", "you", "me", "on", "in", "to", "for", "with",
  "and", "or", "of", "what", "how", "why", "where", "who", "which", "are", "be", "this", "that", "there",
  "please", "tell", "show", "give", "get", "want", "need", "know", "thanks", "thank", "ok", "okay", "cool"
]);

/**
 * Rich domain synonym mapping covering all 8 platform knowledge sections
 */
const SYNONYMS = {
  // Section 1: Shortening & QR
  base62: ["encoding", "short code", "slug", "bijective", "dsa", "algorithm", "character space", "math"],
  shorten: ["short code", "slug", "alias", "url", "link", "qr code", "create link"],
  redirect: ["redirection", "302", "301", "caching", "stampede", "thundering herd", "status code", "found"],
  qr: ["qr code", "dynamic qr", "scan", "vector", "svg", "png", "scan tracking"],
  password: ["password protection", "bcrypt", "encrypted link", "protected link"],
  expiration: ["expires_at", "expiring link", "ttl", "410 gone"],

  // Section 2: Payments & Plans
  payment: ["razorpay", "subscription", "checkout", "procedure", "plan", "pricing", "upi", "card", "billing"],
  plan: ["pricing", "subscription", "pro", "enterprise", "free tier", "quota", "limits", "upgrade", "cost"],
  coupon: ["discount", "promo", "voucher", "code", "redemption"],

  // Section 3: Analytics
  analytics: ["telemetry", "clicks", "unique visitors", "hll", "hyperloglog", "geoip", "maxmind", "device", "browser", "country", "referrer", "bot"],
  hll: ["hyperloglog", "unique visitors", "cardinality", "analytics", "unique clicks", "pfadd", "pfcount", "12kb"],
  geoip: ["maxmind", "country", "city", "location", "geographic"],

  // Section 4: Billing & Refunds
  billing: ["invoice", "receipt", "history", "refund", "cancellation", "downgrade", "upgrade", "money back", "7 day"],
  refund: ["money back", "cancellation", "policy", "guideline", "7-day", "razorpay refund", "reimbursement"],

  // Section 5: Auth & Security
  auth: ["authentication", "authorization", "jwt", "totp", "2fa", "oauth", "google", "github", "bcrypt", "rbac", "api key", "bearer"],
  jwt: ["token", "refresh token", "access token", "session", "cookie"],
  totp: ["2fa", "two factor", "security", "authenticator", "otp", "backup code", "rfc 6238"],
  apikey: ["api key", "bearer token", "secret", "scopes", "read", "write", "admin"],

  // Section 6: Admin
  admin: ["admin portal", "admin dashboard", "user management", "ban user", "suspend", "plan creation", "billing audit", "refund admin", "moderation"],

  // Section 7: Settings
  settings: ["profile", "custom domain", "cname", "dns", "ssl", "webhook", "hmac", "team", "workspace", "collaboration", "theme"],
  cname: ["custom domain", "dns", "ssl", "domain verification", "subdomain", "tls", "branding"],
  webhook: ["hmac", "sha256", "signature", "payload", "event", "secret"],

  // Section 8: Security & Rate Limiting
  security: ["rate limit", "express rate limit", "helmet", "bot protection", "headers", "csrf", "xss", "cors", "mcp security", "idempotency"],
  bot: ["crawlers", "spiders", "filtering", "traffic quality", "scraping", "slackbot", "twitterbot", "googlebot"],
  mcp: ["model context protocol", "claude", "cursor", "ai agent", "sse", "stdio", "tool"],
};

/**
 * Hybrid Keyword, Synonym, Topic & Relevance Scoring Search Engine
 */
class KnowledgeSearchEngine {
  /**
   * Expands query terms with domain synonyms
   * @param {string[]} terms
   * @returns {string[]}
   */
  expandTerms(terms) {
    const expanded = new Set(terms);
    for (const term of terms) {
      if (SYNONYMS[term]) {
        SYNONYMS[term].forEach((syn) => {
          syn.split(/\s+/).forEach((s) => expanded.add(s));
        });
      }
    }
    return Array.from(expanded);
  }

  /**
   * Performs relevance-scored hybrid search across static + dynamic knowledge corpus
   * @param {string} query - The search query
   * @param {string} [topicFilter] - Optional topic filter
   * @param {number} [limit=3] - Maximum number of results to return
   * @returns {Array<Object>}
   */
  search(query = "", topicFilter = null, limit = 3) {
    const docs = dynamicKnowledgeRegistry.getAllDocs();

    if (!query || typeof query !== "string") {
      return docs.slice(0, limit);
    }

    const cleanQuery = query.toLowerCase().trim();
    // Filter out conversational stop-words and greeting noise
    const rawTerms = cleanQuery.split(/[\s,?.!/\\_]+/).filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

    // If query only contained noise words (e.g. "hii", "hello", "thanks"), return no documents
    if (rawTerms.length === 0) {
      return [];
    }

    const queryTerms = this.expandTerms(rawTerms);

    const scoredDocs = docs.map((doc) => {
      let score = 0;
      const lowerId = doc.id.toLowerCase();
      const lowerTitle = doc.title.toLowerCase();
      const lowerSummary = doc.summary.toLowerCase();
      const lowerContent = doc.content.toLowerCase();
      const keywords = (doc.keywords || []).map((k) => k.toLowerCase());

      // 1. Title or Keyword exact match (highest boost)
      if (lowerTitle.includes(cleanQuery)) score += 35;
      if (keywords.some((k) => cleanQuery.includes(k) || k.includes(cleanQuery))) score += 30;
      if (lowerId.includes(cleanQuery.replace(/\s+/g, "-"))) score += 25;

      // 2. Topic filter match
      if (topicFilter && doc.topic && doc.topic.toLowerCase() === topicFilter.toLowerCase()) {
        score += 15;
      }

      // 3. Dynamic document freshness boost
      if (doc.id.startsWith("dynamic-")) {
        score += 10;
      }

      // 4. Term matches across weighted fields
      for (const term of queryTerms) {
        if (lowerTitle.includes(term)) score += 8;
        if (keywords.some((k) => k.includes(term))) score += 6;
        if (lowerSummary.includes(term)) score += 4;
        if (lowerContent.includes(term)) score += 1.5;
      }

      return {
        ...doc,
        relevanceScore: score,
      };
    });

    return scoredDocs
      .filter((doc) => doc.relevanceScore >= 15) // Require high confidence match
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }
}

export const knowledgeSearchEngine = new KnowledgeSearchEngine();
