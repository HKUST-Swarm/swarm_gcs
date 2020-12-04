import * as THREE from '../build/three.module.js';
import {BaseCommander} from "./base_commander.mjs"


//Formations

//Formation 0
//                2
//   3          1          5
//               4

//Formation 1
//       2                   1
//                  5
//      3                    4


//Formation 2
//       2                   1
//      3                    4
//                  5


//Formation 3
//                   1
//                   5
//       2          3          4

//Formation 4
//                  1
//      2         3             4
//                  5

let formations = {
    0: {
        1: {
            x: 0, y:0, z: 1
        },
        2: {
            x:1, y:0, z: 1
        },
        3: {
            x: 0, y:-1, z: 1
        },
        4: {
            x: -1, y:0, z: 1
        },
        5: {
            x: 0, y:1, z: 1
        }
    },
    1: {
        1: {
            x: 1, y:1, z: 1
        },
        2: {
            x:1, y:-1, z: 1
        },
        3: {
            x: -1, y:-1, z: 1
        },
        4: {
            x: -1, y:1, z: 1
        },
        5: {
            x: 0, y:0, z: 1
        }
    },
    2: {
        1: {
            x: 1, y:-1, z: 1
        },
        2: {
            x:1, y:1, z: 1
        },
        3: {
            x: 0, y:0, z: 1
        },
        4: {
            x: 0, y:1, z: 1
        },
        5: {
            x: -1, y:0, z: 1
        },
    },    
    3: {
        1: {
            x: 1, y:0, z: 1
        },
        2: {
            x:-1, y:-1, z: 1
        },
        3: {
            x: -1, y:0, z: 1
        },
        4: {
            x: -1, y:1, z: 1
        },
        5: {
            x: 0, y:0, z: 1
        }
    },
    4: {
        1: {
            x: 1, y:0, z: 1
        },
        2: {
            x:0, y:-1, z: 1
        },
        3: {
            x: 0, y:0, z: 1
        },
        4: {
            x: 0, y:1, z: 1
        },
        5: {
            x: -1, y:0, z: 1
        }
    }
};
function _base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

function tnow() {
    return new Date().getTime() / 1000;
}
  
let vaild_ids = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
class SwarmCommander extends BaseCommander{
    constructor(ui) {
        super(ui);
        this.mav = new MAVLink(null, 0, 0);

        this.select_id = -1;
        this._lps_time = 0;

        this.ui.cmder = this;        

        this.landing_speed = 0.2;

        this.last_recv_pcl = tnow();
        this.pcl_duration = 0.3;

        this.current_formation = 0;
        
        this.missions = {}


        this.uav_pos = {}

        this.mission_update();
    }
    
    sub_vicon_id(i) {
        console.log("subscribing vicon "+ i);
        var vicon_sub = new ROSLIB.Topic({
            ros: this.ros,
            name: "/swarm_mocap/SwarmNodePose" + i,
            messageType: "geometry_msgs/PoseStamped"
        });
        
        let _id = i;
        let self = this;
        this.vicon_subs[_id] = (vicon_sub);
        vicon_sub.subscribe(function (incoming_msg) {
            self.on_vicon_msg(_id, incoming_msg);
        });
    }

