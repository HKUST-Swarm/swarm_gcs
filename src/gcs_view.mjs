import {ThreeView} from "./ThreeView.mjs"
import * as THREE from '../build/three.module.js';

function tnow() {
    return new Date().getTime() / 1000;
}

let good_topbar_color = "#cff3fa";

function toFixedString(n, dec=2) {
    var sign = "+";
    if (n < 0) {
        sign = "";
    }
    return sign + n.toFixed(dec);
}

class SwarmGCSUI {
    constructor(opt_ui, opt_3d) {
        let obj = this;
       
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


        this.count = 0;

        this.server_ip = location.hostname;
        this.server_ip_index = 0;
        this.server_ip_list = [location.hostname, "127.0.0.1", "192.168.1.208", "192.168.1.195"];
        this.display_pcl = true;
        

        this.global_local_mode = false;
        this.primary_id = 0;
        
        var _dis_mode = "GLOBAL";
        if (!this.global_local_mode) {
            _dis_mode = "LOCAL";
        }
        this.view = new Vue({
            el: '#container',
            data: {
                self_id: 0,
                remote_nodes: 0,
                available_nodes: 0,
                lps_time: 0,
                ros_conn: "FAIL",
                ros_conn_color: "red",
                self_id_color: "gray",
                total_remote_color: "gray",
                available_remote_color: "gray",
                lps_time_color:"gray",
                uavs: {}, // { 0:dstatus},
                selected_uav: "All",
                uav_screen_pos: {},
                select_id: -1,
                marker_path:"",
                display_mode:_dis_mode,
                primary_id:this.primary_id,
                server_ip: this.server_ip,
                server_ip_list: this.server_ip_list,
                is_wrap_swarm: false,
                formation_class : ["btn btn-secondary", "btn btn-secondary", "btn btn-secondary", "btn btn-secondary", "btn btn-secondary"]
            },
            methods: {
                select_all: function() {
                    obj.on_select_uav(-1);
                },
                command: function(_cmd) {
                    obj.send_command(_cmd);
                },
                range_select:function() {

                },
                set_display_mode_local : function () {
                    obj.set_display_mode("LOCAL");
                },
                set_display_mode_global : function () {
                    obj.set_display_mode("GLOBAL");
                },
                set_primary_id: function (_id) {
                    obj.set_primary_id(_id);
                },
                set_server_ip: function (_ip) {
                    obj.set_server_ip(_ip);
                },
                wrap_swarm : function () {
                    obj.view.is_wrap_swarm = true;
                },
                unwrap_swarm : function () {
                    obj.view.is_wrap_swarm = false;
                },
                toggle_fullscreen: function () {
                    document.body.requestFullscreen();
                },
                formation: function(_next) {
                    obj.formation(_next);
                },
                stop_formation: function() {
                    obj.stop_formation();
                }
            }
        });

        this.threeview = new ThreeView(opt_3d);
        this.threeview.ui = this;

        this.uav_local_poses = {};
        this.uav_global_poses = {};
        this.uav_local_poses_in_drone_coor = {};
        this.other_vo_origin = {};
    }

    update_uav_label_pos(_id, pos) {
        // console.log(_id, pos);
        this.view.uav_screen_pos[_id] = pos;
    }

    set_active_formation(_index, status) {
        this.view.formation_class= ["btn btn-secondary", "btn btn-secondary", "btn btn-secondary", "btn btn-secondary", "btn btn-secondary"];
        if (status == 0) {
            this.view.formation_class[_index] = "btn btn-warning";
        }
        if (status == 1) {
            this.view.formation_class[_index] = "btn btn-success";
        }
    }

    formation(_next) {
        this.cmder.request_transformation_change(_next);
    }
    stop_formation() {
        this.cmder.stop_transformation_thread();
    }

    set_server_ip(_ip) {
        this.server_ip = _ip;
        this.view.server_ip = _ip;
        this.cmder.set_server_ip(_ip, true)
    }

    select_next_server_ip() {
        console.log(this.server_ip_list.length);
        this.server_ip_index = (this.server_ip_index + 1) % this.server_ip_list.length;
        console.log("Select next ip" + this.server_ip_index);
        let _ip = this.server_ip_list[this.server_ip_index];
        this.server_ip = _ip;
        this.view.server_ip = _ip;
        this.cmder.set_server_ip(_ip)
        // this.set_server_ip(this.server_ip_list[this.server_ip_index])
    }

