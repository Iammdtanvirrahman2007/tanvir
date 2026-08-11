import { focusObject } from "../core/focus.js";

let button = null;
let currentObject = null;
let installed = false;

export function initSetFocusControl() {
    if (installed) return;
    installed = true;
    window.addEventListener("editor:selection-change", event => {
        const selection = event.detail || [];
        currentObject = selection.length === 1 ? selection[0] : null;
        syncButton();
    });
    window.addEventListener("resize", syncButton, { passive: true });
    syncButton();
}

function syncButton() {
    const panel = document.getElementById("inspectorContent");
    if (!panel) return;

    button?.remove();
    button = null;

    if (!currentObject || panel.querySelector(".empty-inspector")) return;

    const wrap = document.createElement("div");
    wrap.className = "set-focus-control";
    wrap.style.cssText = "display:flex;gap:7px;margin:0 0 10px;padding:8px;border:1px solid #30343d;border-radius:7px;background:rgba(255,255,255,.025)";

    button = document.createElement("button");
    button.type = "button";
    button.textContent = "◎ Set Focus";
    button.title = "Focus the selected object and make its center the camera target";
    button.style.cssText = "width:100%;min-height:34px;border:1px solid #454a55;border-radius:6px;background:#20232a;color:#e6e8ed;font-size:12px;font-weight:600;cursor:pointer;touch-action:manipulation";
    button.addEventListener("mouseenter", () => { button.style.background = "#2a2e37"; });
    button.addEventListener("mouseleave", () => { button.style.background = "#20232a"; });
    button.addEventListener("click", () => {
        if (!currentObject) return;
        const ok = focusObject(currentObject, { duration: 420 });
        if (ok) {
            window.dispatchEvent(new CustomEvent("editor:status", { detail: `Focused ${currentObject.name || currentObject.type}` }));
        }
    });

    wrap.appendChild(button);
    panel.prepend(wrap);
}
