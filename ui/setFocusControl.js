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
    window.addEventListener("editor:inspector-refresh", () => queueMicrotask(sync));
    window.addEventListener("resize", () => queueMicrotask(syncButton), { passive: true });

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

    const isGroup = object.userData?.editorGroup === true || object.isGroup === true;

    const wrap = document.createElement("div");
    wrap.className = "set-focus-control";
    wrap.style.cssText = "display:flex;gap:7px;margin:0 0 10px;padding:8px;border:1px solid #30343d;border-radius:7px;background:rgba(255,255,255,.025)";

    button = document.createElement("button");
    button.type = "button";
    button.textContent = isGroup ? "◎ Set Focus · Group Center" : "◎ Set Focus";
    button.title = isGroup ? "Focus the group's current average center" : "Focus the selected object";
    button.setAttribute("aria-label", button.title);
    button.style.cssText = "width:100%;min-height:34px;border:1px solid #454a55;border-radius:6px;background:#20232a;color:#e6e8ed;font-size:12px;font-weight:600;cursor:pointer;touch-action:manipulation;user-select:none";

    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        const selected = getSelected();
        const selectedItems = getSelection();
        if (!selected || selectedItems.length !== 1) return;

        const selectedIsGroup = selected.userData?.editorGroup === true || selected.isGroup === true;
        const ok = selectedIsGroup
            ? focusGroupAverage(selected, { duration: 0 })
            : focusObject(selected, { duration: 0 });

        window.dispatchEvent(new CustomEvent("editor:status", {
            detail: ok
                ? (selectedIsGroup ? `Focused ${selected.name || "group"} center` : `Focused ${selected.name || selected.type}`)
                : "Unable to focus selected object"
        }));
    });

    button.addEventListener("pointerdown", event => event.stopPropagation());
    button.addEventListener("touchstart", event => event.stopPropagation(), { passive: true });
    button.addEventListener("mouseenter", () => { button.style.background = "#2a2e37"; });
    button.addEventListener("mouseleave", () => { button.style.background = "#20232a"; });

    wrap.appendChild(button);
    panel.prepend(wrap);
}
