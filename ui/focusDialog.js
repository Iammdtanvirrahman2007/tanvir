import { focusGroupAverage, setFocusMode } from "../core/focus.js";

let activeDialog = null;

export function openGroupFocusDialog(group) {
    if (!group) return;
    activeDialog?.remove();

    const overlay = document.createElement("div");
    overlay.className = "focus-dialog-overlay";
    const dialog = document.createElement("div");
    dialog.className = "focus-dialog";
    dialog.innerHTML = `
        <div class="focus-dialog-title">Focus</div>
        <div class="focus-dialog-subtitle">${escapeHtml(group.name || "Group")}</div>
        <div class="focus-dialog-options">
            <button type="button" data-focus="average">
                <span class="focus-dialog-icon">◎</span>
                <span><strong>Group Center</strong><small>Focus the average point of all items</small></span>
            </button>
            <button type="button" data-focus="select">
                <span class="focus-dialog-icon">⌖</span>
                <span><strong>Select Focus</strong><small>Double-click an item inside this group</small></span>
            </button>
        </div>
        <button type="button" class="focus-dialog-cancel">Cancel</button>
    `;

    dialog.querySelector('[data-focus="average"]').addEventListener("click", () => {
        focusGroupAverage(group);
        setFocusMode(null, null);
        close();
    });
    dialog.querySelector('[data-focus="select"]').addEventListener("click", () => {
        setFocusMode(group, "select");
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Select Focus: double-click an item inside ${group.name || "group"}` }));
        close();
    });
    dialog.querySelector(".focus-dialog-cancel").addEventListener("click", close);
    overlay.addEventListener("pointerdown", event => { if (event.target === overlay) close(); });
    document.addEventListener("keydown", onEscape, { once: true });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    activeDialog = overlay;

    function close() {
        activeDialog?.remove();
        activeDialog = null;
    }
    function onEscape(event) { if (event.key === "Escape") close(); }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
