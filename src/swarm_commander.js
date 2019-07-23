function _base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

  
class SwarmCommander {
    constructor(ui) {
        this.mav = new MAVLink(null, 0, 0);
        this.ui = ui;

        this.select_id = -1;
        this._lps_time = 0;
        let ros = this.ros = new ROSLIB.Ros({
            url: "ws://127.0.0.1:9090"
        });
        let self = this;
        this.ui.cmder = self;

        let _ui = ui;
        ros.on("connection", function () {
            // console.log("Connected to websocket server.");
            _ui.set_ros_conn("CONNECTED");
        });
        
        ros.on('error', function(error) {
            // console.log('Error connecting to websocket server: ', error);
            _ui.set_ros_conn("ERROR");
        });
        
        ros.on('close', function() {
            // console.log('Connection to websocket server closed.');
            _ui.set_ros_conn("CLOSED");
        });
        

    this.remote_nodes_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/uwb_node/remote_nodes",
            messageType: "inf_uwb_ros/remote_uwb_info"
          });
       this.remote_nodes_listener.subscribe(function(msg) {
           self.on_remote_nodes_info(msg);
       });



    this.incoming_data_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/uwb_node/incoming_broadcast_data",
            messageType: "inf_uwb_ros/incoming_broadcast_data"
        });

        this.incoming_data_listener.subscribe(function (incoming_msg) {
            self.on_incoming_data(incoming_msg);
        });


      this.send_uwb_msg = new ROSLIB.Topic({
            ros : ros,
            name : '/uwb_node/send_broadcast_data',
            messageType : 'inf_uwb_ros/data_buffer'
          });
     
    }

    on_incoming_data(incoming_msg) {
        let buf = _base64ToArrayBuffer(incoming_msg.data);
        // console.log(buf);
        let msgs = this.mav.parseBuffer(buf);
        // console.log(r);
        for (var k in msgs) {
          let msg = msgs[k];
          if (msg.name == "NODE_REALTIME_INFO") {
            this.on_drone_realtime_info_recv(incoming_msg.remote_id, incoming_msg.lps_time, msg);
          } else if (msg.name == "DRONE_STATUS") {
            this.on_drone_status_recv(incoming_msg.remote_id, incoming_msg.lps_time, msg);
          }
        }
    }

    on_remote_nodes_info(msg) {
        var avail = 0;
        for (var i in msg.active) {
          // console.log(i);
          avail += msg.active[i];
        }
        this.ui.set_available_drone_num(avail);
        this.ui.set_total_drone_num(msg.node_ids.length);
        this.ui.set_lps_time(msg.sys_time);
        this.ui.set_self_id(msg.self_id);
    }

    on_drone_status_recv(_id, lps_time, status) {
        // console.log(status);
        this.ui.set_drone_status(_id, status)
        // this.ui.set_bat_level(_id, status.bat_vol);
        // this.ui.set_drone_lps_time(_id, lps_time);
        // this.ui.set_drone_control_auth(_id, status.ctrl_auth);
        // this.ui.set_drone_control_mode(_id, status.ctrl_mode);
        // this.ui.set_drone_selfpose(status.x, status.y, status.z);
    }

    on_drone_vicon_pose(_id, pose) {

    }

    on_drone_realtime_info_recv(_id, lps_time, info) {

    }

    send_takeoff_cmd(_id) {
        console.log("Will send takeoff command");
        let takeoff_cmd = 5;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id,  takeoff_cmd, 10000, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_landing_cmd(_id) {
        console.log("Will send landing command");
        let landing_cmd = 6;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, landing_cmd, 0, 3000, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_emergency_cmd() {
        console.log("Will send emergency command");
        let landing_cmd = 6;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, -1, landing_cmd, 1, 10000, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_msg_to_swarm(_msg) {
        let _data = _msg.pack(this.mav);
        var msg = new ROSLIB.Message({data : _data});
        this.send_uwb_msg.publish(msg);
    }
}


function tnow() {
    return new Date().getTime() / 1000;
}


class SwarmGCSUI {
    constructor() {
        let obj = this;
        this.view = new Vue({
            el: '#container',
            data: {
                self_id: 0,
                remote_nodes: 0,
                available_nodes: 0,
                lps_time: 0,
                ros_conn: "UNCONNECTED",
                ros_conn_color: "red",
                self_id_color: "gray",
                total_remote_color: "gray",
                available_remote_color: "gray",
                lps_time_color:"gray",
                uavs: {}, // { 0:dstatus},
                selected_uav: "All",
                select_id: -1,
                marker_path:""
            },
            methods: {
                select_all: function() {
                    obj.on_select_uav(-1);
                },

                command: function(_cmd) {
                    obj.send_command(_cmd);
                }
            }
        })
        let dstatus = {
            x:0,
            y:0,
            z:0,
            ctrl_mode:0,
            auth_mode:0,
            bat_vol:0
        }

        this.select_id = -1;
        this.warn_count = 0;
        this.last_speak_time = tnow() - 10;


        this.threeview = new ThreeView();
        
    }

    send_command(_cmd) {
        switch (_cmd) {
            case "takeoff":
                this.cmder.send_takeoff_cmd(this.select_id);
                break;
            case "landing":
                this.cmder.send_landing_cmd(this.select_id);
                break;
            case "emergency":
                this.cmder.send_emergency_cmd(this.select_id);
                break;
            default:
                break;
        }

        this.warn_command(_cmd, this.select_id);
    }


    set_ros_conn(_conn) {
        this.view.ros_conn = _conn;
        if (_conn == "CONNECTED") {
            this.view.ros_conn_color = "green";
        } else {
            this.view.ros_conn_color = "red";
        }
    }

    set_self_id(_id) {
        this.view.self_id_color = "green";
        this.view.self_id = _id; 
    }


    set_available_drone_num( _num) {
        this.view.available_nodes = _num;
        this.view.available_remote_color = "green";
    }

    set_total_drone_num(_num) {
        this.view.total_remote_color = "green";
        this.view.remote_nodes = _num;
    }

    set_lps_time(_lps_time) {
        this.view.lps_time_color = "green"
        this.view.lps_time = _lps_time;
    }

    set_drone_status(_id, status) {
        let ctrl_auths = ["RC", "APP", "ONBOARD"]
        let ctrl_modes = [
            "IDLE",
            "TAKEOFF",
            "LANDING",
            "HOVER",
            "POSVEL",
            "ATT",
            "MISSION"
        ]
        let all_flight_status = [
            "IDLE",
            "ARMED",
            "INAIR",
            "CRASHED"
        ]
        let obj = this;
        Vue.set(this.view.uavs, _id, {
            x:status.x.toFixed(2),
            y:status.y.toFixed(2),
            z:status.z.toFixed(2),
            bat_vol:status.bat_vol.toFixed(2),
            ctrl_auth:ctrl_auths[status.control_auth],
            ctrl_mode:ctrl_modes[status.commander_mode],
            flight_status:all_flight_status[status],
            lps_time:status.lps_time,
            _id:_id,
            ui:obj
        });


        if (status.bat_vol < 14.8) {
            this.warn_battery_level(_id, status.bat_vol);
        }

        if (!status.vo_valid) {
            this.warn_vo_(_id);
        }
        // warn_vo_(_id);

    }

    set_drone_selfpose(_id, x, y, z, yaw = null) {

    }

    on_select_uav (_id) {
        this.select_id = _id;
        if (_id < 0) {
            this.view.selected_uav = "ALL";
            this.view.marker_path = "";

        } else {
            this.view.selected_uav = "Drone ID: " + _id;
            this.view.marker_path = "./imgs/4x4_1000-"+_id + ".svg";
            console.log(this.view.marker_path);
        }

        this.view.select_id = _id;
        // console.log("S" + _id);
        if (tnow() - this.last_speak_time > 1) {
            // var msg = new SpeechSynthesisUtterance("Node " + _id + ". How 'bout some action? ");
            if (_id < 0) {
                var msg = new SpeechSynthesisUtterance("Total swarm selected!");
                window.speechSynthesis.speak(msg);
            } else {
                var msg = new SpeechSynthesisUtterance("Node " + _id + " selected!");
               window.speechSynthesis.speak(msg);
            }
        } 
        this.last_speak_time = tnow();
    }

    warn_battery_level(id, bat) {
        if (tnow() - this.last_speak_time > 1) {
            // var msg = new SpeechSynthesisUtterance("Warning! Node " + id + " battery is only " + bat.toFixed(1));
            var msg = new SpeechSynthesisUtterance("警告！节点" + id + " 电池只有 " + bat.toFixed(1) + "伏");
            msg.lang = 'zh-CN';
    
            window.speechSynthesis.speak(msg);
        }
        this.last_speak_time = tnow();
    }
  
    warn_vo_(id) {
        if (tnow() - this.last_speak_time > 1) {
            // var msg = new SpeechSynthesisUtterance("Warning! Node " + id + " battery is only " + bat.toFixed(1));
            var msg = new SpeechSynthesisUtterance("警告！节点" + id + " 视觉里程计失效");
            msg.lang = 'zh-CN';
    
            window.speechSynthesis.speak(msg);
            // console.log("try to speak");
        }
        this.last_speak_time = tnow();
    }

    warn_command(_cmd, _id) {
        if (tnow() - this.last_speak_time > 1) {
            var s_drone = "整个集群";
            if (_id >= 0 ) {
                s_drone = "飞行器 " + _id;
            }

            var cmd = ""
            switch (_cmd) {
                case "takeoff":
                    cmd = "起飞";
                    break;
                case "landing":
                    cmd = "降落";
                    break;
                case "emergency":
                    cmd = "紧急降落";
                    break;
                default:
                    cmd = _cmd;
            }

            var msg =  new SpeechSynthesisUtterance(s_drone + cmd + "！");

            msg.lang = 'zh-CN';
    
            window.speechSynthesis.speak(msg);
        }
        this.last_speak_time = tnow();
    }


}



Vue.component('uav-component', {
    methods: {
        select_uav: function (ui, _id) {
            // console.log(ui);
            // console.log(_id);
            ui.on_select_uav(_id);
        }
      },
    props: ["_id", "status"],    
    template:  `     
    <div v-on:click="select_uav(status.ui, status._id)" class="card" style="width: 100%; height=5em;">
    <h5>
      Drone: {{status._id}}
    </h5>
    <ul class="list-group list-group-flush">
    <li class="list-group-item"> BATVOL: {{status.bat_vol}} </li>
    <li class="list-group-item"> 
      X:{{status.x}}
      Y:{{status.y}}
      Z:{{status.z}}
    </li>
    <li class="list-group-item"> 
    <small>
      LPS_TIME {{status.lps_time}}
      CTRL_AUTH <span style="color:green">{{status.ctrl_auth}}</span>
      CTRL_MODE <span style="color:green">{{status.ctrl_mode}}</span>
      FLIGHT_STATUS <span style="color:green">{{status.flight_status}}</span>
    </small>
    </li>
    </ul>
  </div>`
})

import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/controls/OrbitControls.js';
import { TransformControls } from '../libs/controls/TransformControls.js';
import { ThreeMFLoader } from '../libs/3MFLoader.js';
import { OBJLoader } from '../libs/OBJLoader.js';
import { OBJLoader2 } from '../libs/OBJLoader2.js';
import { MTLLoader } from '../libs/MTLLoader.js';
import { MtlObjBridge } from "../libs/obj2/bridge/MtlObjBridge.js";

class ThreeView {
    constructor() {
        let obj = this;
        this.scene = new THREE.Scene();
        var camera = this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

        var renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio( window.devicePixelRatio);
        // console.log($())
        // console.log($("ur"))
        // console.log($("#urdf").width(), $("#urdf").height() );
        this.renderer.setSize( $("#urdf").width(), $("#urdf").height());
        document.getElementById("urdf").appendChild( this.renderer.domElement );
        
        this.camera.position.z = 1.0;
        this.camera.position.x = -2;
        this.camera.position.y = 2;
        this.camera.lookAt(0, 0, 0);
        renderer.setClearColor( "white", 1 );

        renderer.gammaOutput = true;
        renderer.gammaFactor = 2.2;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.animate();


        let orbit = this.orbit = new OrbitControls( camera, renderer.domElement );
		orbit.update();
		orbit.addEventListener( 'change', function () {
            obj.animate();
        } );
		let control = new TransformControls( camera, renderer.domElement );
		control.addEventListener( 'change', function() {
            obj.animate();
        } );
		control.addEventListener( 'dragging-changed', function ( event ) {
			orbit.enabled = ! event.value;
        } );
        
        this.init_scene();

        this.uavs = {}

        this.load_aircraft();
    }

    set_camera_FLU(x, y, z) {

    }

    load_aircraft() {
        var loader = new ThreeMFLoader ();
        // var loader = new OBJLoader ();
        let obj = this;
        /*
        loader.load( '../models/swarm-drone-0-0-4-metal.3MF', function ( object ) {
        // loader.load( '../models/swarm-drone-0-0-4-metal-meter.obj', function ( object ) {
            // object.quaternion.setFromEuler( new THREE.Euler( - Math.PI / 2, 0, 0 ) ); 	// z-up conversion
            object.traverse( function ( child ) {
                child.castShadow = true;
            } );
            // object.scale.set(0.001,0.001,0.001);
            obj.scene.add( object );

            
        } );*/

        /*
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
            objLoader2.load( '../models/swarm-drone-0-0-4-metal.obj', callbackOnLoad, null, null, null );
        };
        let mtlLoader = new MTLLoader();
        mtlLoader.load( '../models/swarm-drone-0-0-4-metal.mtl', onLoadMtl );*/
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
        var gridHelper = new THREE.GridHelper( size, divisions );
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
    }

    animate() {
        // console.log("anaimate");
        let obj = this;
        // requestAnimationFrame(function() {
            // console.log("test");
            // obj.animate();
        // });

        // this.cube.rotation.x += 0.01;
        // this.cube.rotation.y += 0.01;

        this.renderer.render( this.scene, this.camera );
        setTimeout(function() {
            obj.animate();
        }, 1000);
    };
}
    
// module.exports = {
//     SwarmCommander:SwarmCommander,
//     SwarmGCSUI:SwarmGCSUI
// }
export {SwarmCommander, SwarmGCSUI}