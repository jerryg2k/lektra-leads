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

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`API failed (${response.status}): ${detail}`);
  }

  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === "object" && "jsonData" in payload) {
    try { return JSON.parse(payload.jsonData ?? "{}"); }
    catch { return payload.jsonData; }
  }
  return payload;
}

// Test 1: LinkedIn company details by slug
console.log("\n=== Test 1: LinkedIn company details (mistral-ai-lab) ===");
try {
  const result = await callDataApi("LinkedIn/getCompanyDetails", {
    pathParams: { companyId: "mistral-ai-lab" }
  });
  const keys = Object.keys(result || {});
  console.log("Keys:", keys.slice(0, 20));
  console.log("Name:", result?.name);
  console.log("Industry:", result?.industries);
  console.log("Headcount:", result?.staffCount);
  console.log("Description:", (result?.description || "").slice(0, 100));
  console.log("Website:", result?.websiteUrl);
  console.log("Specialities:", result?.specialities?.slice(0, 5));
} catch (e) {
  console.error("Error:", e.message);
}

// Test 2: LinkedIn company search by name
console.log("\n=== Test 2: LinkedIn company search by name ===");
try {
  const result = await callDataApi("LinkedIn/searchCompanies", {
    query: { keywords: "Mistral AI", location: "United States" }
  });
  console.log("Result type:", typeof result);
  console.log("Keys:", Object.keys(result || {}).slice(0, 10));
  if (Array.isArray(result)) {
    console.log("First result:", JSON.stringify(result[0]).slice(0, 200));
  } else {
    console.log("Data:", JSON.stringify(result).slice(0, 300));
  }
} catch (e) {
  console.error("Error:", e.message);
}

// Test 3: Try a web search for company info
console.log("\n=== Test 3: Web search for company enrichment ===");
try {
  const result = await callDataApi("Google/search", {
    query: { q: "Mistral AI company GPU inference funding stage site:crunchbase.com OR site:linkedin.com", num: 3 }
  });
  console.log("Keys:", Object.keys(result || {}).slice(0, 10));
  console.log("Data:", JSON.stringify(result).slice(0, 400));
} catch (e) {
  console.error("Error:", e.message);
}
