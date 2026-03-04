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
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  
  if (parsed?.jsonData) {
    try { return { status: response.status, data: JSON.parse(parsed.jsonData) }; }
    catch { return { status: response.status, data: parsed.jsonData }; }
  }
  return { status: response.status, data: parsed };
}

// These are the APIs confirmed to work in the discover router
console.log("=== Test: LinkedIn/getCompanyDetails ===");
const r1 = await callDataApi("LinkedIn/getCompanyDetails", {
  pathParams: { companyId: "mistral-ai-lab" }
});
console.log("Status:", r1.status);
if (r1.status === 200) {
  const d = r1.data;
  console.log("Keys:", Object.keys(d || {}).slice(0, 20));
  console.log("Name:", d?.name);
  console.log("Industry:", d?.industries || d?.industry);
  console.log("Staff:", d?.staffCount || d?.employeeCount);
  console.log("Description:", (d?.description || "").slice(0, 150));
  console.log("Website:", d?.websiteUrl || d?.website);
  console.log("Specialities:", d?.specialities?.slice(0, 5));
  console.log("Funding:", d?.funding || d?.fundingData);
  console.log("HQ:", d?.headquarter || d?.location);
  console.log("LinkedIn URL:", d?.url || d?.linkedinUrl);
} else {
  console.log("Error:", JSON.stringify(r1.data).slice(0, 200));
}

console.log("\n=== Test: LinkedIn/searchPeople ===");
const r2 = await callDataApi("LinkedIn/searchPeople", {
  query: { keywords: "CEO founder Mistral AI", start: "0" }
});
console.log("Status:", r2.status);
if (r2.status === 200) {
  const d = r2.data;
  console.log("Keys:", Object.keys(d || {}).slice(0, 10));
  const items = d?.items || d?.results || d?.data || [];
  console.log("Count:", Array.isArray(items) ? items.length : "N/A");
  if (items[0]) console.log("First:", JSON.stringify(items[0]).slice(0, 200));
} else {
  console.log("Error:", JSON.stringify(r2.data).slice(0, 200));
}
