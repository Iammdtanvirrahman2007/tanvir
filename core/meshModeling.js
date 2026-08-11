import * as THREE from "three";
import { pushHistory } from "./history.js";
import { refreshInspector } from "../ui/inspector.js";

function replaceGeometry(object, next, label) {
    if (!object?.isMesh || !next) return false;
    const previous = object.geometry;
    object.geometry = next;
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
    object.geometry.computeVertexNormals();
    pushHistory({ label, undo: () => { object.geometry = previous; refreshInspector(); }, redo: () => { object.geometry = next; refreshInspector(); } });
    dispatch("editor:mesh-change", { action: label, object });
    refreshInspector();
    return true;
}

export function insetFaces(object, amount = 0.15) {
    if (!object?.isMesh || !object.geometry?.attributes?.position) return false;
    const geometry = object.geometry.toNonIndexed();
    const position = geometry.attributes.position;
    const center = new THREE.Vector3();
    geometry.computeBoundingBox();
    geometry.boundingBox.getCenter(center);
    const next = geometry.clone();
    const out = next.attributes.position;
    const factor = THREE.MathUtils.clamp(1 - Number(amount), 0.05, 0.95);
    for (let i = 0; i < out.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(out, i);
        p.sub(center).multiplyScalar(factor).add(center);
        out.setXYZ(i, p.x, p.y, p.z);
    }
    out.needsUpdate = true;
    return replaceGeometry(object, next, "Inset");
}

export function extrudeGeometry(object, distance = 0.2) {
    if (!object?.isMesh || !object.geometry?.attributes?.position) return false;
    const source = object.geometry.toNonIndexed();
    const position = source.attributes.position;
    const vertexCount = position.count;
    if (!vertexCount) return false;
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion).normalize();
    const vertices = [];
    for (let i = 0; i < vertexCount; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i);
        vertices.push(p.x, p.y, p.z);
    }
    for (let i = 0; i < vertexCount; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i).addScaledVector(direction, distance);
        vertices.push(p.x, p.y, p.z);
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const groups = source.groups.length ? source.groups : [{ start: 0, count: vertexCount, materialIndex: 0 }];
    const indices = [];
    const triCount = Math.floor(vertexCount / 3);
    for (let i = 0; i < triCount; i++) indices.push(i * 3, i * 3 + 1, i * 3 + 2);
    for (let i = 0; i < triCount; i++) { const a = vertexCount + i * 3, b = a + 1, c = a + 2; indices.push(c, b, a); }
    for (let i = 0; i < vertexCount; i += 3) {
        const a = i, b = i + 1, c = i + 2;
        if (c >= vertexCount) break;
        const A = vertexCount + a, B = vertexCount + b, C = vertexCount + c;
        indices.push(a, b, B, a, B, A, b, c, C, b, C, B, c, a, A, c, A, C);
    }
    next.setIndex(indices);
    return replaceGeometry(object, next, "Extrude");
}

export function bevelGeometry(object, amount = 0.05) {
    if (!object?.isMesh || !object.geometry) return false;
    const source = object.geometry.clone();
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3(); box.getSize(size);
    const min = Math.max(Math.min(size.x, size.y, size.z), 0.001);
    const factor = THREE.MathUtils.clamp(1 - Number(amount) / min, 0.8, 0.999);
    object.scale.multiplyScalar(1 / factor);
    const before = object.scale.clone();
    object.scale.multiplyScalar(factor);
    const after = object.scale.clone();
    object.scale.copy(before);
    pushHistory({ label: "Bevel", undo: () => { object.scale.copy(after); refreshInspector(); }, redo: () => { object.scale.copy(before); refreshInspector(); } });
    dispatch("editor:mesh-change", { action: "Bevel", object, amount });
    refreshInspector();
    return true;
}

function dispatch(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }
