
import * as THREE from '../build/three.module.js';
import { OrbitControls } from '../libs/OrbitControlsiPad.js';
import { TransformControls } from '../libs/jsm/controls/TransformControls.js';
import { ThreeMFLoader } from '../libs/jsm/loaders/3MFLoader.js';

import { OBJLoader2 } from '../libs/jsm/loaders/OBJLoader2.js';
import { MTLLoader } from '../libs/jsm/loaders/MTLLoader.js';
import { MtlObjBridge } from "../libs/jsm/loaders/obj2/bridge/MtlObjBridge.js";
// import { * } from "../libs/jszip.min.js";
import Stats from '../libs/stats.module.js';
import { EffectComposer } from '../libs/jsm/postprocessing/EffectComposer.js';
import { OutlinePass } from '../libs/jsm/postprocessing/OutlinePass.js';
import { RenderPass} from '../libs/jsm/postprocessing/RenderPass.js';
import { ShaderPass} from '../libs/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from '../libs/jsm/shaders/FXAAShader.js';
import { SelectionBox } from './UAVSelectionBox.js';
import { SelectionHelper } from './SelectionHelper.js';

function tnow() {
    return new Date().getTime() / 1000;
}

let color_set_hot = { 
    red:"#DA5543",
    // yellow:"#F7F9D3",
    yellow:"#FFD300",
    orange:"#DE6645",
    white:"#F0FFFC",
    blue:"#BAACE7"
}

// let traj_colors = {
//     drone_0:"#4277ff",
//     drone_1:"#84aff9",
//     drone_2:"#d6e2aa",
//     drone_3:"#ffe877",
//     drone_4:"#ff96a2"
// }
let traj_colors = {
    drone_0:"#ff6750",
    drone_1:"#eac435",
    drone_2:"#345995",
    drone_3:"#05f3a3",
    drone_4:"#e40066"
}

let use_outline_passes = true;
// let use_outline_passes = false;

class ThreeView {
    constructor(opt) {
        let obj = this;
        this.scene = new THREE.Scene();
        this.opt = opt;
        var renderer = this.renderer = new THREE.WebGLRenderer();

        this.width =document.getElementById("urdf").offsetWidth;
        this.height = document.getElementById("urdf").offsetHeight;
        // this.position = $("#urdf").position();

        this.renderer.setSize(this.width, this.height);
        renderer.context.getExtension('OES_standard_derivatives');

        var camera = this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);

        document.getElementById("urdf").appendChild(this.renderer.domElement);
        this.stats = new Stats();
        document.getElementById("stats").appendChild(this.stats.dom);
        // this.stats
        this.camera.position.z = 3.0;
        this.camera.position.x = -3;
        this.camera.position.y = -0.3;
        this.camera.lookAt(0, 0, 0);
        this.camera.up.x = 0;
        this.camera.up.y = 0;
        this.camera.up.z = 1;
        this.camera.near = 0.01;
        // renderer.setClearColor("white", 1);
        this.scene.background = new THREE.Color( 0xcff3fa );
        // this.enable_shadow = true;
        this.enable_shadow = false;
        
        this.raycaster = new THREE.Raycaster();

        this.init_postprocessing();

        let orbit = this.orbit = new OrbitControls(camera, renderer.domElement);
        orbit.update();
        orbit.maxDistance = 20;
        orbit.minDistance = 0.3;
        
        this.transform_control = new TransformControls(camera, renderer.domElement);
        this.transform_control.addEventListener('dragging-changed', function (event) {
            orbit.enabled = !event.value;
            obj.toggle_rangeselect(!obj.enable_rangeselect);
        });

        this.scene.add(this.transform_control);

        this.init_scene();

        this.uavs = {}
        this.uav_cov_spheres = {}
        this.uav_cov_circles = {}
        this.name_uav_id = {}
        this.trajs = {};

        this.uav_waypoint_targets = {}

        this.load_aircraft();

        this.aircraft_model = null;

        this.fused_pose_uavs = {};

        this.enable_rangeselect = true;

