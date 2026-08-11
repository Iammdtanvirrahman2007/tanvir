export function createLayout() {
    const elements = {
        topbar: document.getElementById("topbar"),
        editor: document.getElementById("editor"),
        leftPanel: document.getElementById("leftPanel"),
        viewport: document.getElementById("viewport"),
        rightPanel: document.getElementById("rightPanel"),
        bottomToolbar: document.getElementById("bottomToolbar"),
        statusBar: document.getElementById("statusBar")
    };

    return {
        ...elements,
        refresh() {
            window.dispatchEvent(new Event("resize"));
        },
        setLeftPanelVisible(visible) {
            if (elements.leftPanel) elements.leftPanel.hidden = !visible;
        },
        setRightPanelVisible(visible) {
            if (elements.rightPanel) elements.rightPanel.hidden = !visible;
        }
    };
}
