import * as THREE from '../build/three.module.js';
import {PointCloud2} from './pointcloud2.mjs';

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
class SwarmCommander {
    constructor(ui) {
        this.mav = new MAVLink(null, 0, 0);
        this.ui = ui;

        this.select_id = -1;
        this._lps_time = 0;

        this.ui.cmder = this;        

        this.landing_speed = 0.2;

        this.server_ip = this.ui.server_ip;
        this.setup_ros_conn();

        this.connected = false;
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
            messageType: "inf_uwb_ros/remote_uwb_info",
            queue_length:1
          });
          
       this.remote_nodes_listener.subscribe(function(msg) {
           self.on_remote_nodes_info(msg);
       });



        this.incoming_data_listener = new ROSLIB.Topic({
            ros: ros,
            name: "/uwb_node/incoming_broadcast_data",
            messageType: "inf_uwb_ros/incoming_broadcast_data",
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
            messageType : 'inf_uwb_ros/data_buffer'
        });

        this.sub_pcl = new ROSLIB.Topic({
            ros:ros,
            messageType:"sensor_msgs/PointCloud2",
            name:"/surfel_fusion/pointcloud"
        });

        this.sub_pcl.subscribe(function (msg) {
            console.log("Loading..");
            console.log(msg.data.length/1000000);
            let pcl = new PointCloud2(msg);
            // console.log(pcl.points);
        });

    }

    set_server_ip(_ip, reconnect=false) {
        if (reconnect && _ip != this.server_ip) {
            console.log("Need reconect");
            console.log(this.ros);

            if(this.connected) {
                this.ros.close();
            }

            this.server_ip = _ip;
            this.setup_ros_conn();
        } else {
            this.server_ip = _ip;
        }
    }

    on_vicon_msg(_id, msg) {
        // msg.qua
        var euler = new THREE.Euler(0, 2.34, 0);

        let _q = msg.pose.orientation;
        var quat = new THREE.Quaternion(_q.x, _q.y, _q.z, _q.w);
        euler.setFromQuaternion(quat);

        this.ui.update_drone_globalpose(_id, msg.pose.position.x, msg.pose.position.y, msg.pose.position.z, euler.z);
    }

    setup_ros_conn () {
        let _ui = this.ui;
        let ros = this.ros = new ROSLIB.Ros({
            // url: "ws://127.0.0.1:9090"
            url: "ws://"+ this.server_ip + ":9090"
        });
        let self = this;
        ros.on("connection", function () {
            // console.log("Connected to websocket server.");
            self.connected = true;
            _ui.set_ros_conn("CONNECTED");

            self.setup_ros_sub_pub();
        });
        
        ros.on('error', function(error) {
            console.log('Error connecting to websocket server: ', error);
            _ui.set_ros_conn("ERROR");
            self.connected = false;
            self.vicon_subs = {};
            ros.close();
            // setTimeout(() => {
            //     self.setup_ros_conn();
            // }, (1000));
        });
        
        ros.on('close', function() {
            console.log('Connection to websocket server closed.');
            _ui.set_ros_conn("CLOSED..");
            self.connected = false;
            _ui.select_next_server_ip();
            ros.close();
            self.vicon_subs = {};

            setTimeout(() => {
                self.setup_ros_conn();
            }, (1000));
        });
    }

    on_incoming_data(incoming_msg) {
        if (!vaild_ids.has(incoming_msg.remote_id)) {
            return;
        }
        
        let ts = tnow();
        //note that message may come from different nodes, should fix here
        let buf = _base64ToArrayBuffer(incoming_msg.data);
        // console.log(buf);
        let msgs = this.mav.parseBuffer(buf);
        // console.log(r);
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
                }
                // console.log(msg);

            }
        }
        let dt = tnow() - ts;
        // console.log("Process time ", dt*1000);
    }

    on_node_local_fused(_id, lps_time, msg) {
        // console.log(msg);    
        this.ui.update_drone_localpose_in_coorinate(msg.target_id, msg.x/1000.0, msg.y/1000.0, 
            msg.z/1000.0, msg.yaw/1000.0, _id, msg.cov_x/1000.0, msg.cov_y/1000.0, msg.cov_z/1000.0, msg.cov_yaw/1000.0);
    }

    on_node_based_coorindate(_id, lps_time, msg) {
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
        // this.ui.update_drone_selfpose(_id, status.x, status.y, status.z);

        // this.ui.set_bat_level(_id, status.bat_vol);
        // this.ui.set_drone_lps_time(_id, lps_time);
        // this.ui.set_drone_control_auth(_id, status.ctrl_auth);
        // this.ui.set_drone_control_mode(_id, status.ctrl_mode);
        // this.ui.set_drone_selfpose(status.x, status.y, status.z);
    }

    on_drone_realtime_info_recv(_id, lps_time, info) {
        // console.log("RT msg");
        // console.log(info.vx/ 100);
        this.ui.update_drone_selfpose(_id, info.x, info.y, info.z, info.yaw/1000.0, info.vx/100.0, info.vy/100.0, info.vz/100.0);
        // this.ui.update_drone_selfpose(_id, info.x, info.y, info.z, info.yaw/1000.0, info.vx/100.0, info.vy/100.0, info.vz/100.0);
    }

    send_takeoff_cmd(_id) {
        console.log("Will send takeoff command");
        let takeoff_cmd = 5;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id,  takeoff_cmd, 10000, 15000, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_landing_cmd(_id) {
        console.log("Will send landing command");
        let landing_cmd = 6;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, landing_cmd, 0, this.landing_speed *10000, 0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

    send_flyto_cmd(_id, pos) {
        //When use VO coordinates
        console.log("Fly to ", pos);
        let flyto_cmd = 0;
        let scmd = new mavlink.messages.swarm_remote_command (this.lps_time, _id, flyto_cmd, 
            Math.floor(pos.x*10000), 
            Math.floor(pos.y*10000), 
            Math.floor(pos.z*10000), 0, 0, 0, 0, 0, 0, 0);
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




// module.exports = {
//     SwarmCommander:SwarmCommander,
//     SwarmGCSUI:SwarmGCSUI
// }
export {SwarmCommander}
