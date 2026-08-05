const undoStack = [];
const redoStack = [];

// ==========================
// Save Action
// ==========================

export function pushHistory(action) {

    undoStack.push(action);

    // নতুন action হলে redo clear
    redoStack.length = 0;

}

// ==========================
// Undo
// ==========================

export function undo() {

    if (undoStack.length === 0) return;

    const action = undoStack.pop();

    action.undo();

    redoStack.push(action);

}

// ==========================
// Redo
// ==========================

export function redo() {

    if (redoStack.length === 0) return;

    const action = redoStack.pop();

    action.redo();

    undoStack.push(action);

}
export function replaceLast(action) {

    if (undoStack.length === 0) return;

    undoStack[undoStack.length - 1] = action;

}