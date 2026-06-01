import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const required = [
  "JWT_SECRET",
  "COOKIE_SECRET",
  "COSMOS_ENDPOINT",
  "COSMOS_KEY",
  "COSMOS_DATABASE_ID",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `Missing required env var: ${key}. Copy .env.example to .env and fill in values.`,
    );
  }
}

const jwtSecret = process.env.JWT_SECRET;
const cookieSecret = process.env.COOKIE_SECRET;

if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}
if (cookieSecret.length < 32) {
  throw new Error("COOKIE_SECRET must be at least 32 characters long");
}

const bootstrapAdmin = {
  email: process.env.BOOTSTRAP_ADMIN_EMAIL || "",
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "",
};

if (bootstrapAdmin.password && bootstrapAdmin.password.length < 12) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be ≥12 characters");
}
delete process.env.BOOTSTRAP_ADMIN_PASSWORD; // scrub from process memory

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",

  jwtSecret,
  cookieSecret,
  jwtExpiry: process.env.JWT_EXPIRY ?? "8h",

  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",

  bootstrapAdmin,

  cosmos: {
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
    databaseId: process.env.COSMOS_DATABASE_ID,
  },

  oidc: {
    issuer: process.env.OIDC_ISSUER ?? "",
    clientId: process.env.OIDC_CLIENT_ID ?? "",
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.OIDC_REDIRECT_URI ??
      "http://localhost:3001/api/auth/callback",
    // All three must be present for OIDC to be active; a partial config fails silently otherwise
    enabled: Boolean(
      process.env.OIDC_ISSUER &&
      process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_CLIENT_SECRET,
    ),
  },

  devAuthEnabled: process.env.DEV_AUTH_ENABLED === "true",

  // Jira integration (optional — routes return 503 when not configured)
  jira: {
    baseUrl: process.env.JIRA_BASE_URL ?? "",
    email: process.env.JIRA_EMAIL ?? "",
    apiToken: process.env.JIRA_API_TOKEN ?? "",
    projectKey: process.env.JIRA_PROJECT_KEY ?? "",
    // Optional: custom field ID for Story Points (e.g. "customfield_10016").
    // Verify via GET /rest/api/3/field on your Jira instance. Leave unset to omit story points from push payloads.
    storyPointsFieldId: process.env.JIRA_STORY_POINTS_FIELD_ID || null,
    configured: Boolean(
      process.env.JIRA_BASE_URL &&
      process.env.JIRA_EMAIL &&
      process.env.JIRA_API_TOKEN &&
      process.env.JIRA_PROJECT_KEY,
    ),
  },

  // Azure OpenAI Chat Completions Integration
  ai: {
    endpoint:
      process.env.AI_PROJECT_ENDPOINT || process.env.AI_FOUNDRY_ENDPOINT || "",
    apiKey:
      process.env.AI_PROJECT_API_KEY || process.env.AI_FOUNDRY_API_KEY || "",
    deployment:
      process.env.AI_DEPLOYMENT_NAME ||
      process.env.AI_FOUNDRY_DEPLOYMENT ||
      "gpt-5.4",
    apiVersion:
      process.env.AI_API_VERSION ||
      process.env.AI_FOUNDRY_API_VERSION ||
      "2024-02-01",
    configured: Boolean(
      (process.env.AI_PROJECT_ENDPOINT || process.env.AI_FOUNDRY_ENDPOINT) &&
      (process.env.AI_PROJECT_API_KEY || process.env.AI_FOUNDRY_API_KEY),
    ),
  },
};

// Scrub sensitive credentials from process memory after they've been read into config
delete process.env.JIRA_API_TOKEN;
delete process.env.AI_PROJECT_API_KEY;
delete process.env.AI_FOUNDRY_API_KEY;
