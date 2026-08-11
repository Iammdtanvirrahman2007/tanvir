const undoStack = [];
const redoStack = [];

export function pushHistory(action) {
    if (!action || typeof action.undo !== "function" || typeof action.redo !== "function") return;
    undoStack.push(action);
    redoStack.length = 0;
    notifyHistoryChange();
}

export function undo() {
    const action = undoStack.pop();
    if (!action) return false;

    action.undo();
    redoStack.push(action);
    notifyHistoryChange();
    return true;
}

export function redo() {
    const action = redoStack.pop();
    if (!action) return false;

    action.redo();
    undoStack.push(action);
    notifyHistoryChange();
    return true;
}

export function clearHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    notifyHistoryChange();
}

export function canUndo() {
    return undoStack.length > 0;
}

export function canRedo() {
    return redoStack.length > 0;
}

export function replaceLast(action) {
    if (!undoStack.length) return;
    undoStack[undoStack.length - 1] = action;
    notifyHistoryChange();
}

export function getHistoryState() {
    return { undo: undoStack.length, redo: redoStack.length };
}

function notifyHistoryChange() {
    window.dispatchEvent(new CustomEvent("editor:history-change", {
        detail: getHistoryState()
    }));
}
