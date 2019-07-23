
import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/controls/OrbitControls.js';
import { TransformControls } from '../libs/controls/TransformControls.js';
import { ThreeMFLoader } from '../libs/3MFLoader.js';

import { OBJLoader2 } from '../libs/OBJLoader2.js';
import { MTLLoader } from '../libs/MTLLoader.js';
import { MtlObjBridge } from "../libs/obj2/bridge/MtlObjBridge.js";

import Stats from '../libs/stats.module.js';

class ThreeView {
    constructor() {
        let obj = this;
        this.scene = new THREE.Scene();
        var camera = this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        var renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true });
        // var renderer = this.renderer = new THREE.WebGLRenderer();
        // renderer.setPixelRatio(window.devicePixelRatio);
        // console.log($())
        // console.log($("ur"))
        // console.log($("#urdf").width(), $("#urdf").height() );
        this.renderer.setSize($("#urdf").width(), $("#urdf").height());
        document.getElementById("urdf").appendChild(this.renderer.domElement);
        this.stats = new Stats();
        document.getElementById("urdf").appendChild(this.stats.dom);
        this.camera.position.z = 1.0;
        this.camera.position.x = -2;
        this.camera.position.y = -0.5;
        this.camera.lookAt(0, 0, 0);
        this.camera.up.x = 0;
        this.camera.up.y = 0;
        this.camera.up.z = 1;
        // renderer.setClearColor("white", 1);
        this.scene.background = new THREE.Color( 0xcff3fa );

        renderer.gammaOutput = true;
        renderer.gammaFactor = 2.2;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.animate();


        let orbit = this.orbit = new OrbitControls(camera, renderer.domElement);
        orbit.update();
        let control = new TransformControls(camera, renderer.domElement);
        control.addEventListener('dragging-changed', function (event) {
            orbit.enabled = !event.value;
        });

        this.init_scene();

        this.uavs = {}

        this.load_aircraft();

        this.aircraft_model = null;
    }

    set_camera_FLU(x, y, z) {

    }

    load_aircraft() {
        let obj = this;


        var loader = new ThreeMFLoader();
        // var loader = new OBJLoader ();
        // loader.load( '../models/swarm-drone-0-0-4.3mf', function ( object ) {
        //     object.traverse( function ( child ) {
        //         child.castShadow = true;
        //     } );
        //     obj.scene.add( object );

        // } );
        // return;
        console.log("loading aircraft");
        let objLoader2 = new OBJLoader2();
        let callbackOnLoad = function (object3d) {
            object3d.castShadow = true;
            object3d.scale.set(0.001, 0.001, 0.001);
            // obj.scene.add(object3d);
            object3d.traverse(function (child) {
                // child.castShadow = true;
            });

            obj.aircraft_model = object3d;
            // console.log( 'Loading complete: ' + modelName );
            // scope._reportProgress( { detail: { text: '' } } );
        };
        let onLoadMtl = function (mtlParseResult) {
            objLoader2.setModelName("swarm_drone");
            objLoader2.setLogging(true, true);
            objLoader2.addMaterials(MtlObjBridge.addMaterialsFromMtlLoader(mtlParseResult));
            objLoader2.load('../models/swarm-drone-0-0-4.obj', callbackOnLoad, null, null, null);
        };
        let mtlLoader = new MTLLoader();
        mtlLoader.load('../models/swarm-drone-0-0-4.mtl', onLoadMtl);
    }

    create_new_uav() {
        let aircraft = this.aircraft_model.clone();
        this.scene.add(aircraft);
        return aircraft;
    }

    insert_uav(_id) {
        if (this.aircraft_model == null) {
            console.log("AircraftModel not load, waiting");
            return;
        }
        if (!(_id in this.uavs)) {
            console.log("Creating new aircraft instance "+ _id);
            this.uavs[_id] = this.create_new_uav();
            console.log(this.uavs);
        }
    }

    has_uav(_id) {
        return _id in this.uavs;
    }

    update_uav_pose(_id, x, y, z, yaw) {
        // console.log(_id)
        this.uavs[_id].position.x = x;
        this.uavs[_id].position.y = y;
        this.uavs[_id].position.z = z;
        if (yaw !== null) {
            this.uavs[_id].quaternion.setFromEuler(new THREE.Euler(0, 0, yaw));
        }

    }


    init_scene() {
        // var size = 10;
        // var divisions = 10;
        // var gridHelper = new THREE.GridHelper(size, divisions, 0x440000, 0x004400);
        // gridHelper.quaternion.setFromEuler(new THREE.Euler(- Math.PI / 2, 0, 0));
        // this.scene.add(gridHelper);


        var dirx = new THREE.Vector3(1.0, 0, 0);
        var diry = new THREE.Vector3(0.0, 1, 0);
        var dirz = new THREE.Vector3(0.0, 0, 1);

        var origin = new THREE.Vector3(0, 0, 0);
        var length = 1.0;
        var hex_x = 0xff0000;
        var hex_y = 0x00ff00;
        var hex_z = 0x0000ff;

        var arrowHelper = new THREE.ArrowHelper(dirx, origin, length, hex_x);
        this.scene.add(arrowHelper);

        var arrowHelper = new THREE.ArrowHelper(diry, origin, length, hex_y);
        this.scene.add(arrowHelper);

        var arrowHelper = new THREE.ArrowHelper(dirz, origin, length, hex_z);
        this.scene.add(arrowHelper);



        var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(2, 2, 10);
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = - 10;
        dirLight.shadow.camera.left = - 10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 200;
        dirLight.shadow.mapSize.set(256, 256);
        this.scene.add(dirLight);


        var dirLight = new THREE.DirectionalLight(0xffffff, 0.0);
        dirLight.position.set(-2, 2, 2);
        // dirLight.castShadow = true;
        dirLight.shadow.camera.top = 5;
        dirLight.shadow.camera.bottom = - 5;
        dirLight.shadow.camera.left = - 5;
        dirLight.shadow.camera.right = 5;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 200;
        dirLight.shadow.mapSize.set(-128, 128);
        // this.scene.add(dirLight);

    
        this.chessboard()
    }

    chessboard() {
        var cbgeometry = new THREE.PlaneGeometry(10, 10, 10, 10);

        // Materials
        var cbmaterials = [];

        cbmaterials.push(new THREE.MeshPhongMaterial({ color: 0xeeeeee }));
        cbmaterials.push(new THREE.MeshPhongMaterial({ color: 0x222222 }));

        var l = cbgeometry.faces.length / 2; // <-- Right here. This should still be 8x8 (64)

        console.log("This should be 64: " + l);// Just for debugging puporses, make sure this is 64

        for (var i = 0; i < l; i++) {
            var j = i * 2; // <-- Added this back so we can do every other 'face'
            cbgeometry.faces[j].materialIndex = ((i + Math.floor(i / 10)) % 2); // The code here is changed, replacing all 'i's with 'j's. KEEP THE 8
            cbgeometry.faces[j + 1].materialIndex = ((i + Math.floor(i / 10)) % 2); // Add this line in, the material index should stay the same, we're just doing the other half of the same face
        }

        // Mesh
        var cb = new THREE.Mesh(cbgeometry, new THREE.MeshFaceMaterial(cbmaterials));
        // var cb = new THREE.Mesh( cbgeometry , new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
				
        // cb.receiveShadow = true;
        cb.position.z = -0.1;
        this.scene.add(cb);
    }

    animate() {
        // console.log("anaimate");
        let obj = this;
        requestAnimationFrame(function () {
            // console.log("test");
            obj.animate();
        });


        this.renderer.render(this.scene, this.camera);
        this.stats.update();

    };
}

export { ThreeView };