    update_drone_traj(ns, traj) {
        this.threeview.update_drone_traj(ns, traj);
    }

    clear_drone_trajs() {
        this.threeview.clear_drone_trajs();
    }

    send_flyto_cmd(_id) {
        let pos = { 
            x: 0,
            y: 0,
            z: 0
        }

        let t_pos = this.threeview.get_waypoint_target_pos(_id);

        if (this.global_local_mode) {
            if (_id in this.uav_local_poses && _id in this.uav_global_poses) {
                //Here assue start vo has same yaw with vicon
                let dx = t_pos.x - this.uav_global_poses[_id].x;
                let dy = t_pos.y - this.uav_global_poses[_id].y;
                let dz = t_pos.z - this.uav_global_poses[_id].z;

                let dyaw = this.uav_global_poses[_id].yaw - this.uav_local_poses[_id].yaw;

                //TODO: rotate with yaw

                pos.x = dx + this.uav_local_poses[_id].x;
                pos.y = dy + this.uav_local_poses[_id].y;
                pos.z = dz + this.uav_local_poses[_id].z;

                this.cmder.send_flyto_cmd(_id, pos);
            }
        } else {
            if( _id == this.primary_id) {
                //Can control primary drone in local mode now
                pos.x = t_pos.x;
                pos.y = t_pos.y;
                pos.z = t_pos.z;
                this.cmder.send_flyto_cmd(_id, pos);
            } else {
                let _local_pos_in_base_now = this.uav_local_poses_in_drone_coor[this.primary_id][_id];
                let dx = t_pos.x - _local_pos_in_base_now.x;
                let dy = t_pos.y - _local_pos_in_base_now.y;
                let dz = t_pos.z - _local_pos_in_base_now.z;
                
                // console.log("LOCAL IN BASE");
                // console.log(_local_pos_in_base_now);
                // console.log("T POS");
                // console.log(t_pos);
                // console.log("DPOS" + dx + " " + dy + " " + dz + " ");

                 //TODO: rotate with yaw

                 pos.x = dx + this.uav_local_poses[_id].x;
                 pos.y = dy + this.uav_local_poses[_id].y;
                 pos.z = dz + this.uav_local_poses[_id].z;
 
                 this.cmder.send_flyto_cmd(_id, pos);
            }
        }

    }

    send_command(_cmd) {
        if (_cmd == "takeoff") {
            if (!confirm('Takeoff; Right? ID'+this.select_id)) {
                return;
            }
        }

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
            case "flyto":
                this.send_flyto_cmd(this.select_id);
                break;
            default:
                break;
        }

