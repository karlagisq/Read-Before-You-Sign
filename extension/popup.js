const DEFAULTS = { enabled: true, apiUrl: "http://localhost:3000", cluster: "devnet" };
const $ = (id) => document.getElementById(id);

async function test(apiUrl) {
  const status = $("status");
  status.className = "";
  status.textContent = "Testing…";
  try {
    // An empty request returns 400 "Provide a base64 transaction", which proves the analyzer is up.
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/explain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (res.status === 400 || res.ok) {
      status.className = "ok";
      status.textContent = "Connected to the analyzer.";
    } else throw new Error(`HTTP ${res.status}`);
  } catch {
    status.className = "bad";
    status.textContent = `Can't reach ${apiUrl}. Start the app with npm run dev.`;
  }
}

chrome.storage.sync.get(DEFAULTS).then((s) => {
  $("enabled").checked = s.enabled;
  $("cluster").value = s.cluster;
  $("apiUrl").value = s.apiUrl;
  test(s.apiUrl);
});

$("enabled").addEventListener("change", () => chrome.storage.sync.set({ enabled: $("enabled").checked }));
$("cluster").addEventListener("change", () => chrome.storage.sync.set({ cluster: $("cluster").value }));
$("save").addEventListener("click", async () => {
  const apiUrl = $("apiUrl").value.trim() || DEFAULTS.apiUrl;
  await chrome.storage.sync.set({ apiUrl, enabled: $("enabled").checked, cluster: $("cluster").value });
  test(apiUrl);
});
