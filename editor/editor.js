export class Editor {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.selected = null;
        this.selection = [];
        this.objects = [];
        this.mode = "translate";
        this.snap = false;
    }

    configure({ scene, camera, renderer, controls } = {}) {
        if (scene) this.scene = scene;
        if (camera) this.camera = camera;
        if (renderer) this.renderer = renderer;
        if (controls) this.controls = controls;
        return this;
    }

    add(object) {
        if (!object) return null;
        if (this.scene && !object.parent) this.scene.add(object);
        if (!this.objects.includes(object)) this.objects.push(object);
        return object;
    }

    remove(object) {
        if (!object) return;
        if (object.parent) object.parent.remove(object);
        this.objects = this.objects.filter(item => item !== object);
        this.selection = this.selection.filter(item => item !== object);
        if (this.selected === object) this.selected = this.selection.at(-1) || null;
    }

    select(object) {
        this.selected = object || null;
        this.selection = object ? [object] : [];
        return this.selected;
    }

    setSelection(objects = []) {
        this.selection = [...new Set(objects.filter(Boolean))];
        this.selected = this.selection.at(-1) || null;
        return this.selection;
    }

    clearSelection() {
        this.selected = null;
        this.selection = [];
    }

    setMode(mode) {
        if (["select", "translate", "rotate", "scale"].includes(mode)) this.mode = mode;
    }

    setSnap(enabled) {
        this.snap = !!enabled;
    }
}
