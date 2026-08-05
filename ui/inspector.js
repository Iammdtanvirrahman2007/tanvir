import * as THREE from "three";

export function updateInspector(object) {
    const panel = document.getElementById("rightPanel");

    if (!object) {
        panel.innerHTML = `
            <h3>Inspector</h3>
            <p>No object selected</p>
        `;
        return;
    }

    panel.innerHTML = `
        <h3>Inspector</h3>
        <hr>
        
        <label>Name</label>
        <input id="ins_name" type="text" value="${object.name}">
        <hr>
        
        <h4>Position</h4>
        <label>X</label>
        <input id="posX" type="number" step="0.1" value="${object.position.x.toFixed(2)}">
        <label>Y</label>
        <input id="posY" type="number" step="0.1" value="${object.position.y.toFixed(2)}">
        <label>Z</label>
        <input id="posZ" type="number" step="0.1" value="${object.position.z.toFixed(2)}">
        <hr>
        
        <h4>Rotation</h4>
        <label>X</label>
        <input id="rotX" type="number" step="1" value="${(object.rotation.x * 57.2958).toFixed(1)}">
        <label>Y</label>
        <input id="rotY" type="number" step="1" value="${(object.rotation.y * 57.2958).toFixed(1)}">
        <label>Z</label>
        <input id="rotZ" type="number" step="1" value="${(object.rotation.z * 57.2958).toFixed(1)}">
        <hr>
        
        <h4>Scale</h4>
        <label>X</label>
        <input id="scaleX" type="number" step="0.1" value="${object.scale.x.toFixed(2)}">
        <label>Y</label>
        <input id="scaleY" type="number" step="0.1" value="${object.scale.y.toFixed(2)}">
        <label>Z</label>
        <input id="scaleZ" type="number" step="0.1" value="${object.scale.z.toFixed(2)}">
        <hr>
        
        <h4>Material</h4>
        <label>Material Slot</label>
        <select id="materialSlot"></select>
        <br><br>
        <button id="addMaterial">+ Add Material</button>
        <button id="removeMaterial">- Remove Material</button>
        <br><br>
        
        <label>Color</label>
        <input id="matColor" type="color">
        <br><br>
        
        <label>Texture</label>
        <input id="textureFile" type="file" accept=".png,.jpg,.jpeg">
        <br><br>
        
        <label>Metalness</label>
        <input id="metalness" type="range" min="0" max="1" step="0.01">
        <br><br>
        
        <label>Roughness</label>
        <input id="roughness" type="range" min="0" max="1" step="0.01">
        <br><br>
        
        <label>Opacity</label>
        <input id="opacity" type="range" min="0" max="1" step="0.01">
        <br><br>
        
        <label>
            <input id="wireframe" type="checkbox"> Wireframe
        </label>
        <br><br>
        
        <label>
            <input id="visible" type="checkbox"> Visible
        </label>
    `;

    // ==========================
    // Name
    // ==========================
    document.getElementById("ins_name").oninput = e => {
        object.name = e.target.value;
        const item = document.getElementById(object.uuid);
        if (item) {
            item.textContent = object.name;
        }
    };

    // ==========================
    // Position
    // ==========================
    document.getElementById("posX").oninput = e => {
        object.position.x = parseFloat(e.target.value);
    };
    document.getElementById("posY").oninput = e => {
        object.position.y = parseFloat(e.target.value);
    };
    document.getElementById("posZ").oninput = e => {
        object.position.z = parseFloat(e.target.value);
    };

    // ==========================
    // Rotation
    // ==========================
    document.getElementById("rotX").oninput = e => {
        object.rotation.x = THREE.MathUtils.degToRad(parseFloat(e.target.value));
    };
    document.getElementById("rotY").oninput = e => {
        object.rotation.y = THREE.MathUtils.degToRad(parseFloat(e.target.value));
    };
    document.getElementById("rotZ").oninput = e => {
        object.rotation.z = THREE.MathUtils.degToRad(parseFloat(e.target.value));
    };

    // ==========================
    // Scale
    // ==========================
    document.getElementById("scaleX").oninput = e => {
        object.scale.x = parseFloat(e.target.value);
    };
    document.getElementById("scaleY").oninput = e => {
        object.scale.y = parseFloat(e.target.value);
    };
    document.getElementById("scaleZ").oninput = e => {
        object.scale.z = parseFloat(e.target.value);
    };

    // ==========================
    // Material
    // ==========================
    if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const slot = document.getElementById("materialSlot");
        const addBtn = document.getElementById("addMaterial");
        const removeBtn = document.getElementById("removeMaterial");
        
        slot.innerHTML = "";
        
        materials.forEach((mat, index) => {
            const option = document.createElement("option");
            option.value = index;
            option.textContent = mat.name || "Material " + index;
            slot.appendChild(option);
        });

        let material = materials[0];

        function loadMaterial(index) {
            material = materials[index];
            document.getElementById("matColor").value = "#" + material.color.getHexString();
            document.getElementById("metalness").value = material.metalness ?? 0;
            document.getElementById("roughness").value = material.roughness ?? 1;
            
            // Opacity আপডেট করা হয়েছে
            document.getElementById("opacity").value = material.opacity ?? 1;
            
            document.getElementById("wireframe").checked = material.wireframe;
        }

        loadMaterial(0);

        slot.onchange = () => {
            loadMaterial(parseInt(slot.value));
        };

        // ======================
        // Add Material
        // ======================
        addBtn.onclick = () => {
            materials.push(
                new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    metalness: 0,
                    roughness: 1
                })
            );
            object.material = materials;
            updateInspector(object);
        };

        // ======================
        // Remove Material
        // ======================
        removeBtn.onclick = () => {
            if (materials.length <= 1) {
                alert("At least one material is required.");
                return;
            }
            materials.pop();
            object.material = materials;
            updateInspector(object);
        };

        // ======================
        // Color
        // ======================
        document.getElementById("matColor").oninput = e => {
            material.color.set(e.target.value);
        };

        // ======================
        // Metalness
        // ======================
        document.getElementById("metalness").oninput = e => {
            material.metalness = parseFloat(e.target.value);
        };

        // ======================
        // Roughness
        // ======================
        document.getElementById("roughness").oninput = e => {
            material.roughness = parseFloat(e.target.value);
        };

        // ======================
        // Opacity
        // ======================
        document.getElementById("opacity").oninput = e => {
            const value = parseFloat(e.target.value);

            material.opacity = value;

            // 1 এর কম হলে transparency চালু
            material.transparent = value < 1;

            // Depth write বন্ধ করলে অনেক ক্ষেত্রে ঠিকমতো দেখা যায়
            material.depthWrite = value >= 1;

            material.needsUpdate = true;
        };

        // ======================
        // Wireframe
        // ======================
        document.getElementById("wireframe").onchange = e => {
            material.wireframe = e.target.checked;
        };

        // ======================
        // Texture
        // ======================
        document.getElementById("textureFile").onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                const loader = new THREE.TextureLoader();
                loader.load(
                    reader.result,
                    texture => {
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.flipY = false;
                        material.map = texture;
                        material.needsUpdate = true;
                    }
                );
            };
            reader.readAsDataURL(file);
        };
    }

    // ==========================
    // Visible
    // ==========================
    const visible = document.getElementById("visible");
    visible.checked = object.visible;
    visible.onchange = e => {
        object.visible = e.target.checked;
    };
}