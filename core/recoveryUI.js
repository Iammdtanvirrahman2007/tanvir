const KEY = "modelforge:recovery:v1";

export function initRecoveryUI() {
    let raw = null;
    try { raw = localStorage.getItem("modelforge:project:v2") || localStorage.getItem("modelforge:project:v1"); } catch {}
    if (!raw) return;
    let data; try { data = JSON.parse(raw); } catch { return; }
    const stamp = Number(data?.savedAt || data?.timestamp || 0);
    if (!stamp || Date.now() - stamp > 24 * 60 * 60 * 1000) return;
    if (sessionStorage.getItem(KEY) === String(stamp)) return;
    sessionStorage.setItem(KEY, String(stamp));
    const count = Array.isArray(data?.objects) ? data.objects.length : Number(data?.objectCount || 0);
    const overlay = document.createElement("div"); overlay.id = "recoveryPrompt";
    overlay.innerHTML = `<div class="recovery-card"><span class="recovery-kicker">RECOVERY</span><h3>Restore previous workspace?</h3><p>ModelForge found a recent local session${count ? ` with ${count} object${count === 1 ? "" : "s"}` : ""}.</p><div class="recovery-actions"><button data-action="discard">Discard</button><button data-action="restore" class="primary">Restore</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", event => { const action = event.target.closest("[data-action]")?.dataset.action; if (!action) return; if (action === "discard") { try { localStorage.removeItem("modelforge:project:v2"); } catch {} } if (action === "restore") window.dispatchEvent(new CustomEvent("editor:project-recover", { detail: data })); overlay.remove(); });
}
