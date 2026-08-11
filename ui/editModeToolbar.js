import { enterEditMode, exitEditMode, isEditMode, setEditSelectionMode, getEditMode } from "../core/editMode.js";

let toolbar = null;

export function initEditModeToolbar() {
    if (toolbar || !document.body) return toolbar;
    toolbar = document.createElement("div");
    toolbar.id = "editModeToolbar";
    toolbar.innerHTML = `
        <div class="edit-mode-title">EDIT</div>
        <button data-edit="vertex">Vertex</button>
        <button data-edit="edge">Edge</button>
        <button data-edit="face">Face</button>
        <button data-edit="exit">Object</button>
    `;
    document.body.appendChild(toolbar);
    toolbar.addEventListener("click", event => {
        const action = event.target.closest("[data-edit]")?.dataset.edit;
        if (!action) return;
        if (action === "exit") exitEditMode();
        else setEditSelectionMode(action);
        updateEditModeToolbar();
    });
    window.addEventListener("editor:edit-mode-change", updateEditModeToolbar);
    updateEditModeToolbar();
    return toolbar;
}

export function toggleEditMode(object) {
    if (isEditMode()) return exitEditMode();
    return enterEditMode(object);
}

export function updateEditModeToolbar() {
    if (!toolbar) return;
    toolbar.hidden = !isEditMode();
    toolbar.querySelectorAll("[data-edit]").forEach(button => {
        button.classList.toggle("active", button.dataset.edit === getEditMode());
    });
}
