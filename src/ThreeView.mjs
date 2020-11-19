
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
import { RenderPass } from '../libs/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../libs/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from '../libs/jsm/shaders/FXAAShader.js';
import { SelectionBox } from './UAVSelectionBox.js';
import { SelectionHelper } from './SelectionHelper.js';
import { bsplineinterpolate } from "../libs/b-spline.js"
import { Projector } from "../libs/jsm/renderers/Projector.js"

function tnow() {
    return new Date().getTime() / 1000;
}

let color_set_hot = {
    red: "#DA5543",
    // yellow:"#F7F9D3",
    yellow: "#FFD300",
    orange: "#DE6645",
    white: "#F0FFFC",
    blue: "#BAACE7"
}

// let traj_colors = {
//     drone_0:"#4277ff",
//     drone_1:"#84aff9",
//     drone_2:"#d6e2aa",
//     drone_3:"#ffe877",
//     drone_4:"#ff96a2"
// }
let traj_colors = {
    debug: "#4277ff",
    drone_0: "#ff6750",
    drone_1: "#eac435",
    drone_2: "#345995",
    drone_3: "#05f3a3",
    drone_4: "#e40066"
}


let uav_colors = [
    "#ff6750",
    "#eac435",
    "#345995",
    "#05f3a3",
    "#e40066",
    "#4277ff",
]

let use_outline_passes = true;
// let use_outline_passes = false;

class ThreeView {
    constructor(opt) {
        let obj = this;
        this.scene = new THREE.Scene();
        this.opt = opt;
        var renderer = this.renderer = new THREE.WebGLRenderer();

        this.width = document.getElementById("urdf").offsetWidth;
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

        this.chessboard_z = -0.05;
        this.hover_outline = false;
        // renderer.setClearColor("white", 1);
        this.scene.background = new THREE.Color(0xcff3fa);
        this.enable_shadow = true;
        // this.enable_shadow = false;

        this.raycaster = new THREE.Raycaster();


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
        this.uavs_ground = {}
        this.uavs_line = {}

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

        this.detections = {};
        
        this.on_right_down = false;
        this.right_start_y = 0;
        this.last_evt = null;

        this.init_postprocessing();

        window.addEventListener('mousedown', function (e) {
            obj.onTouchMove(e, "down");
        });

        window.addEventListener('mouseup', function (e) {
            obj.onTouchMove(e, "up");
        });

        window.addEventListener('touchstart', function (e) {
            console.log(e);
            obj.onTouchMove(e, "down");
        });

        window.addEventListener('mousemove', function (e) {
            obj.onTouchMove(e, "mousehover");
        });

        window.addEventListener('resize', function (e) {
            obj.onWindowResize();
        }, false);

        this.init_rangeselect();

        this.count = 0;

        this.last_render_ts = new Date().getTime() / 1000;

        var loader = new THREE.FontLoader();

        loader.load('fonts/helvetiker_regular.typeface.json', function (font) {
            console.log(obj.font)
            obj.font = font;
        });
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
            arr.push(new THREE.Vector3(traj[i].x, traj[i].y, traj[i].z));
        }

        var geometry = new THREE.BufferGeometry().setFromPoints(arr);

        var material = new THREE.LineBasicMaterial({ color: traj_colors[ns], linewidth: 20 });

        // Create the final object to add to the scene
        var splineObject = new THREE.Line(geometry, material);


