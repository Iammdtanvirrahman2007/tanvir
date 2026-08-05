export function createLayout() {

    const app = document.getElementById("app");

    app.innerHTML = `
        <div id="toolbar">
            <div class="logo">🚀 ModelForge 3D</div>

            <div class="menus">
                <button>File</button>
                <button>Edit</button>
                <button>Add</button>
                <button>View</button>
                <button>Help</button>
            </div>
        </div>

        <div id="workspace">

            <div id="left-panel">
                <h3>Scene</h3>
            </div>

            <div id="viewport"></div>

            <div id="right-panel">
                <h3>Inspector</h3>
            </div>

        </div>

        <div id="statusbar">
            Ready
        </div>
    `;

}