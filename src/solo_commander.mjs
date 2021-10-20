import {BaseCommander} from "./base_commander.mjs"
import {PointCloud2} from './pointcloud2.mjs';
import * as THREE from "../third_party/three.js/build/three.module.js";

function tnow() {
    return new Date().getTime() / 1000;
}

class SoloCommander extends BaseCommander {
    constructor(ui) {
        super(ui);

        this.landing_speed = 0.2;
  
        this.server_ip = this.ui.server_ip;
  
        this.last_recv_pcl = tnow();
        this.pcl_duration = 0.3;
        this.status = {
            x:0,
            y:0,
            z:0,
            control_auth:0,
            commander_mode:0,
            input_mode:0,
            flight_status:0,
            vo_valid:0,
            bat_vol:0,
            lps_time:0
        };
        this.ui.set_drone_status(0, this.status); 
        //Should use rostopic to update this
    }

    update_status() {
        this.ui.set_drone_status(0, this.status); 
    }
    
    setup_ros_sub_pub() {
        let self = this;

        // this.sub_pcl2.subscribe(function (msg) {
        //     self.on_pcl2_recv(msg);
        // });
  
  
        // this.sub_pcl = new ROSLIB.Topic({
        //     ros:this.ros,
        //     messageType:"sensor_msgs/PointCloud2",
        //     name:"/sdf_map/occupancy_inflate"
        // });
        
        // this.sub_pcl.subscribe(function (msg) {
            // self.on_localmap_recv(msg);
        // });

        this.bspine_viz_listener = new ROSLIB.Topic({
            ros: this.ros,
            name: "/planning/bspline",
            messageType: "bspline/Bspline",
            queue_length:10
        });
  
        this.bspine_viz_listener.subscribe(function (msg) {
            self.ui.update_drone_traj_bspline("debug", msg)
        });

        this.sub_vo = new ROSLIB.Topic({
            ros:this.ros,
            messageType:"nav_msgs/Odometry",
            name:"/airsim_node/Drone_1/odom_local_ned"
        });

        this.sub_vo2 = new ROSLIB.Topic({
            ros:this.ros,
            messageType:"nav_msgs/Odometry",
            name:"/vins_estimator/odometry"
        });

        this.sub_vo.subscribe(function (msg) {
            self.on_vo_msg(msg);
        });

        this.sub_vo2.subscribe(function (msg) {
            self.on_vo_msg(msg);
        });
        
        this.send_move_goal = new ROSLIB.Topic({
            ros : this.ros,
            name : '/move_base_simple/goal',
            messageType : 'geometry_msgs/PoseStamped'
        });
    }

    on_vo_msg(msg) {
        var x = msg.pose.pose.position.x;
        var y = msg.pose.pose.position.y;
        var z = msg.pose.pose.position.z;
        this.status.x = x;
        this.status.y = y;
        this.status.z = z;
        this.status.vo_valid = true;

        let _q = msg.pose.pose.orientation;
        var quat = new THREE.Quaternion(_q.x, _q.y, _q.z, _q.w);
        var pos = new THREE.Vector3(msg.pose.pose.position.x, msg.pose.pose.position.y, msg.pose.pose.position.z);

        this.ui.update_drone_selfpose(0, pos, quat);
        this.update_status();
    }
  
    on_pcl2_recv(msg) {
        if (tnow() - this.last_recv_pcl > this.pcl_duration) {
            var ts = tnow();
            var pcl = new PointCloud2(msg);
            this.ui.update_pcl(pcl);
            this.last_recv_pcl = tnow();
            console.log("Total time " + ((tnow() - ts)*1000.0).toFixed(1) + "ms");
        }    
    }
  
    on_localmap_recv(msg) {
        // if (tnow() - this.last_recv_pcl > this.pcl_duration) 
        {
            var ts = tnow();
            var pcl = new PointCloud2(msg);
            this.ui.update_pcl(pcl);
            this.last_recv_pcl = tnow();
            // console.log("Total time " + ((tnow() - ts)*1000.0).toFixed(1) + "ms");
        }    
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
  
    send_takeoff_cmd(_id) {
        console.log("Will send takeoff command");
    }
  
    send_landing_cmd(_id) {
        console.log("Will send landing command");
    }
  
    send_flyto_cmd(_id, pos) {
        //When use VO coordinates
        console.log("Fly to ", pos);
        var msg = new ROSLIB.Message({
            pose: {
                position:{
                    x: pos.x,
                    y: pos.y,
                    z: pos.z
                },
                orientation: {
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                    w: 1.0
                } 
            }
        });
        this.send_move_goal.publish(msg);
    }
  
    send_emergency_cmd() {
        console.log("Will send emergency command");
    }
  
  }
  
export {SoloCommander}
  