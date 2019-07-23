
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
        var camera = this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

        // var renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true });
        var renderer = this.renderer = new THREE.WebGLRenderer();
        renderer.setPixelRatio( window.devicePixelRatio);
        // console.log($())
        // console.log($("ur"))
        // console.log($("#urdf").width(), $("#urdf").height() );
        this.renderer.setSize( $("#urdf").width(), $("#urdf").height());
        document.getElementById("urdf").appendChild( this.renderer.domElement );
        this.stats = new Stats();
        document.getElementById("urdf").appendChild( this.stats.dom );
        this.camera.position.z = 1.0;
        this.camera.position.x = -2;
        this.camera.position.y = -0.5;
        this.camera.lookAt(0, 0, 0);
        this.camera.up.x = 0;
        this.camera.up.y = 0;
        this.camera.up.z = 1;
        renderer.setClearColor( "white", 1 );

        renderer.gammaOutput = true;
        renderer.gammaFactor = 2.2;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.animate();


        let orbit = this.orbit = new OrbitControls( camera, renderer.domElement );
		orbit.update();
		let control = new TransformControls( camera, renderer.domElement );
		control.addEventListener( 'dragging-changed', function ( event ) {
			orbit.enabled = ! event.value;
        } );
        
        this.init_scene();

        this.uavs = {}

        this.load_aircraft();

        this.aircraft_mode = null;
    }

    set_camera_FLU(x, y, z) {

    }

    load_aircraft() {
        let obj = this;

        /*
        var loader = new ThreeMFLoader ();
        // var loader = new OBJLoader ();
        loader.load( '../models/swarm-drone-0-0-4-metal-90d2.3mf', function ( object ) {
            object.traverse( function ( child ) {
                child.castShadow = true;
            } );
            obj.scene.add( object );

        } );*/
        // return;
        console.log("loading aircraft");
        let objLoader2 = new OBJLoader2();
        let callbackOnLoad = function ( object3d ) {
            object3d.scale.set(0.001,0.001,0.001);
            obj.scene.add( object3d );
            // console.log( 'Loading complete: ' + modelName );
            // scope._reportProgress( { detail: { text: '' } } );
        };
        let onLoadMtl = function ( mtlParseResult ) {
            objLoader2.setModelName( "swarm_drone" );
            objLoader2.setLogging( true, true );
            objLoader2.addMaterials( MtlObjBridge.addMaterialsFromMtlLoader( mtlParseResult ) );
            objLoader2.load( '../models/swarm-drone-0-0-4.obj', callbackOnLoad, null, null, null );
        };
        let mtlLoader = new MTLLoader();
        mtlLoader.load( '../models/swarm-drone-0-0-4.mtl', onLoadMtl );
    }

    create_new_uav() {
        var geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
        var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        var cube = this.cube = new THREE.Mesh( geometry, material );
        this.scene.add(cube);
        return cube;
    }

    insert_uav(_id) {
        if (!(_id in this.uavs)) {
            this.uavs[_id] = this.create_new_uav();
        }
    }
    

    init_scene() {
        var size = 10;
        var divisions = 10;
        var gridHelper = new THREE.GridHelper( size, divisions,0x440000, 0x004400 );
        gridHelper.quaternion.setFromEuler( new THREE.Euler( - Math.PI / 2, 0, 0 ) ); 
        this.scene.add( gridHelper );


        var dirx = new THREE.Vector3( 1.0, 0, 0 );
        var diry = new THREE.Vector3( 0.0, 1, 0 );
        var dirz = new THREE.Vector3( 0.0, 0, 1 );

        var origin = new THREE.Vector3( 0, 0, 0 );
        var length = 2;
        var hex_x = 0xff0000;
        var hex_y = 0x00ff00;
        var hex_z = 0x0000ff;

        var arrowHelper = new THREE.ArrowHelper( dirx, origin, length, hex_x );
        this.scene.add( arrowHelper );

        var arrowHelper = new THREE.ArrowHelper( diry, origin, length, hex_y );
        this.scene.add( arrowHelper );
        
        var arrowHelper = new THREE.ArrowHelper( dirz, origin, length, hex_z );
        this.scene.add( arrowHelper );

        
        
        var dirLight = new THREE.DirectionalLight( 0xffffff );
        dirLight.position.set( - 0, 40, 50 );
        dirLight.castShadow = true;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = - 25;
        dirLight.shadow.camera.left = - 25;
        dirLight.shadow.camera.right = 25;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 200;
        dirLight.shadow.mapSize.set( 1024, 1024 );
        this.scene.add( dirLight );
        var hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        hemiLight.position.set( 0, 100000, 0 );
        this.scene.add( hemiLight );


        // this.scene.background = new THREE.Color( 0xa0a0a0 );
        // this.scene.fog = new THREE.Fog( 0xa0a0a0, 10, 500 );
        
        // var light = new THREE.AmbientLight( 0x404040 ); // soft white light
        // light.castShadow = true
        // this.scene.add( light );
        var ground = new THREE.Mesh( new THREE.PlaneBufferGeometry( 1000, 1000 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
        ground.rotation.x = 0;``
        ground.position.y = 11;
        ground.receiveShadow = true;
        this.scene.add( ground );
    }

    animate() {
        // console.log("anaimate");
        let obj = this;
        requestAnimationFrame(function() {
            // console.log("test");
            obj.animate();
        });


        this.renderer.render( this.scene, this.camera );
        this.stats.update();

    };
}

export {ThreeView};