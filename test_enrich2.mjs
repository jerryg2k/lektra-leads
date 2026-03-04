import { config } from "dotenv";
config({ path: "/home/ubuntu/lektra-leads/.env" });

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function callDataApi(apiId, options = {}) {
  const baseUrl = FORGE_URL.endsWith("/") ? FORGE_URL : `${FORGE_URL}/`;
  const fullUrl = new URL("webdevtoken.v1.WebDevService/CallApi", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${FORGE_KEY}`,
    },
    body: JSON.stringify({
      apiId,
      query: options.query,
      body: options.body,
      path_params: options.pathParams,
    }),
  });

  const text = await response.text();
  return { status: response.status, body: text.slice(0, 500) };
}

// Try various API IDs to discover what's available
const apis = [
  ["LinkedIn/getCompanyByDomain", { query: { domain: "mistral.ai" } }],
  ["LinkedIn/company", { pathParams: { companyId: "mistral-ai-lab" } }],
  ["LinkedIn/companyDetails", { query: { company_id: "mistral-ai-lab" } }],
  ["Crunchbase/getOrganization", { query: { name: "Mistral AI" } }],
  ["Crunchbase/organization", { pathParams: { org: "mistral-ai" } }],
  ["Google/webSearch", { query: { q: "Mistral AI GPU startup" } }],
  ["Bing/search", { query: { q: "Mistral AI funding" } }],
  ["omni_search", { query: { q: "Mistral AI", search_type: "info" } }],
  ["web_search", { query: { query: "Mistral AI" } }],
];

for (const [apiId, opts] of apis) {
  const result = await callDataApi(apiId, opts);
  console.log(`${apiId}: ${result.status} → ${result.body.slice(0, 120)}`);
}
