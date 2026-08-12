import { updateAttachmentNode } from "../rocket/attachmentNodes.js";

let installed = false;
let observer = null;

export function initRocketNodeUiFix() {
    if (installed) return;
    installed = true;
    installStyles();
    patch();
    const body = document.getElementById("rocketPartBody");
    if (body) {
        observer = new MutationObserver(() => queueMicrotask(patch));
        observer.observe(body, { childList: true, subtree: true });
    }
    window.addEventListener("editor:attachment-node-selected", () => queueMicrotask(patch));
    window.addEventListener("editor:rocket-node-change", () => queueMicrotask(patch));
}

function patch() {
    const editor = document.querySelector("#rocketPartBody .rocket-node-editor");
    if (!editor) return;

    const native = editor.querySelector("select[data-type]");
    if (native && !editor.querySelector("[data-node-type-picker]")) {
        const wrapper = document.createElement("div");
        wrapper.className = "node-type-picker";
        wrapper.dataset.nodeTypePicker = "true";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "node-type-picker-button";
        button.textContent = labelFor(native.value);
        button.setAttribute("aria-haspopup", "listbox");
        button.setAttribute("aria-expanded", "false");

        const menu = document.createElement("div");
        menu.className = "node-type-picker-menu";
        menu.hidden = true;
        menu.setAttribute("role", "listbox");

        [...native.options].forEach(option => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "node-type-picker-option";
            item.textContent = labelFor(option.value);
            item.dataset.value = option.value;
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", String(option.value === native.value));
            item.addEventListener("click", () => {
                native.value = option.value;
                native.dispatchEvent(new Event("change", { bubbles: true }));
                button.textContent = labelFor(option.value);
                [...menu.children].forEach(child => child.setAttribute("aria-selected", String(child.dataset.value === option.value)));
                close();
            });
            menu.appendChild(item);
        });

        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            const open = !menu.hidden;
            document.querySelectorAll(".node-type-picker-menu").forEach(nodeMenu => nodeMenu.hidden = true);
            document.querySelectorAll(".node-type-picker-button").forEach(nodeButton => nodeButton.setAttribute("aria-expanded", "false"));
            menu.hidden = open;
            button.setAttribute("aria-expanded", String(!open));
        });

        wrapper.append(button, menu);
        native.hidden = true;
        native.setAttribute("aria-hidden", "true");
        native.parentNode?.appendChild(wrapper);

        const closeOnOutside = event => {
            if (!wrapper.contains(event.target)) close();
        };
        document.addEventListener("pointerdown", closeOnOutside, true);
        function close() {
            menu.hidden = true;
            button.setAttribute("aria-expanded", "false");
        }
    }

    // Make sure the visible picker always reflects the current model value.
    const picker = editor.querySelector("[data-node-type-picker]");
    const current = native?.value || picker?.querySelector(".node-type-picker-option[aria-selected='true']")?.dataset.value;
    if (picker && current) {
        const button = picker.querySelector(".node-type-picker-button");
        if (button) button.textContent = labelFor(current);
        picker.querySelectorAll(".node-type-picker-option").forEach(option => {
            option.setAttribute("aria-selected", String(option.dataset.value === current));
        });
    }
}

function labelFor(value) {
    return String(value || "").replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function installStyles() {
    if (document.getElementById("rocketNodeUiFixStyles")) return;
    const style = document.createElement("style");
    style.id = "rocketNodeUiFixStyles";
    style.textContent = `
        .node-type-picker{position:relative;width:100%}
        .node-type-picker-button{width:100%;min-height:30px;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;border:1px solid #343741;border-radius:4px;background:#101216;color:#d7dae0;padding:6px 9px;font:10px system-ui,sans-serif;text-align:left;cursor:pointer}
        .node-type-picker-button::after{content:"▾";color:#7e8794;margin-left:8px}
        .node-type-picker-button:hover{border-color:#596273;background:#15181d}
        .node-type-picker-menu{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:120;background:#14161b;border:1px solid #383c45;border-radius:5px;box-shadow:0 12px 28px rgba(0,0,0,.45);padding:4px;max-height:220px;overflow:auto}
        .node-type-picker-menu[hidden]{display:none!important}
        .node-type-picker-option{display:block;width:100%;border:0;border-radius:4px;background:transparent;color:#bfc5ce;padding:7px 8px;font:10px system-ui,sans-serif;text-align:left;cursor:pointer}
        .node-type-picker-option:hover{background:#252a32;color:#fff}
        .node-type-picker-option[aria-selected="true"]{background:#2b3039;color:#fff}
        .node-field select[data-type][hidden]{display:none!important}
        .rocket-node-editor-section .node-field{position:relative;z-index:2}
        .rocket-node-editor-section .node-field > span{display:block;min-width:0;white-space:nowrap}
        .rocket-node-editor-section .node-vector{position:relative;z-index:1}
    `;
    document.head.appendChild(style);
}

void updateAttachmentNode;
