import { focusGroupAverage, setFocusMode, focusObject } from "../core/focus.js";

let activeDialog = null;
let stylesInstalled = false;

installStyles();
window.addEventListener("editor:focus-object", event => {
    if (event.detail) focusObject(event.detail, { duration: 360 });
});

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

    const onEscape = event => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onEscape, { once: true });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    activeDialog = overlay;

    function close() {
        activeDialog?.remove();
        activeDialog = null;
    }
}

function installStyles() {
    if (stylesInstalled || document.getElementById("modelForgeFocusStyles")) return;
    stylesInstalled = true;
    const style = document.createElement("style");
    style.id = "modelForgeFocusStyles";
    style.textContent = `
        .tree-actions{display:flex;align-items:center;gap:2px;margin-left:auto;opacity:.72}
        .tree-row:hover .tree-actions,.tree-row.active .tree-actions{opacity:1}
        .tree-focus-action{font-size:13px!important;color:#aeb2bd!important}
        .tree-focus-action:hover{color:#fff!important;background:#30333a!important}
        .focus-dialog-overlay{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.52);backdrop-filter:blur(4px)}
        .focus-dialog{width:min(410px,calc(100vw - 32px));padding:16px;border:1px solid #3a3d46;border-radius:9px;background:#191a1f;box-shadow:0 24px 70px rgba(0,0,0,.58);color:#e7e8eb}
        .focus-dialog-title{font-size:14px;font-weight:650}
        .focus-dialog-subtitle{margin-top:3px;color:#747984;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .focus-dialog-options{display:grid;gap:7px;margin-top:14px}
        .focus-dialog-options button{display:grid;grid-template-columns:30px 1fr;align-items:center;gap:10px;width:100%;padding:11px;border:1px solid #30333b;border-radius:6px;background:#15161a;color:#c9cbd1;text-align:left;cursor:pointer}
        .focus-dialog-options button:hover{background:#23252b;border-color:#4a4e58;color:#fff}
        .focus-dialog-icon{width:28px;height:28px;display:grid;place-items:center;border:1px solid #3b3e47;border-radius:5px;color:#c8cbd2;font-size:18px}
        .focus-dialog-options strong{display:block;font-size:11px;font-weight:600}
        .focus-dialog-options small{display:block;margin-top:3px;color:#777b85;font-size:9px;line-height:1.35}
        .focus-dialog-cancel{width:100%;margin-top:9px;padding:8px;border:1px solid #30333b;border-radius:5px;background:transparent;color:#858994;cursor:pointer}
        .focus-dialog-cancel:hover{background:#25272e;color:#fff}
        @media(max-width:760px){.focus-dialog-overlay{align-items:end;padding:8px}.focus-dialog{width:100%;border-radius:12px;padding:14px}.focus-dialog-options button{min-height:58px}}
    `;
    document.head.appendChild(style);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