        this.scene.add(splineObject);
        this.trajs[ns] = splineObject;
    }

    //int32 order
    // int64 traj_id
    // time start_time

    // float64[] knots
    // geometry_msgs/Point[] pos_pts

    // float64[] yaw_pts
    // float64 yaw_dt

    update_drone_traj_bspline(ns, bspline) {
        // console.log(bspline);

        var bs_pts = 50.0;
        var knts = [];
        var pts = [];
        var traj = [];
        for (var knt of bspline.knots) {
            knts.push(knt);
        }

        for (var p of bspline.pos_pts) {
            pts.push([p.x, p.y, p.z]);
        }

        // console.log('Knots', knts);
        // console.log("Points", pts);
        for (var t = 0; t < 1; t += 1 / bs_pts) {
            var pos = bsplineinterpolate(t, 3, pts, knts);
            traj.push({
                'x': pos[0],
                'y': pos[1],
                'z': pos[2]
            });
        }

        this.update_drone_traj(ns, traj);
    }

    init_rangeselect() {

        this.selectionBox = new SelectionBox(this.camera, this.scene, 100, this.uavs);

        let selectionBox = this.selectionBox;
        var renderer = this.renderer
        let helper = this.helper = new SelectionHelper(selectionBox, renderer, 'selectBox');
        let obj = this;

        this.in_range_select = false;

        document.addEventListener('mousedown', function (event) {
            // console.log("Start range select");

            if (event.button == 0 && obj.enable_rangeselect) {
                obj.in_range_select = true;
                selectionBox.startPoint.set(
                    (event.clientX / window.innerWidth) * 2 - 1,
                    - (event.clientY / window.innerHeight) * 2 + 1,
                    0.5);
            }
        });
        document.addEventListener('mousemove', function (event) {
        });

        document.addEventListener('mouseup', function (event) {
            if (event.button == 0 && obj.enable_rangeselect && obj.in_range_select) {
                // console.log("Start computing range select");
                selectionBox.endPoint.set(
                    (event.clientX / window.innerWidth) * 2 - 1,
                    - (event.clientY / window.innerHeight) * 2 + 1,
                    0.5);
                var ts = tnow();
                var allSelected = selectionBox.selectUAVs();
                // console.log("Time use", tnow() - ts, allSelected);
                obj.selectObjects(allSelected, "select");
            }

        });
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

        this.outlinePassSelected.selectedObjects = this.highlightedObjects;

        this.outlinePassFused = new OutlinePass(new THREE.Vector2(this.width, this.height), this.scene, this.camera);
        this.outlinePassFused.edgeStrength = 1;
        this.outlinePassSelected.edgeThickness = 1.0;
        this.outlinePassFused.visibleEdgeColor.set(color_set_hot.yellow);

        this.composer = new EffectComposer(renderer);
        var renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        if (use_outline_passes) {
            // this.composer.addPass( this.outlinePassFused );
            if (this.hover_outline) {
                this.composer.addPass(this.outlinePassMouseHover);
            }
            this.composer.addPass(this.outlinePassSelected);
        }

        let fxaaPass = new ShaderPass(FXAAShader);


        var pixelRatio = renderer.getPixelRatio();
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (this.width * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (this.height * pixelRatio);
        this.composer.addPass(fxaaPass);



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

        this.width = document.getElementById("urdf").offsetWidth;
        this.height = document.getElementById("urdf").offsetHeight;

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.selectionBox = new SelectionBox(this.camera, this.scene, 100, this.uavs);
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
        aircraft.children[0].name = "UAV" + _id;

        this.scene.add(aircraft);
        this.name_uav_id[aircraft.children[0].name] = _id;
        return aircraft;
    }


    create_uav_ground(_id) {
        const geometry = new THREE.RingGeometry( 0.16, 0.2, 32 );
        var gizmoLineMaterial = new THREE.MeshBasicMaterial( {
            depthTest: false,
            depthWrite: false,
            transparent: true,
            linewidth: 1,
            fog: false,
            color:uav_colors[_id]
        } );
        gizmoLineMaterial.opacity = 0.8;
        var _object = new THREE.Mesh(geometry, gizmoLineMaterial);
        this.scene.add(_object);
        return _object;
    }


    create_uav_line(_id) {
        const points = [];
        const material = new THREE.LineBasicMaterial( { color:  uav_colors[_id]} );
        points.push( new THREE.Vector3( - 0.1, 0, 0 ) );
        points.push( new THREE.Vector3( 0.1, 0, 0 ) );

        var line_geometry = new THREE.BufferGeometry().setFromPoints( points );
        line_geometry.dynamic = true;
        var _line = new THREE.Line( line_geometry, material );
        this.scene.add( _line );
        return _line;
    }

    insert_uav(_id) {
        if (this.aircraft_model == null) {
            console.log("AircraftModel not load, waiting");
            return;
        }
        if (!(_id in this.uavs)) {
            console.log("Creating new aircraft instance " + _id);
            this.uavs[_id] = this.create_new_uav(_id);
            this.uav_cov_spheres[_id] = this.create_cov_sphere();
            this.uavs_ground[_id] = this.create_uav_ground(_id);
            this.uavs_line[_id] = this.create_uav_line(_id);
        }
    }

    has_uav(_id) {
        return _id in this.uavs;
    }


    on_mouse_target_position(event, fire = false, z_off = 0) {
        var z = -1;
        var _id = -1;
        if (this.ui.select_id >= 0) {
            _id = this.ui.select_id;
        } else if (this.ui.primary_id >= 0) {
            _id = this.ui.primary_id;
        }

        if (_id >= 0 && _id in this.uavs) {
            z = -this.uavs[_id].position.z;
        }

        var planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), z);
        var mv = new THREE.Vector3(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1,
            0.5);
        var raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mv, this.camera);
        var _tmp;
        var pos = raycaster.ray.intersectPlane(planeZ, _tmp);
        // console.log("x: " + pos.x + ", y: " + pos.y + ", z:", pos.z);
        if (pos.z != null) {
            pos.z += z_off;
            this.create_aircraft_waypoint(this.ui.select_id, pos);
            if (fire) {
                if (this.ui.flyto_mode) {
                    this.ui.send_command("flyto");
                }
            }
        }
    }

    onTouchMove(event, m_type) {
        var x, y;
        if (event.changedTouches) {
            x = event.changedTouches[0].pageX;
            y = event.changedTouches[0].pageY;
        } else {
            x = event.clientX;
            y = event.clientY;
        }
        // console.log(this.position);
        // x = x - this.position.left;
        // y = y - this.position.top;
        var mouse = new THREE.Vector2();
        mouse.x = (x / this.width) * 2 - 1;
        mouse.y = - (y / this.height) * 2 + 1;

        if (m_type == "down" && event.button == 2) {
            this.on_right_down = true;
            this.right_start_y = mouse.y;
            this.last_evt = event;
            // console.log("Right Down");
        }

        var z_off = 0;
        if (this.on_right_down) {
            z_off = mouse.y - this.right_start_y;
        }

        if (m_type == "down" && event.button == 0) {
            this.checkIntersection(mouse, "select");
        } else 
        if (m_type == "up" && event.button == 2) {
            this.on_right_down = false;
            console.log("Right Click. Sending fly to command");
            this.on_mouse_target_position(this.last_evt, true, z_off);
        } else {
            // console.log("Check mouse hover");
            if (this.hover_outline) {
                this.checkIntersection(mouse, "mousehover");
            }

            if (this.ui.flyto_mode) {
                if (this.on_right_down) {
                    this.on_mouse_target_position(this.last_evt, false, z_off);
                } else {
                    this.on_mouse_target_position(event, false, z_off);
                }
            }

        }

    }

    selectObjects(objects, e = "") {
        var selected = []
        var selected_ids = []

        for (var i in objects) {
            let selectedObject = objects[i];
            if (selectedObject.name in this.name_uav_id) {
                console.log("Select " + selectedObject.name);
                selected.push(selectedObject);
                selected_ids.push(this.name_uav_id[selectedObject.name]);

            }
            if (e == "mousehover" && this.hover_outline) {
                this.outlinePassMouseHover.selectedObjects = selected;
            }
        }

        if (selected.length > 0) {
            if (e == "select") {
                this.ui.on_select_uavs(new Set(selected_ids));
            }
        }
    }


    checkIntersection(mouse, e) {
        let t1 = tnow();
        this.raycaster.setFromCamera(mouse, this.camera);
        var intersects = this.raycaster.intersectObjects([this.scene], true);
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
        var geometry = new THREE.SphereGeometry(0.01, 0.01, 0.01);
        var material = new THREE.MeshPhongMaterial({ color: color_set_hot.blue });
        material.opacity = .5;
        material.side = THREE.DoubleSide;
        material.transparent = true;
        var sphere = new THREE.Mesh(geometry, material);
        this.scene.add(sphere);
        return sphere;
    }

    create_cov_circle(yaw_var) {
        //We use 
        // console.log("cov circle from "+ (-yaw_var) +"to"+ yaw_var )
        var geometry = new THREE.CircleGeometry(0.4, 10, -yaw_var, 2 * yaw_var);
        var material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        material.opacity = .3;
        var circle = new THREE.Mesh(geometry, material);
        this.scene.add(circle);
        return circle;
    }

    update_uav_pose(_id, pos, quat, vx = null, vy = null, vz = null, covx = 0, covy = 0, covz = 0, covyaw = 0, update_yaw_var = false) {
        // console.log(_id)
        // console.log(this.uavs[_id].position);
        this.uavs[_id].position.x = pos.x;
        this.uavs[_id].position.y = pos.y;
        this.uavs[_id].position.z = pos.z;
        this.uavs[_id].quaternion.w = quat.w;
        this.uavs[_id].quaternion.x = quat.x;
        this.uavs[_id].quaternion.y = quat.y;
        this.uavs[_id].quaternion.z = quat.z;

        this.uavs_ground[_id].position.x = pos.x;
        this.uavs_ground[_id].position.y = pos.y;
        this.uavs_ground[_id].position.z = this.chessboard_z + 0.02;


        var line_pts = this.uavs_line[_id].geometry.attributes.position.array;
        line_pts[0] = pos.x;
        line_pts[1] = pos.y;
        line_pts[2] = pos.z;

        line_pts[3] = pos.x;
        line_pts[4] = pos.y;
        line_pts[5] = this.chessboard_z;
        
        this.uavs_line[_id].geometry.attributes.position.needsUpdate = true;
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

    update_detection(_id, target_id, rel_pos, inv_dep) {
        var _det_id = _id * 10000 + target_id;
        console.log("Detection ", _id, "->", target_id, " [", rel_pos, "]", "D", 1 / inv_dep);

        var arrowHelper;

        var direction = rel_pos;
        var euler = new THREE.Euler(0, 0, 0);
        euler.setFromQuaternion(this.uavs[_id].quaternion);
        euler = new THREE.Euler(0, 0, euler.z);
        direction.applyEuler(euler);
        direction.normalize();

        var v = new THREE.Vector3(
            this.uavs[_id].position.x,
            this.uavs[_id].position.y,
            this.uavs[_id].position.z);

        if (_det_id in this.detections) {
            arrowHelper = this.detections[_det_id].arrow;
            arrowHelper.position = this.uavs[_id].position;
            arrowHelper.setLength(1 / inv_dep);
            arrowHelper.setDirection(direction);
        } else {
            var length = 1 / inv_dep;
            var hex = 0xff8000;

            arrowHelper = new THREE.ArrowHelper(direction, v, length, hex);
            this.scene.add(arrowHelper);

            this.detections[_det_id] = {
                arrow: arrowHelper,
                source_id: _id,
                target_id: target_id
            };

            // console.log(arrowHelper);
        }

        var d = new Date();
        this.detections[_det_id].time = d.getSeconds();
        direction.multiplyScalar(1.0 / inv_dep);
        v.add(direction);
        this.detections[_det_id].tgt_pos = v;
    }

    set_uav_fused_mode(_id) {
        if (!(_id in this.fused_pose_uavs)) {
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

        const geometry = new THREE.RingGeometry( 0.16, 0.2, 32 );
        var gizmoLineMaterial = new THREE.MeshBasicMaterial( {
            depthTest: false,
            depthWrite: false,
            transparent: true,
            linewidth: 1,
            fog: false,
            color:"#FFB6C1"
        } );
        gizmoLineMaterial.opacity = 0.8;
        var _object = new THREE.Mesh(geometry, gizmoLineMaterial);
        this.scene.add(_object);
        this.ground_target = _object;
        console.log("Creating ground object");


        var dirx = new THREE.Vector3(1.0, 0, 0);
        var diry = new THREE.Vector3(0.0, 1.0, 0);
        var dirz = new THREE.Vector3(0.0, 0, 1.0);

        var origin = new THREE.Vector3(0, 0, 0);
        var length = 0.3;
        var hex_x = 0xff0000;
        var hex_y = 0x00ff00;
        var hex_z = 0x0000ff;

        var arrowHelperX = new THREE.ArrowHelper(dirx, origin, length, hex_x);
        this.scene.add(arrowHelperX);

        var arrowHelperY = new THREE.ArrowHelper(diry, origin, length, hex_y);
        this.scene.add(arrowHelperY);

        var arrowHelperZ = new THREE.ArrowHelper(dirz, origin, length, hex_z);
        this.scene.add(arrowHelperZ);

        this.arrowHelperX = arrowHelperX;
        this.arrowHelperY = arrowHelperY;
        this.arrowHelperZ = arrowHelperZ;



        const points = [];
        const material = new THREE.LineBasicMaterial( { color:  "#FFFFE0" } );
        points.push( new THREE.Vector3( - 0.01, 0, 0 ) );
        points.push( new THREE.Vector3( 0.01, 0, 0 ) );

        var line_geometry = new THREE.BufferGeometry().setFromPoints( points );
        line_geometry.dynamic = true;
        this.tgt_line = new THREE.Line( line_geometry, material );

        this.scene.add( this.tgt_line );

        this.highlightedObjects = [arrowHelperX, arrowHelperY, arrowHelperZ, this.ground_target, this.tgt_line];

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

        cbmaterials.opacity = .8;
        // cbmaterials.side = THREE.DoubleSide;

        // Mesh
        var cb = new THREE.Mesh(cbgeometry, new THREE.MeshFaceMaterial(cbmaterials));
        // var cb = new THREE.Mesh( cbgeometry , new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );

        cb.receiveShadow = this.enable_shadow;
        cb.position.z = this.chessboard_z;
        this.scene.add(cb);
    }

    on_select_uavs(drone_ids) {
        drone_ids = Array.from(drone_ids);
        var selectedObjects = this.highlightedObjects;
        for (var i in drone_ids) {
            // console.log("Select " + this.uavs[drone_ids[i]]);
            if (drone_ids[i] >= 0) {
                selectedObjects.push(this.uavs[drone_ids[i]]);
                selectedObjects.push(this.uavs_ground[drone_ids[i]]);
                selectedObjects.push(this.uavs_line[drone_ids[i]]);
            }
        }
        // console.log(selectedObjects);
        this.outlinePassSelected.selectedObjects = selectedObjects;

        if (drone_ids.length == 1) {
            if (drone_ids[0] >= 0) {
                this.create_aircraft_waypoint(drone_ids[0]);
            }
        } else if (drone_ids.length > 1) {
            //> 1 then control all
            this.create_aircraft_waypoint(-1);
        }
    }


    create_marker_() {
        var geometry = new THREE.ExtrudeBufferGeometry(smileyShape, extrudeSettings);
        var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: "blue", side: THREE.DoubleSide }));
        mesh.scale.set(0.001, 0.001, 0.001);
        mesh.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        return mesh;
    }

    get_waypoint_target_pos(_id) {
        // console.log(this.uav_waypoint_targets, _id, this.uav_waypoint_targets[_id].position);

        return this.uav_waypoint_targets[_id].position;
    }

    create_wp_object(_id) {
        var geometry = new THREE.BoxBufferGeometry(0.001, 0.001, 0.001);
        var object;
        this.uav_waypoint_targets[_id] = object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff }));
        this.scene.add(object);
        return object;
    }

    create_aircraft_waypoint(_id, pos = null) {
        // console.log("Creating wp", _id);
        var object;
        if (!(_id in this.uav_waypoint_targets)) {
            // console.log(_uav_obj);
            object = this.create_wp_object(_id);
        } else {
            object = this.uav_waypoint_targets[_id];
        }

        if (pos == null) {
            var pos = {
                x:0,
                y:0,
                z:0
            }

            if (_id == -1) {
                pos.x = this.uavs[this.ui.primary_id].position.x;
                pos.y = this.uavs[this.ui.primary_id].position.y;
                pos.z = this.uavs[this.ui.primary_id].position.z;
            } else {
                pos.x = this.uavs[_id].position.x;
                pos.y = this.uavs[_id].position.y;
                pos.z = this.uavs[_id].position.z;
            }
        }

        object.position.x = pos.x;
        object.position.y = pos.y;
        object.position.z = pos.z;

        // this.transform_control.attach(object);
        this.set_waypoint_helper_position(pos);
    }


    set_waypoint_helper_position(pos) {
        this.ground_target.position.x = pos.x;
        this.ground_target.position.y = pos.y;
        this.ground_target.position.z = this.chessboard_z + 0.02;

        this.arrowHelperX.position.x = pos.x;
        this.arrowHelperX.position.y = pos.y;
        this.arrowHelperX.position.z = pos.z;


        this.arrowHelperY.position.x = pos.x;
        this.arrowHelperY.position.y = pos.y;
        this.arrowHelperY.position.z = pos.z;

        this.arrowHelperZ.position.x = pos.x;
        this.arrowHelperZ.position.y = pos.y;
        this.arrowHelperZ.position.z = pos.z;

        var line_pts = this.tgt_line.geometry.attributes.position.array;
        line_pts[0] = pos.x;
        line_pts[1] = pos.y;
        line_pts[2] = pos.z;

        line_pts[3] = pos.x;
        line_pts[4] = pos.y;
        line_pts[5] = this.chessboard_z;
        
        this.tgt_line.geometry.attributes.position.needsUpdate = true;
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
            pos2d.x = pos2d.x - 50;
            pos2d.y = pos2d.y - 15;
            this.ui.update_uav_label_pos(_id, pos2d);
        }


        var d = new Date();
        var n = d.getSeconds();

        var delete_list = [];
        for (var _det in this.detections) {
            var t = this.detections[_det].time;
            if (n - t > 2.0) {
                this.ui.remove_detection_label(
                    this.detections[_det].source_id,
                    this.detections[_det].target_id);
                this.scene.remove(this.detections[_det].arrow);
                delete this.detections[_det];

            } else {
                var pos = this.detections[_det].tgt_pos.clone();
                var pos2d = toScreenPosition(pos, this.camera, this.renderer);
                pos2d.x = pos2d.x - 80;
                pos2d.y = pos2d.y;
                this.ui.update_detection_label_pos(
                    this.detections[_det].source_id,
                    this.detections[_det].target_id, pos2d);
            }
        }

    }

    animate() {
        // console.log("anaimate");
        let obj = this;
        requestAnimationFrame(function () {
            // console.log("test");
            setTimeout(function () {
                obj.animate()
            }, 30);
        });

        this.composer.render();
        // this.renderer.render(this.scene, this.camera);
        this.stats.update();
        this.update_uav_labels();
    }


}

function toScreenPosition(position, camera, renderer) {
    var vector = new THREE.Vector3();

    var widthHalf = 0.5 * renderer.context.canvas.width;
    var heightHalf = 0.5 * renderer.context.canvas.height;

    var matrixWorld = new THREE.Matrix4();
    matrixWorld.compose(position, new THREE.Quaternion(), new THREE.Vector3());

    vector.setFromMatrixPosition(matrixWorld);
    vector.project(camera);

    vector.x = (vector.x * widthHalf) + widthHalf;
    vector.y = - (vector.y * heightHalf) + heightHalf;

    return {
        x: (vector.x / window.devicePixelRatio).toFixed(0),
        y: (vector.y / window.devicePixelRatio).toFixed(0)
    };

};
export { ThreeView };