        this.warn_command(_cmd, this.select_id);
    }


    set_ros_conn(_conn) {
        this.view.ros_conn = _conn;
        if (_conn == "OK") {
            this.view.ros_conn_color = good_topbar_color;
        } else {
            this.view.ros_conn_color = "red";
        }
    }

    set_self_id(_id) {
        this.view.self_id_color = good_topbar_color;
        this.view.self_id = _id; 
    }


    update_pcl(pcl) {
        if (this.display_pcl) {
            this.threeview.update_pcl(pcl);
        }
    }


    set_available_drone_num( _num) {
        this.view.available_nodes = _num;
        this.view.available_remote_color = good_topbar_color;
    }

    set_total_drone_num(_num) {
        this.view.total_remote_color = good_topbar_color;
        this.view.remote_nodes = _num;
    }

    set_lps_time(_lps_time) {
        if (this.count ++ % 10 == 0) {
            this.view.lps_time_color = good_topbar_color;
            this.view.lps_time = _lps_time;
        }
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
            "DISARMED",
            "ARMED",
            "INAIR",
            "CRASHED"
        ]
        let ctrl_input_mode = [
            "NONE",
            "RC",
            "ONBOARD"
        ]

        let obj = this;
        Vue.set(this.view.uavs, _id, {
            x:toFixedString(status.x, 2),
            y:toFixedString(status.y, 2),
            z:toFixedString(status.z, 2),
            bat_vol:status.bat_vol.toFixed(2),
            ctrl_auth:ctrl_auths[status.control_auth],
            ctrl_mode:ctrl_modes[status.commander_mode],
            ctrl_input_mode:ctrl_input_mode[status.input_mode],
            flight_status:all_flight_status[status.flight_status],
            vo_valid:status.vo_valid,
            lps_time:status.lps_time,
            _id:_id,
            ui:obj
        });

        if (!(this.view.primary_id in this.view.uavs)) {
            this.set_primary_id(_id)
        }
        if (status.bat_vol < 14.7) {
            this.warn_battery_level(_id, status.bat_vol);
        }

        if (!status.vo_valid) {
            this.warn_vo_(_id);
        }
        // warn_vo_(_id);

    }

    update_three_id_pose(_id, pos, quat, vx=null, vy=null, vz=null, covx=0, covy=0, covz=0, covyaw=0, update_yaw_cov = false) {
        if (!this.threeview.has_uav(_id)) {
            this.threeview.insert_uav(_id);
        }
        if (this.threeview.has_uav(_id)) {        
            this.threeview.update_uav_pose(_id, pos, quat, vx, vy, vz, covx, covy, covz, covyaw, update_yaw_cov);
        }
    }

    update_drone_globalpose(_id, pos, quat) {
        if (this.global_local_mode) {
            this.update_three_id_pose(_id, pos, quat);
        }
        this.uav_global_poses[_id]= {
            pos:pos, quat:quat
        };
    }

    update_drone_selfpose(_id, pos, quat, vx=null, vy=null, vz=null) {
       if (!this.global_local_mode && _id == this.primary_id) {
            this.update_three_id_pose(_id, pos, quat, vx, vy, vz);
       }

       this.uav_local_poses[_id] = {
           pos:pos, quat:quat
       };


       if (!this.global_local_mode && _id != this.primary_id) {
        // Transfer coorindate with based coorinate
            var ret = this.transfer_vo_with_based(pos, quat, _id, this.primary_id);
            if (ret !== null) {
                this.update_three_id_pose(_id, ret.pos, ret.quat, ret.vx, ret.vy, ret.vz,
                    ret.covx, ret.covy, ret.covz, ret.covyaw);
            }
            this.threeview.set_uav_fused_mode(_id);
       }

    }

    transfer_vo_with_based(pos, quat, self_id, base_id) {
        if (! (base_id in this.other_vo_origin) || !(self_id in this.other_vo_origin[base_id])) {
            return null;
        }

        // p.position = a.attitude * b.position + a.position;
        // p.attitude = a.attitude * b.attitude;
        // p.update_yaw();

        var other_vo_origin = this.other_vo_origin[base_id][self_id];//Is a

        var euler_a = new THREE.Euler(0, 0, other_vo_origin.yaw, 'XYZ' );
        var b_position = pos.clone();
        b_position.applyEuler(euler_a);
        b_position.add(new THREE.Vector3(other_vo_origin.x, other_vo_origin.y, other_vo_origin.z));
        
        var quat_a = new THREE.Quaternion();
        quat_a.setFromEuler(euler_a);
        quat_a.multiply(quat);
        return {
            pos:b_position,
            quat:quat_a,
            vx:null,
            vy:null,
            vz:null,
            covx:other_vo_origin.covx,
            covx:other_vo_origin.covy,
            covx:other_vo_origin.covz,
            covyaw:other_vo_origin.covyaw
        }
    }

    update_drone_based_coorinate(node_id, x, y, z, yaw, base_id, covx=0, covy=0, covz=0, covyaw=0) {
        if (! (base_id in this.other_vo_origin)) {
            this.other_vo_origin[base_id] = {};
        }

        this.other_vo_origin[base_id][node_id] = {
            x:x,
            y:y,
            z:z,
            yaw:yaw,
            covx:covx,
            covy:covy,
            covz:covz,
            covyaw:covyaw
        }
    }


    update_drone_localpose_in_coorinate(node_id, pos, quat, base_id, covx=0, covy=0, covz=0, covyaw=0) {
        if (!this.global_local_mode && base_id == this.primary_id) {
            // console.log(node_id);
            this.update_three_id_pose(node_id, pos, quat, null, null,null, covx, covy, covz, covyaw, true);
            this.threeview.set_uav_fused_mode(node_id);
            if (! (base_id in this.uav_local_poses_in_drone_coor)) {
                this.uav_local_poses_in_drone_coor[base_id]  = {};
            }

            this.uav_local_poses_in_drone_coor[base_id][node_id] = {
                pos:pos,quat:quat
            };
       }
    }

    on_select_uav (_id) {
        this.select_id = _id;
        if (_id < 0) {
            this.view.selected_uav = "ALL";
            this.view.marker_path = "";

        } else {
            this.view.selected_uav =  _id;
            this.view.marker_path = "./imgs/4x4_1000-"+_id + ".svg";
            // console.log(this.view.marker_path);
        }

        this.view.select_id = _id;
        // console.log("S" + _id);
        if (tnow() - this.last_speak_time > 1) {
            // var msg = new SpeechSynthesisUtterance("Node " + _id + ". How 'bout some action? ");
            if (_id < 0) {
                var msg = new SpeechSynthesisUtterance("Total swarm selected!");
                msg.lang = "en-US";
                window.speechSynthesis.speak(msg);

            } else {
                var msg = new SpeechSynthesisUtterance("Node " + _id + " selected!");
                msg.lang = "en-US";
               window.speechSynthesis.speak(msg);
            }
        } 
        this.last_speak_time = tnow();

        if (_id >= 0) {
            this.threeview.on_select_uavs([_id]);
        } else {
            this.threeview.on_select_uavs([]);
        }
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
                case "flyto":
                    cmd = "飞向";
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

    set_display_mode(mode) {
        let new_global_local_mode = mode=="GLOBAL";
        if (new_global_local_mode != this.global_local_mode) {
            this.threeview.clear_uavs();
            this.threeview.clear_uav_fused();
            this.global_local_mode = new_global_local_mode;
        }
        this.view.display_mode = mode;
    }

    set_primary_id(_id) {
        if (_id != this.primary_id) {
            this.primary_id = _id;
            this.view.primary_id = _id;

            this.threeview.clear_uavs();
            this.threeview.clear_uav_fused();
        }
    }


}



