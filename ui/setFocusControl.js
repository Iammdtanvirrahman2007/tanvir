import { focusObject, focusGroupAverage } from "../core/focus.js";
import { getSelected, getSelection } from "../core/selection.js";

let button = null;
let currentObject = null;
let installed = false;

export function initSetFocusControl() {
    if (installed) return;
    installed = true;

    const sync = () => {
        currentObject = getSelected() || null;
        syncButton();
    };

    window.addEventListener("editor:selection-change", sync);
    window.addEventListener("resize", syncButton, { passive: true });
    window.addEventListener("editor:inspector-refresh", () => queueMicrotask(syncButton));

    // The inspector is rendered synchronously by selection.js, so queue once
    // after boot as well. This also covers selection restored by project load.
    queueMicrotask(sync);
    setTimeout(sync, 0);
}

function syncButton() {
    const panel = document.getElementById("inspectorContent");
    if (!panel) return;

    button?.closest(".set-focus-control")?.remove();
    button = null;

    const object = currentObject || getSelected();
    const selection = getSelection();
    if (!object || selection.length !== 1 || panel.querySelector(".empty-inspector")) return;

    const wrap = document.createElement("div");
    wrap.className = "set-focus-control";
    wrap.style.cssText = "display:flex;gap:7px;margin:0 0 10px;padding:8px;border:1px solid #30343d;border-radius:7px;background:rgba(255,255,255,.025)";

    button = document.createElement("button");
    button.type = "button";
    button.textContent = "◎ Set Focus";
    button.title = object.isGroup
        ? "Focus the group average center"
        : "Focus the selected object";
    button.style.cssText = "width:100%;min-height:34px;border:1px solid #454a55;border-radius:6px;background:#20232a;color:#e6e8ed;font-size:12px;font-weight:600;cursor:pointer;touch-action:manipulation;user-select:none";

    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        // Always read the selection at click time. Do not depend on a stale
        // event-cached object after hierarchy/inspector rerenders.
        const selected = getSelected();
        const selectedItems = getSelection();
        if (!selected || selectedItems.length !== 1) return;

        const ok = selected.isGroup
            ? focusGroupAverage(selected, { duration: 420 })
            : focusObject(selected, { duration: 420 });

        if (ok) {
            window.dispatchEvent(new CustomEvent("editor:status", {
                detail: `Focused ${selected.name || selected.type}`
            }));
        } else {
            window.dispatchEvent(new CustomEvent("editor:status", {
                detail: "Unable to focus selected object"
            }));
        }
    });

    button.addEventListener("pointerdown", event => event.stopPropagation());
    button.addEventListener("mouseenter", () => { button.style.background = "#2a2e37"; });
    button.addEventListener("mouseleave", () => { button.style.background = "#20232a"; });

    wrap.appendChild(button);
    panel.prepend(wrap);
}
