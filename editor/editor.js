export class Editor {

    constructor() {

        this.scene = null;

        this.camera = null;

        this.renderer = null;

        this.controls = null;

        this.selected = null;

        this.objects = [];

    }

    add(object) {

        this.scene.add(object);

        this.objects.push(object);

    }

    remove(object) {

        this.scene.remove(object);

        this.objects =
            this.objects.filter(o => o !== object);

    }

    select(object) {

        this.selected = object;

        console.log("Selected :", object.name);

    }

}