    setup_ros_sub_pub() {
        let ros = this.ros;
        let self = this;
        this.remote_nodes_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/uwb_node/remote_nodes",
            messageType: "swarmcomm_msgs/remote_uwb_info",
            queue_length:1
          });
          
        this.remote_nodes_listener.subscribe(function(msg) {
            self.on_remote_nodes_info(msg);
        });

        this.traj_viz_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/traj_viz",
            messageType: "visualization_msgs/Marker",
            queue_length:10
        });
        
        this.traj_viz_listener.subscribe(function (msg) {
            // console.log(msg);
            self.ui.update_drone_traj(msg.ns, msg.points)
        });

        this.bspine_viz_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/planning/swarm_traj_recv",
            messageType: "bspline/Bspline",
            queue_length:10
        });

        this.bspine_viz_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/planning/swarm_traj",
            messageType: "bspline/Bspline",
            queue_length:10
        });

        this.bspine_viz_listener.subscribe(function (msg) {
            // console.log("bspline drone_id", msg.drone_id);
            if (msg.drone_id >= 0) {
                self.ui.update_drone_traj_bspline(msg.drone_id, msg)
            }
        });
        
        this.incoming_data_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/uwb_node/incoming_broadcast_data",
            messageType: "swarmcomm_msgs/incoming_broadcast_data",
            queue_length:1
        });

        this.incoming_data_listener.subscribe(function (incoming_msg) {
            self.on_incoming_data(incoming_msg);
        });

        this.vicon_subs = {
            // 2: this.sub_vicon_id(2),
            // 0: this.sub_vicon_id(0)
        }
       
        this.send_uwb_msg = new ROSLIB.Topic({
            ros : ros,
            name : '/uwb_node/send_broadcast_data',
            messageType : 'swarmcomm_msgs/data_buffer'
        });


        this.move_simple_goal = new ROSLIB.Topic({
            ros : ros,
            name : '/move_base_simple/goal',
            messageType : 'geometry_msgs/PoseStamped'
        }); 

        this.change_formation_client = new ROSLIB.Service({
            ros : ros,
            name : '/transformation',
            serviceType : 'swarm_transformation/transformation'
        });

        this.translation_flyto_client = new ROSLIB.Service({
            ros : ros,
            name : '/translation',
            serviceType : 'swarm_transformation/translation'
        });

    }

 
    on_vicon_msg(_id, msg) {
        // msg.qua
        var euler = new THREE.Euler(0, 2.34, 0);

        let _q = msg.pose.orientation;
        var quat = new THREE.Quaternion(_q.x, _q.y, _q.z, _q.w);
        var pos = new THREE.Vector3(msg.pose.position.x, msg.pose.position.y, msg.pose.position.z);

        this.ui.update_drone_globalpose(_id, pos, quat);
    }

    on_incoming_data(incoming_msg) {
        // console.log(incoming_msg);
        if (!vaild_ids.has(incoming_msg.remote_id)) {
            return;
        }
        
        let ts = tnow();
        //note that message may come from different nodes, should fix here
        let buf = _base64ToArrayBuffer(incoming_msg.data);
        // console.log(buf);
        let msgs = this.mav.parseBuffer(buf);
        // console.log(msgs);
        for (var k in msgs) {
          let msg = msgs[k];
            switch (msg.name) {
                case "NODE_REALTIME_INFO": {
                    this.on_drone_realtime_info_recv(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }

                case "DRONE_STATUS": {
                    // console.log(msg);
                    this.on_drone_status_recv(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }
                case "NODE_LOCAL_FUSED" : {
                    // console.log(msg);
                    this.on_node_local_fused(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }

                case "NODE_BASED_FUSED": {
                    // console.log(msg);
                    this.on_node_based_coorindate(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }

                case "NODE_DETECTED": {
                    this.on_node_detected(incoming_msg.remote_id, incoming_msg.lps_time, msg);
                    break;
                }
            }
        }
        let dt = tnow() - ts;
        // console.log("Process time ", dt*1000);
    }


    on_node_detected(_id, lps_time, msg) {
        var pos = new THREE.Vector3(msg.x, msg.y, msg.z);
        var inv_dep = msg.inv_dep / 10000.0;

        this.ui.update_drone_detection(_id, msg.target_id, pos, inv_dep);
    }

    on_node_local_fused(_id, lps_time, msg) {
        // console.log(msg);    
        var pos = new THREE.Vector3(msg.x/1000.0, msg.y/1000.0, msg.z/1000.0);
        var quat = new THREE.Quaternion();
        quat.setFromEuler(new THREE.Euler(0, 0, msg.yaw/1000.0));

        this.ui.update_drone_localpose_in_coorinate(msg.target_id, pos, quat, _id, msg.cov_x/1000.0, msg.cov_y/1000.0, msg.cov_z/1000.0, msg.cov_yaw/1000.0);
    }

    on_node_based_coorindate(_id, lps_time, msg) {
        // console.log(msg);
        // console.log("Based ", _id,"->" ,msg.target_id);
        this.ui.update_drone_based_coorinate(msg.target_id, msg.rel_x/1000.0, msg.rel_y/1000.0, 
            msg.rel_z/1000.0, msg.rel_yaw_offset/1000.0, _id, msg.cov_x/1000.0, msg.cov_y/1000.0, msg.cov_z/1000.0, msg.cov_yaw/1000.0);
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
        if (! (_id in this.vicon_subs) && this.ui.global_local_mode ) {
            this.sub_vicon_id(_id);
        }

        this.ui.set_drone_status(_id, status)

        var pos = new THREE.Vector3(status.x, status.y, status.z);
        var quat = new THREE.Quaternion();
        quat.setFromEuler(new THREE.Euler(0, 0, status.yaw));
        // this.ui.update_drone_selfpose(_id, pos, quat, 0, 0, 0);
        this.uav_pos[_id] = pos;

        // console.log("Update --", _id, pos, quat);

        // this.ui.set_bat_level(_id, status.bat_vol);
        // this.ui.set_drone_lps_time(_id, lps_time);
        // this.ui.set_drone_control_auth(_id, status.ctrl_auth);
        // this.ui.set_drone_control_mode(_id, status.ctrl_mode);


        // this.ui.set_drone_selfpose(status.x, status.y, status.z, 0, 0, 0);
    }

    on_drone_realtime_info_recv(_id, lps_time, info) {
        // console.log(info);
        var pos = new THREE.Vector3(info.x, info.y, info.z);
        var quat = new THREE.Quaternion();
        quat.setFromEuler(new THREE.Euler(info.roll/1000.0, info.pitch/1000.0, info.yaw/1000.0));
        this.ui.update_drone_selfpose(_id, pos, quat, info.vx/100.0, info.vy/100.0, info.vz/100.0);
        this.uav_pos[_id] = pos;
        // this.ui.update_drone_selfpose(_id, info.x, info.y, info.z, info.yaw/1000.0, info.vx/100.0, info.vy/100.0, info.vz/100.0);
    }

    send_takeoff_cmd(_id) {
        this.stop_transformation_thread();
        console.log("Will send takeoff command");
        let takeoff_cmd = 5;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id,  takeoff_cmd, 10000, 15000, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_landing_cmd(_id) {
        this.stop_transformation_thread();
        console.log("Will send landing command");
        let landing_cmd = 6;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, landing_cmd, 0, this.landing_speed *10000, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_flyto_debug(){
        console.log("Send flyto debug");
        var msg = new ROSLIB.Message({
            pose: {
                position: {
                    x: 0,
                    y: 0,
                    z: 0,
                },
                orientation: {
                    w: 1,
                    x: 0, 
                    y: 0, 
                    z: 0
                }
            }
        });

        this.move_simple_goal.publish(msg);
    }

    send_flyto_cmd(_id, pos, direct) {
        //When use VO coordinates
        console.log("Fly to ", pos);

        // var msg = new ROSLIB.Message({
        //     pose: {
        //         position: {
        //             x: pos.x,
        //             y: pos.y,
        //             z: pos.z,
        //         },
        //         orientation: {
        //             w: 1,
        //             x: 0, 
        //             y: 0, 
        //             z: 0
        //         }
        //     }
        // });

        // this.move_simple_goal.publish(msg);

        var flyto_cmd = 0;

        if (! direct) {
            flyto_cmd = 10;
        }
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, flyto_cmd, 
            Math.floor(pos.x*10000), 
            Math.floor(pos.y*10000), 
            Math.floor(pos.z*10000), 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_emergency_cmd() {
        this.stop_transformation_thread();
        console.log("Will send emergency command");
        let landing_cmd = 6;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, -1, landing_cmd, -1, 10000, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_traj_cmd(_id, cmd) {
        console.log("send traj", cmd);
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, 100+cmd, 
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_msg_to_swarm(_msg) {
        let _data = _msg.pack(this.mav);
        var msg = new ROSLIB.Message({data : _data, send_method: 2});
        this.send_uwb_msg.publish(msg);
    }

    send_formation_hold_cmd(master_id, mode) {
        if (mode == 0) {
            let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, -1, 12, 
                master_id, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            console.log("Hold the formation");
            this.send_msg_to_swarm(scmd);
        } else if (mode == 1) {
            let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, -1, 13, 
                master_id, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            console.log("Lock the formation");
            this.send_msg_to_swarm(scmd);
        }
    }

    start_circle_fly(_id, origin, r=1, T=10, yaw_mode="fixed") {
        if (_id < 0) {
            return;
        }
        if (origin == null) {
            origin = {
                x:this.uav_pos[_id].x,
                y:this.uav_pos[_id].y + r,
                z:this.uav_pos[_id].z
            }
        }

        this.missions[_id] = {
            "mission": "circle",
            "origin": origin,
            "T": T,
            "ts": tnow(),
            "r": r,
            "yaw_mode": yaw_mode
        }
    }

    stop_mission_id(_id) {
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, -1, 11, 
            -1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        console.log("Hold the formation");
        this.send_msg_to_swarm(scmd);
        if (_id == -1) {
            this.missions = {};
        }
        delete this.missions[_id];
    }

    circle_mission(_id, mission, _tnow) {
        // console.log("circle mission");
        let flyto_cmd = 0;
        var t = _tnow - mission.ts;
        var r = mission.r;
        var yaw_mode = mission.yaw_mode;
        var ox = mission.origin.x;
        var oy = mission.origin.y;
        var oz = mission.origin.z;
        var T = mission.T;

        var pi = Math.PI;
        var x = ox + Math.sin(t*pi*2/T)*r;
        var y = oy - Math.cos(t*pi*2/T)*r;
        var vx = Math.cos(t*pi*2/T) * r * pi*2/T;
        var vy = Math.sin(t*pi*2/T) * r * pi*2/T;
        var ax = - Math.sin(t*pi*2/T) * r * pi*2/T * pi*2/T;
        var ay = Math.cos(t*pi*2/T) * r * pi*2/T * pi*2/T;
        // console.log(x, y, oz);

        var param1 = Math.floor(x*10000)
        var param2 = Math.floor(y*10000)
        var param3 = Math.floor(oz*10000)
        var param5 = Math.floor(vx*10000)
        var param6 = Math.floor(vy*10000)
        var param7 = 0
        var param4 = 666666;
        if (yaw_mode == "follow") {
            param4 = Math.floor(-t*pi*2*10000/T);
        }
        var param8 = Math.floor(ax*10000)
        var param9 = Math.floor(ay*10000)

        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, flyto_cmd, 
            param1, param2, param3, param4, 
            param5, param6, param7, param8, param9, 0);
        this.send_msg_to_swarm(scmd);
    }

    mission_update() {
        // console.log("ms");
        var _tnow = tnow();
        for (var _id in this.missions) {
            var mission = this.missions[_id];
            
            if (mission.mission == "circle") {
                this.circle_mission(_id, mission, _tnow);
            }
        }

        let self = this;
        setTimeout(function() {
            self.mission_update();
        }, 30);
    }

    formation_flyto(pos) {
        if (this.current_formation < 0) {
            return;
        }
        
        var request = new ROSLIB.ServiceRequest({
            next_formation: this.current_formation,
            des_x: pos.x,
            des_y: pos.y,
            des_z: pos.z
        });

        console.log("Target pos", pos.x, pos.y, pos.z);
        let obj = this;
        this.translation_flyto_client.callService(request, function(result) {
            console.log(result);
            obj.current_formation = result.current_formation;
        });
    }

    request_transformation_change(next_trans) {
        console.log("Try to request formation, ", next_trans);
        for (var j = 0; j < 1; j ++) {
            for (var i = 1; i < 6; i ++) {
                var _pos = formations[next_trans][i];
                var pos = new THREE.Vector3(_pos.x, _pos.y, _pos.z);
                var quat = new THREE.Quaternion(0, 0, 0, 1);
                var ret = this.ui.transfer_vo_with_based(pos, quat, this.ui.primary_id, i);
                if (ret != null) {
                    console.log(i, pos, ret.pos);
                    this.send_flyto_cmd(i, ret.pos, false);
                } 
            }
        }
        // if (this.current_formation < 0) {
        //     next_trans = next_trans + 100;
        // }

        // var request = new ROSLIB.ServiceRequest({
        //     next_formation: next_trans
        // });
        
        // let obj = this;
        // this.change_formation_client.callService(request, function(result) {
        //     console.log(result);
        //     obj.ui.set_active_formation(result.current_formation, 0);

        //     setTimeout(function() {
        //         obj.ui.set_active_formation(result.current_formation, 1);
        //         obj.current_formation = result.current_formation;

        //         obj.ui.clear_drone_trajs();
        //     }, result.period*1000);
        // });
    }

    stop_transformation_thread() {
        console.log("Try to stop formation thread");
        var request = new ROSLIB.ServiceRequest({
            next_formation: -1
        });
        let obj = this;        
        this.change_formation_client.callService(request, function(result) {
            console.log(result);
            obj.current_formation = result.current_formation;
        });
    }
}




// module.exports = {
//     SwarmCommander:SwarmCommander,
//     SwarmGCSUI:SwarmGCSUI
// }
export {SwarmCommander}
