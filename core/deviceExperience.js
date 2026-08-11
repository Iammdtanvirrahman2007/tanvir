import { renderer, controls, camera } from "./scene.js";

const STORAGE_KEY = "modelforge:workspace:v2";
const root = document.documentElement;

export function initDeviceExperience() {
    const profile = getProfile();
    root.dataset.device = profile.device;
    root.dataset.input = profile.input;
    root.dataset.performance = profile.performance;

    installMobileDock();
    installTouchSafety();
    installQuality(profile);
    restoreWorkspace();
    bindWorkspacePersistence();
    bindOrientation();

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(handleResize, 100), { passive: true });
    return profile;
}

export function getProfile() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const touch = navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)").matches;
    const mobile = width <= 760;
    const tablet = width > 760 && width <= 1100;
    const performance = choosePerformance(width, height, touch);
    return {
        width,
        height,
        touch,
        input: touch ? "touch" : "mouse",
        device: mobile ? "mobile" : tablet ? "tablet" : "desktop",
        performance
    };
}

function choosePerformance(width, height, touch) {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    if (touch && (width <= 600 || cores <= 4 || memory <= 4)) return "performance";
    if (width <= 1100 || cores <= 6 || memory <= 8) return "balanced";
    return "high";
}

function installMobileDock() {
    if (document.getElementById("mobileActionDock")) return;
    const dock = document.createElement("div");
    dock.id = "mobileActionDock";
    dock.innerHTML = `
        <button data-action="scene"><b>☷</b><span>Scene</span></button>
        <button data-action="add"><b>＋</b><span>Add</span></button>
        <button data-action="select"><b>↖</b><span>Select</span></button>
        <button data-action="move"><b>✥</b><span>Move</span></button>
        <button data-action="rotate"><b>⟳</b><span>Rotate</span></button>
        <button data-action="scale"><b>⌗</b><span>Scale</span></button>
        <button data-action="inspector"><b>◇</b><span>Inspect</span></button>
        <button data-action="more"><b>⋯</b><span>More</span></button>`;
    document.body.appendChild(dock);

    dock.addEventListener("click", event => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (!action) return;
        const click = id => document.getElementById(id)?.click();
        const actions = {
            scene: () => click("mobileSceneBtn"),
            add: () => click("addMenuBtn"),
            select: () => click("selectBtn"),
            move: () => click("moveBtn"),
            rotate: () => click("rotateBtn"),
            scale: () => click("scaleBtn"),
            inspector: () => click("mobileInspectorBtn"),
            more: () => openMobileMore()
        };
        actions[action]?.();
    });
}

function openMobileMore() {
    let sheet = document.getElementById("mobileMoreSheet");
    if (sheet) {
        sheet.toggleAttribute("hidden");
        return;
    }
    sheet = document.createElement("div");
    sheet.id = "mobileMoreSheet";
    sheet.className = "mobile-more-sheet";
    sheet.innerHTML = `
        <div class="mobile-more-head"><strong>Editor</strong><button data-close>×</button></div>
        <div class="mobile-more-grid">
            <button data-click="undoBtn">Undo</button><button data-click="redoBtn">Redo</button>
            <button data-click="gridBtn">Grid</button><button data-click="frameBtn">Frame</button>
            <button data-click="cameraResetBtn">Reset View</button><button data-click="snapBtn">Snap</button>
            <button data-click="groupBtn">Group</button><button data-click="ungroupBtn">Ungroup</button>
            <button data-click="saveBtn">Save</button><button data-click="loadBtn">Open</button>
            <button data-click="exportBtn">Export</button><button data-click="uploadBtn">Part</button>
        </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener("click", event => {
        if (event.target.closest("[data-close]")) return sheet.remove();
        const id = event.target.closest("[data-click]")?.dataset.click;
        if (id) {
            document.getElementById(id)?.click();
            sheet.remove();
        }
    });
}

function installTouchSafety() {
    const viewport = document.getElementById("viewport");
    if (!viewport) return;
    viewport.style.touchAction = "none";

    let lastTap = 0;
    viewport.addEventListener("pointerup", event => {
        if (event.pointerType !== "touch") return;
        const now = performance.now();
        if (now - lastTap < 280) {
            window.dispatchEvent(new CustomEvent("editor:double-tap", { detail: { x: event.clientX, y: event.clientY } }));
        }
        lastTap = now;
    }, { passive: true });

    window.addEventListener("editor:double-tap", () => {
        const frame = document.getElementById("frameBtn");
        if (frame) frame.click();
    });
}

function installQuality(profile) {
    if (!renderer) return;
    const ratios = { performance: 1, balanced: Math.min(window.devicePixelRatio || 1, 1.5), high: Math.min(window.devicePixelRatio || 1, 2) };
    renderer.setPixelRatio(ratios[profile.performance]);
    renderer.domElement.style.imageRendering = "auto";

    if (profile.performance === "performance") {
        renderer.shadowMap.enabled = false;
    } else if (profile.performance === "balanced") {
        renderer.shadowMap.enabled = true;
    }
}

function handleResize() {
    const profile = getProfile();
    root.dataset.device = profile.device;
    root.dataset.input = profile.input;
    root.dataset.performance = profile.performance;
    installQuality(profile);
    saveWorkspace();
}

function bindOrientation() {
    if (screen.orientation?.addEventListener) {
        screen.orientation.addEventListener("change", handleResize);
    }
}

function saveWorkspace() {
    try {
        const data = {
            device: root.dataset.device,
            input: root.dataset.input,
            performance: root.dataset.performance,
            tool: document.querySelector("#bottomToolbar .tool-btn.active")?.id || "selectBtn",
            grid: document.getElementById("gridBtn")?.textContent || "Grid"
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
}

function restoreWorkspace() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (!data) return;
        if (data.tool) setTimeout(() => document.getElementById(data.tool)?.click(), 0);
    } catch {}
}

function bindWorkspacePersistence() {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") saveWorkspace();
    });
    window.addEventListener("beforeunload", saveWorkspace);
}