Vue.component('uav-component', {
    methods: {
        select_uav: function (ui, _id) {
            ui.on_select_uav(_id);
        }
      },
    props: ["_id", "status"],    
    template:  `     
    <div v-on:click="select_uav(status.ui, status._id)" class="card uav_component" style="width: 100%; height=5em;">
    <img v-bind:src="'./imgs/4x4_1000-'+status._id + '.svg'" style="height:3em; width:3em; right:0em; position:absolute;" />

    <h5>
    <img src="material-design-icons/maps/drawable-xxxhdpi/ic_flight_white_48dp.png" class="small_icon" />{{status._id}}
    </h5>
    <ul class="list-group list-group-flush">
    <li v-if="status.vo_valid" class="list-group-item"> 
    <span style="font-size:0.6em">
    X:<span style="color:white;font-size:1.3em" class="number"> {{status.x}} </span>
    Y:<span style="color:white;font-size:1.3em" class="number"> {{status.y}} </span>
    Z:<span style="color:white;font-size:1.3em" class="number"> {{status.z}} </span>
    </span>
    </li>
    <li v-else class="list-group-item"> 
        <span style="color:red;">INVAILD </span>
        X:<span style="color:red;" class="number"> {{status.x}} </span>
        Y:<span style="color:red;" class="number"> {{status.y}} </span>
        Z:<span style="color:red;" class="number"> {{status.z}} </span>
    </li>
    <li class="list-group-item"> 
    <div class="uav_details">
      LPS_TIME <span  class="number"> {{status.lps_time}} </span>
      CTRL_AUTH <span style="color:white">{{status.ctrl_auth}}</span>
      INPUT_MODE <span style="color:white">{{status.ctrl_input_mode}}</span>
      CTRL_MODE <span style="color:white">{{status.ctrl_mode}}</span>
      FLIGHT_STATUS <span style="color:white">{{status.flight_status}}</span>
      BATVOL: {{status.bat_vol}}
    </div>
    </li>
    </ul>
  </div>`
})


export {SwarmGCSUI}
