import * as THREE from "../third_party/three.js/build/three.module.js";
import { BaseCommander } from "./base_commander.mjs"
import { PointCloud2 } from './pointcloud2.mjs';

class SimSingleCommander extends BaseCommander {
    constructor(ui) {
        super(ui);

        this.ui.cmder = this;
        
        let self = this;
        this.ui.on_gamepad = function(id, axes, buttons) { self.on_gamepad(id, axes, buttons); };

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
    }

    setup_ros_sub_pub_nodejs() {
        console.log("setup_ros_sub_pub_nodejs for sim naive");
        const nh = this.nh;
        let self = this;

        var sub_opts = {
            queueSize: 100
        };

        this.bspine_viz_listener_2 = nh.subscribe("/planning/swarm_traj", "bspline/Bspline", (msg) => {
            if (msg.drone_id >= 0) {
                self.ui.update_drone_traj_bspline(msg.drone_id, msg)
            }
        }, sub_opts);

        this.vio_sub = nh.subscribe("/visual_slam/odom", "nav_msgs/Odometry", (msg) => {
            self.on_vo_msg(msg);
        }, sub_opts);


        var advertiste_opts = {
            queueSize: 100
        };

        this.pubjoy = nh.advertise('/joy', 'sensor_msgs/Joy', advertiste_opts);
    }

    update_status() {
        this.ui.set_drone_status(0, this.status); 
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


    on_gamepad (id, axes, buttons) {
        var _buttons = [];
        for (var i in buttons) {
            _buttons.push(buttons[i].value);
        }

        this.pubjoy.publish({
            header: {
                frame_id: "/dev/input/js0",
                stamp: this.rosnodejs.Time.now()
            },
            axes: axes,
            buttons: _buttons
        });
    }

    on_globalmap_recv(msg) {
        var t0 = performance.now()
        var pcl = new PointCloud2(msg, {
            is_frontier: false,
            is_pcl2: true
        });
        var t1 = performance.now()
        this.ui.update_pcl(pcl);
    }

    send_simple_move(_id) {
        console.log("Send simple move");
        var msg = {
            header: {
                frame_id: "world",
                stamp: this.rosnodejs.Time.now()
            },
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
        };

        if (this.nodejs) {
            this.move_simple_goal.publish(msg);
        } else {
            var _msg = new ROSLIB.Message(msg);
            this.move_simple_goal.publish(_msg);
        }

        var exp_cmd = 30;

        let scmd = new mavlink.messages.swarm_remote_command(this.lps_time, _id, exp_cmd,
            0,
            0,
            0, 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
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

        if (!direct) {
            flyto_cmd = 10;
        }
        let scmd = new mavlink.messages.swarm_remote_command(this.lps_time, _id, flyto_cmd,
            Math.floor(pos.x * 10000),
            Math.floor(pos.y * 10000),
            Math.floor(pos.z * 10000), 0, 0, 0, 0, 0, 0, 0);
        this.send_msg_to_swarm(scmd);
    }

}
// module.exports = {
//     SwarmCommander:SwarmCommander,
//     SwarmGCSUI:SwarmGCSUI
// }
export { SimSingleCommander }
