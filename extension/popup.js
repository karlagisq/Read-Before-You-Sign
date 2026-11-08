const DEFAULTS = { enabled: true, cluster: "devnet", customRpc: "" };
const $ = (id) => document.getElementById(id);

function say(text, cls = "") {
  $("status").className = cls;
  $("status").textContent = text;
}

async function test() {
  say("Testing the connection to Solana…");
  const r = await chrome.runtime.sendMessage({ type: "rbys-ping" });
  if (r && r.ok) say(`Ready. Connected to ${r.cluster} in ${r.ms} ms.`, "ok");
  else say(`Can't reach the ${r ? r.cluster : ""} RPC right now. Checks will still decode transactions, but can't simulate them.`, "bad");
}

chrome.storage.sync.get(DEFAULTS).then((s) => {
  $("enabled").checked = s.enabled;
  $("cluster").value = s.cluster;
  $("customRpc").value = s.customRpc;
  test();
});

$("enabled").addEventListener("change", () => chrome.storage.sync.set({ enabled: $("enabled").checked }));
$("cluster").addEventListener("change", () => chrome.storage.sync.set({ cluster: $("cluster").value }));

$("save").addEventListener("click", async () => {
  const customRpc = $("customRpc").value.trim();
  if (customRpc) {
    let u;
    try { u = new URL(customRpc); } catch { return say("That RPC URL isn't valid.", "bad"); }
    if (u.protocol !== "https:") return say("Use an https:// RPC URL.", "bad");
    // Ask Chrome for access to just this one host.
    const granted = await chrome.permissions.request({ origins: [`${u.origin}/*`] });
    if (!granted) return say("Permission not granted, so the custom RPC wasn't saved.", "bad");
  }
  await chrome.storage.sync.set({ enabled: $("enabled").checked, cluster: $("cluster").value, customRpc });
  test();
});
