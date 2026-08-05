const objects = [];

export function addObject(scene, object) {
    scene.add(object);
    objects.push(object);
}

export function removeObject(scene, object) {
    scene.remove(object);
    const index = objects.indexOf(object);
    if (index !== -1) {
        objects.splice(index, 1);
    }
}

export function getObjects() {
    return objects;
}

// এই ফাংশনটি Load করার সময় পুরোনো লিস্ট ক্লিয়ার করার জন্য দরকার
export function clearObjects() {
    objects.length = 0;
}