        this.pcl = null;

        window.addEventListener( 'mousedown', function(e) {
            obj.onTouchMove(e, "down");
        } );

        window.addEventListener('touchstart', function(e) {
            console.log(e);
            obj.onTouchMove(e, "down");
        });

        window.addEventListener( 'mousemove', function(e) {
            // obj.onTouchMove(e, "mousehover");
        } );

        window.addEventListener( 'resize', function (e) {
            obj.onWindowResize();
        }, false );

        this.init_rangeselect();

        this.count = 0;

        this.last_render_ts = new Date().getTime() / 1000;
    }

    toggle_rangeselect(enable) {
        this.enable_rangeselect = enable;
        this.helper.toggle_rangeselect(enable);
        if (!enable) {
            this.in_range_select = false;
        }
    }

    clear_drone_trajs() {
        for (var ns in this.trajs) {
            this.scene.remove(this.trajs[ns]);
        } 
    }

    update_drone_traj(ns, traj) {
        console.log("Loading traj....");
        if (ns in this.trajs) {
            this.scene.remove(this.trajs[ns]);
        }
        var arr = [];
        
        for (var i in traj) {
            arr.push(new THREE.Vector3(traj[i].x, traj[i].y, traj[i].z ));
        }

        var geometry = new THREE.BufferGeometry().setFromPoints( arr );
        
        var material = new THREE.LineBasicMaterial( { color : traj_colors[ns], linewidth: 20 } );
        
        // Create the final object to add to the scene
        var splineObject = new THREE.Line( geometry, material );     
  

        this.scene.add(splineObject);
        this.trajs[ns] = splineObject;
    }
    
    init_rangeselect() {

        this.selectionBox = new SelectionBox( this.camera, this.scene, 100, this.uavs );

        let selectionBox = this.selectionBox;
        var renderer = this.renderer 
        let helper = this.helper = new SelectionHelper( selectionBox, renderer, 'selectBox' );
        let obj = this;

        this.in_range_select = false;

        document.addEventListener( 'mousedown', function ( event ) {
            // console.log("Start range select");

            if (event.button == 0 && obj.enable_rangeselect) {
                obj.in_range_select = true;
                selectionBox.startPoint.set(
                    ( event.clientX / window.innerWidth ) * 2 - 1,
                    - ( event.clientY / window.innerHeight ) * 2 + 1,
                    0.5 );
            }

        } );
        document.addEventListener( 'mousemove', function ( event ) {
        } );

        document.addEventListener( 'mouseup', function ( event ) {
            if (event.button == 0 && obj.enable_rangeselect && obj.in_range_select) {
                // console.log("Start computing range select");
                selectionBox.endPoint.set(
                    ( event.clientX / window.innerWidth ) * 2 - 1,
                    - ( event.clientY / window.innerHeight ) * 2 + 1,
                    0.5 );
                var ts = tnow();
                var allSelected = selectionBox.selectUAVs();
                // console.log("Time use", tnow() - ts, allSelected);
                obj.selectObjects(allSelected, "select");
            }

        } );
    }

    init_postprocessing() {
        console.log("Init post");
        let renderer = this.renderer;
        renderer.setPixelRatio(window.devicePixelRatio);

        this.outlinePassMouseHover = new OutlinePass(new THREE.Vector2(this.width, this.height), this.scene, this.camera);
        this.outlinePassMouseHover.edgeStrength = 3;
        this.outlinePassMouseHover.edgeThickness = 2.0;
        this.outlinePassMouseHover.visibleEdgeColor.set(color_set_hot.white);

        this.outlinePassSelected = new OutlinePass(new THREE.Vector2(this.width, this.height), this.scene, this.camera);
        this.outlinePassSelected.edgeStrength = 5;
        this.outlinePassSelected.edgeThickness = 5.0;
        this.outlinePassSelected.visibleEdgeColor.set(color_set_hot.red);

        this.outlinePassFused = new OutlinePass(new THREE.Vector2(this.width, this.height), this.scene, this.camera);
        this.outlinePassFused.edgeStrength = 1;
        this.outlinePassSelected.edgeThickness = 1.0;
        this.outlinePassFused.visibleEdgeColor.set(color_set_hot.yellow);
        
        this.composer = new EffectComposer(renderer);
        var renderPass = new RenderPass( this.scene, this.camera );
        this.composer.addPass( renderPass );

        if (use_outline_passes) {
            this.composer.addPass( this.outlinePassFused );
            this.composer.addPass( this.outlinePassMouseHover );
            this.composer.addPass( this.outlinePassSelected );
        }

        let fxaaPass = new ShaderPass( FXAAShader );


		var pixelRatio = renderer.getPixelRatio();
		fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( this.width * pixelRatio );
		fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( this.height * pixelRatio );
        this.composer.addPass( fxaaPass );



        renderer.gammaOutput = true;
        renderer.gammaFactor = 2.2;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.animate();
    }

    set_camera_FLU(x, y, z) {

    }

    onWindowResize() {
        // this.width = $("#urdf").width();
        // this.height = $("#urdf").height();
        
        this.width =document.getElementById("urdf").offsetWidth;
        this.height = document.getElementById("urdf").offsetHeight;
        
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( this.width, this.height );
        this.selectionBox = new SelectionBox( this.camera, this.scene, 100, this.uavs );
        this.init_postprocessing();
        // this.position = $("#urdf").position();
    }

    update_pcl(pcl) {
        if (this.pcl != null) {
            this.scene.remove(this.pcl);            
        }
        this.pcl = pcl.boxes_object();
        this.scene.add(this.pcl);
    }

    load_aircraft() {
        let obj = this;


        var loader = new ThreeMFLoader();
        
        // loader.load( '../models/swarm_drone_2020.3mf', function ( object ) {
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
            // object3d.
            object3d.traverse(function (child) {
                child.castShadow = obj.enable_shadow;
            });

            obj.aircraft_model = object3d;
            var mesh = object3d.children[0];
            // obj.scene.add(object3d);
        };
        let onLoadMtl = function (mtlParseResult) {
            objLoader2.setModelName("swarm_drone");
            objLoader2.setLogging(true, true);
            objLoader2.addMaterials(MtlObjBridge.addMaterialsFromMtlLoader(mtlParseResult));
            objLoader2.load('../models/swarm_drone.obj', callbackOnLoad, null, null, null);
            // objLoader2.load('../models/swarm-drone-0-0-4.obj', callbackOnLoad, null, null, null);
        };
        let mtlLoader = new MTLLoader();
        mtlLoader.load('../models/swarm_drone.mtl', onLoadMtl);
        // mtlLoader.load('../models/swarm-drone-0-0-4.mtl', onLoadMtl);
    }

    create_new_uav(_id) {
        var aircraft = this.aircraft_model.clone();
        aircraft.children[0].name = "UAV"+_id;

        this.scene.add(aircraft);
        this.name_uav_id[aircraft.children[0].name] = _id;
        return aircraft;
    }

    insert_uav(_id) {
        if (this.aircraft_model == null) {
            console.log("AircraftModel not load, waiting");
            return;
        }
        if (!(_id in this.uavs)) {
            console.log("Creating new aircraft instance "+ _id);
            this.uavs[_id] = this.create_new_uav(_id);
            this.uav_cov_spheres[_id] = this.create_cov_sphere();
        }
    }

    has_uav(_id) {
        return _id in this.uavs;
    }

    onTouchMove( event, m_type) {
        var x, y;
        if ( event.changedTouches ) {
            x = event.changedTouches[ 0 ].pageX;
            y = event.changedTouches[ 0 ].pageY;
        } else {
            x = event.clientX;
            y = event.clientY;
        }
        // console.log(this.position);
        // x = x - this.position.left;
        // y = y - this.position.top;
        var mouse = new THREE.Vector2();
        mouse.x = ( x / this.width ) * 2 - 1;
        mouse.y = - ( y / this.height ) * 2 + 1;

        // console.log("check mouse");
        // console.log(mouse);
        if (m_type == "down") {
            this.checkIntersection(mouse, "select");
        } else {
            this.checkIntersection(mouse, "mousehover");            
        }
    }

    selectObjects(objects, e="") {
        var selected = []
        var selected_ids = []
        
        for (var i in objects) {
            let selectedObject = objects[i];
            if (selectedObject.name in this.name_uav_id) {
                console.log("Select " + selectedObject.name);
                selected.push(selectedObject);
                selected_ids.push(this.name_uav_id[selectedObject.name]);
                
            }
            // if (e == "mousehover") {
            //     this.outlinePassMouseHover.selectedObjects = selected;
            // }
        }

        if (selected.length > 0) {
            if (e == "select") {
                this.ui.on_select_uavs(selected_ids);
            }    
        }
    }


    checkIntersection(mouse, e) {
        let t1 = tnow();
        this.raycaster.setFromCamera( mouse, this.camera );
        var intersects = this.raycaster.intersectObjects( [ this.scene ], true );
        if (intersects.length == 0) {
            return;
        }

        var objects = []
        for (var i in intersects) {
            var selectedObject = intersects[i].object;
            objects.push(selectedObject);
        }

        this.selectObjects(objects, e);

        let t2 = tnow();
    }

    create_cov_sphere() {
        var geometry = new THREE.SphereGeometry( 1.0, 10, 10 );
        var material = new THREE.MeshPhongMaterial( {color: color_set_hot.blue} );
        material.opacity=.5;
        material.side = THREE.DoubleSide;
        material.transparent=true;
        var sphere = new THREE.Mesh( geometry, material );
        this.scene.add(sphere);
        return sphere;
    }

    create_cov_circle(yaw_var) {
        //We use 
        // console.log("cov circle from "+ (-yaw_var) +"to"+ yaw_var )
        var geometry = new THREE.CircleGeometry( 0.4, 10, -yaw_var, 2*yaw_var);
        var material = new THREE.MeshPhongMaterial( { color: 0xff0000 } );
        material.opacity=.3;
        var circle = new THREE.Mesh( geometry, material );
        this.scene.add( circle );
        return circle;
    }

    update_uav_pose(_id, pos, quat, vx=null, vy=null, vz=null, covx=0, covy=0, covz=0, covyaw=0, update_yaw_var = false) {
        // console.log(_id)
        // console.log(this.uavs[_id].position);
        this.uavs[_id].position.x = pos.x;
        this.uavs[_id].position.y = pos.y;
        this.uavs[_id].position.z = pos.z;
        this.uavs[_id].quaternion.w = quat.w;
        this.uavs[_id].quaternion.x = quat.x;
        this.uavs[_id].quaternion.y = quat.y;
        this.uavs[_id].quaternion.z = quat.z;
        // if (yaw !== null) {
            // this.uavs[_id].quaternion.setFromEuler(new THREE.Euler(0, 0, yaw));
        // }
        // console.log(this.uav_cov_spheres);
        
        this.uav_cov_spheres[_id].position.x = pos[0];
        this.uav_cov_spheres[_id].position.y = pos[1];
        this.uav_cov_spheres[_id].position.z = pos[2];
        var sa = Math.sqrt(covx);
        var sb = Math.sqrt(covy);
        var sc = Math.sqrt(covz);
        sa = Math.min(Math.max(sa, 0.001), 0.5);
        sb = Math.min(Math.max(sa, 0.001), 0.5);
        sc = Math.min(Math.max(sa, 0.001), 0.5);

        if (sb > 1) {
            sb = 1;
        }

        if (sc > 1) {
            sc = 1;
        }

        this.uav_cov_spheres[_id].scale.set(sa, sb, sc);

        var var_yaw = Math.sqrt(covyaw);
        // console.log("Var Yaw", var_yaw);
        if (update_yaw_var) {
            if (_id in this.uav_cov_circles) {
                this.scene.remove(this.uav_cov_circles[_id]);
            }

            if (var_yaw > 0.15) {
                if (var_yaw > Math.Pi) {
                    var_yaw = Math.Pi;
                } 
                // console.log("Adding yaw var "+ var_yaw);
                var cir = this.create_cov_circle(var_yaw);
                cir.quaternion = this.uavs[_id].quaternion;
                this.uav_cov_circles[_id] = cir;
                cir.position.x = x;
                cir.position.y = y;
                cir.position.z = z;
            }
        }
        // console.log(this.uav_cov_spheres[_id].scale)
        // if (vx !== null) {
            // this.uavs[_id].linear_velocity.set( vx, vy, vz );
        // }

    }

    set_uav_fused_mode(_id) {
        if (! (_id in this.fused_pose_uavs)) {
            if (_id in this.uavs) {
                this.fused_pose_uavs[_id] = this.uavs[_id].children[0];
                this.outlinePassFused.selectedObjects.push(this.uavs[_id].children[0]);
            }
        } 
    }

    clear_uav_fused() {
        this.outlinePassFused.selectedObjects = [];
        this.fused_pose_uavs = {};
    }

    init_scene() {
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
        dirLight.castShadow = this.enable_shadow;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = - 10;
        dirLight.shadow.camera.left = - 10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.near = 0.0;
        dirLight.shadow.camera.far = 200;
        dirLight.shadow.mapSize.set(512, 512);
        this.scene.add(dirLight);


        var dirLight = new THREE.DirectionalLight(0xffffff, 0.0);
        dirLight.position.set(-2, 2, 2);
        dirLight.castShadow = this.enable_shadow;
        dirLight.shadow.camera.top = 5;
        dirLight.shadow.camera.bottom = - 5;
        dirLight.shadow.camera.left = - 5;
        dirLight.shadow.camera.right = 5;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 200;
        dirLight.shadow.mapSize.set(512, 512);
        // this.scene.add(dirLight);

        if (this.opt.chessboard) {
            this.add_chessboard()
        } 
        
        if (this.opt.grid) {
            this.add_grid();
        }

    }
    add_grid() {
        var size = 100;
        var divisions = 100;
        var gridHelper = new THREE.GridHelper(size, divisions, 0x444444, 0x999999);
        gridHelper.quaternion.setFromEuler(new THREE.Euler(- Math.PI / 2, 0, 0));
        this.scene.add(gridHelper);
    }

    add_chessboard() {
        var cbgeometry = new THREE.PlaneGeometry(10, 10, 10, 10);

        // Materials
        var cbmaterials = [];
        var m1 = new THREE.MeshPhongMaterial({ color: 0xeeeeee });
        var m2 = new THREE.MeshPhongMaterial({ color: 0x222222 });
        m1.opacity = 0.8;
        // m1.side = THREE.DoubleSide;
        m2.opacity = 0.8;
        // m2.side = THREE.DoubleSide;
        cbmaterials.push(m1);
        cbmaterials.push(m2);

        var l = cbgeometry.faces.length / 2; // <-- Right here. This should still be 8x8 (64)

        console.log("This should be 64: " + l);// Just for debugging puporses, make sure this is 64

        for (var i = 0; i < l; i++) {
            var j = i * 2; // <-- Added this back so we can do every other 'face'
            cbgeometry.faces[j].materialIndex = ((i + Math.floor(i / 10)) % 2); // The code here is changed, replacing all 'i's with 'j's. KEEP THE 8
            cbgeometry.faces[j + 1].materialIndex = ((i + Math.floor(i / 10)) % 2); // Add this line in, the material index should stay the same, we're just doing the other half of the same face
        }

        cbmaterials.opacity=.8;
        // cbmaterials.side = THREE.DoubleSide;

        // Mesh
        var cb = new THREE.Mesh(cbgeometry, new THREE.MeshFaceMaterial(cbmaterials));
        // var cb = new THREE.Mesh( cbgeometry , new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
				
        cb.receiveShadow = this.enable_shadow;
        cb.position.z = -0.3;
        this.scene.add(cb);
    }

    on_select_uavs(drone_ids) {
        var selectedObjects = [];
        for (var i in drone_ids) {
            // console.log("Select " + this.uavs[drone_ids[i]]);
            if (drone_ids[i] >= 0) {
                selectedObjects.push(this.uavs[drone_ids[i]]);
            }
        }
        // console.log(selectedObjects);
        this.outlinePassSelected.selectedObjects = selectedObjects;
        
        if (drone_ids.length == 1) {
            if (drone_ids[0] >= 0) {
                this.create_aircraft_waypoint(drone_ids[0]);
            }
        } else if (drone_ids.length > 1)  {
            //> 1 then control all
            this.create_aircraft_waypoint(-1);
        }
    }


    create_marker_() {
        var geometry = new THREE.ExtrudeBufferGeometry( smileyShape, extrudeSettings );
        var mesh = new THREE.Mesh( geometry, new THREE.MeshPhongMaterial( { color: "blue", side: THREE.DoubleSide } ) );
        mesh.scale.set(0.001, 0.001, 0.001);
        mesh.quaternion.setFromEuler(new THREE.Euler(-Math.PI/2, 0, 0));
        return mesh;
    }

    get_waypoint_target_pos(_id) {
        // console.log(this.uav_waypoint_targets, _id, this.uav_waypoint_targets[_id].position);

        return this.uav_waypoint_targets[_id].position;
    }

    create_wp_object(_id) {
        console.log("Create waypoint target");
        var geometry = new THREE.BoxBufferGeometry( 0.01, 0.01, 0.01 );
        var object;
        this.uav_waypoint_targets[_id] = object = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: Math.random() * 0xffffff } ) );
        this.scene.add(object);
        return object;
    }

    create_aircraft_waypoint(_id) {
        console.log("Creating wp");
        var object;
        if (! (_id in this.uav_waypoint_targets)) {
            // console.log(_uav_obj);
            object = this.create_wp_object(_id);
        } else {
            object = this.uav_waypoint_targets[_id];
        }

        if (_id == -1) {
            object.position.x = this.uavs[0].position.x;
            object.position.y = this.uavs[0].position.y;
            object.position.z = this.uavs[0].position.z;    
        } else {
            object.position.x = this.uavs[_id].position.x;
            object.position.y = this.uavs[_id].position.y;
            object.position.z = this.uavs[_id].position.z;    
        }
    

        // console.log(object.position);
        this.transform_control.attach(object);

    }
    
    clear_uavs() {
        console.log("clear uav");
        for (var _id in this.uavs) {
            this.uavs[_id].position.z = -10000;
        }
    }

    update_uav_labels() {
        for (var _id in this.uavs) {
            var object = this.uavs[_id];
            //console.log(object.position);

            var pos = object.position.clone();
            pos.z = pos.z + 0.3;
            var pos2d = toScreenPosition(pos, this.camera, this.renderer);
            pos2d.x  = pos2d.x - 15;
            pos2d.y  = pos2d.y - 15;
            this.ui.update_uav_label_pos(_id, pos2d);
        }
    }

    animate() {
        // console.log("anaimate");
        let obj = this;
        requestAnimationFrame(function () {
            // console.log("test");
            obj.animate();
        });

        this.composer.render();
        // this.renderer.render(this.scene, this.camera);
        this.stats.update();
        this.update_uav_labels();
    }


}

function toScreenPosition(position, camera, renderer) {
    var vector = new THREE.Vector3();

    var widthHalf = 0.5*renderer.context.canvas.width;
    var heightHalf = 0.5*renderer.context.canvas.height;

    var matrixWorld = new THREE.Matrix4();
    matrixWorld.compose( position, new THREE.Quaternion(), new THREE.Vector3() );

    vector.setFromMatrixPosition(matrixWorld);
    vector.project(camera);

    vector.x = ( vector.x * widthHalf ) + widthHalf;
    vector.y = - ( vector.y * heightHalf ) + heightHalf;

    return { 
        x: (vector.x/window.devicePixelRatio).toFixed(0),
        y: (vector.y/window.devicePixelRatio).toFixed(0)
    };

};
export { ThreeView };