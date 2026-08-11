const objects = [];

function isEditorObject(object) {
    return !!object && (object.userData?.editorObject === true || object.userData?.selectable === true || object.isMesh || object.isGroup);
}

export function addObject(scene, object) {
    if (!scene || !object) return null;

    if (!object.parent) scene.add(object);
    object.userData.editorObject = true;
    if (!objects.includes(object)) objects.push(object);
    return object;
}

export function removeObject(scene, object) {
    if (!object) return;
    if (object.parent) object.parent.remove(object);
    const index = objects.indexOf(object);
    if (index !== -1) objects.splice(index, 1);
}

export function getObjects() { return objects; }
export function getObjectByUUID(uuid) { return objects.find(object => object.uuid === uuid) || null; }

export function clearObjects(scene) {
    if (scene) [...objects].forEach(object => { if (object.parent) object.parent.remove(object); });
    objects.length = 0;
}

export function syncObjects(scene) {
    objects.length = 0;
    if (!scene) return objects;
    scene.traverse(object => {
        if (object !== scene && isEditorObject(object) && (object.isMesh || object.isGroup || object.userData?.selectable)) objects.push(object);
    });
    return objects;
}
