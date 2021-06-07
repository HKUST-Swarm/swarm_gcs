import {ThreeView} from "./ThreeView.mjs"
import * as THREE from "../third_party/three.js/build/three.module.js";

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


let uav_label_colors = {
    unselected: "#0000ff",
    selected: "#ff0000",
    detection_labeled: "#ffff00",
    detection_unlabeled: "#ff3333"
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
        this.server_ip_index = -1;
        this.server_ip_list = ["192.168.1.185", "127.0.0.1", location.hostname,  "10.10.1.10"];
        this.display_pcl = true;
        

        this.global_local_mode = false;
        this.primary_id = 0;
        var loop_mode = this.loop_mode = true;

        this.flyto_mode = false;
        
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
                uav_label_colors: {},
                select_id: -1,
                marker_path:"",
                display_mode:_dis_mode,
                loop_mode: loop_mode? "ON": "OFF",
                primary_id:this.primary_id,
                server_ip: this.server_ip,
                server_ip_list: this.server_ip_list,
                is_wrap_swarm: false,
                formation_class : ["btn btn-secondary", "btn btn-secondary", "btn btn-secondary", "btn btn-secondary", "btn btn-secondary"],
                flyto_class: "btn btn-secondary btn-lg"
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

                formation_hold: function(mode) {
                    obj.formation_hold(mode)
                },

                send_simple_move: function(mode) {
                    obj.send_simple_move()
                },

                stop_formation: function() {
                    obj.stop_formation();
                },

                set_loop_mode_on: function() {
                    obj.loop_mode = true;
                    obj.view.loop_mode = "ON";
                },

                trigger_flyto: function() {
                    console.log(obj.view.flyto_class);
                    obj.flyto_mode = !obj.flyto_mode;
                    if (obj.flyto_mode) {
                        obj.view.flyto_class = "btn btn-success btn-lg";
                    } else {
                        obj.view.flyto_class =  "btn btn-secondary btn-lg";
                    }
                    console.log("FLY to mode", obj.flyto_mode);
                },
                set_loop_mode_off: function() {
                    obj.loop_mode = false;
                    obj.view.loop_mode = "OFF";
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

    send_simple_move() {
        this.cmder.send_simple_move();
    }

    formation_hold(mode) {
        var _master_id = this.select_id;
        if (_master_id < 0) {
            _master_id = this.primary_id;
        }

        this.cmder.send_formation_hold_cmd(_master_id, mode);
    }
    
    update_uav_label_pos(_id, pos) {
        // console.log(_id, pos);
        this.view.uav_screen_pos[_id] = pos;
        if (!(_id in this.view.uav_label_colors)) {
            this.view.uav_label_colors[_id] = uav_label_colors.unselected;
        }
    }
    
    update_detection_label_pos(_id, tgt_id, pos) {
        // console.log(_id, pos);
        var label = _id.toString() + "->" + tgt_id.toString();
        this.view.uav_screen_pos[label] = pos;
        if (!(label in this.view.uav_label_colors)) {
            this.view.uav_label_colors[label] = uav_label_colors.detection_unlabeled;
        }
    }

    remove_detection_label(_id, tgt_id) {
        var label = _id.toString() + "->" + tgt_id.toString();
        console.log("Remove Detection Label", label);
        delete this.view.uav_label_colors[label];
        delete this.view.uav_screen_pos[label];
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
        this.cmder.stop_mission_id(-1);
    }

    set_server_ip(_ip) {
        this.server_ip = _ip;
        this.view.server_ip = _ip;
        this.cmder.set_server_ip(_ip, true)
    }

    select_next_server_ip() {
        console.log(this.server_ip_list.length);
        this.server_ip_index = (this.server_ip_index + 1) % this.server_ip_list.length;
        let _ip = this.server_ip_list[this.server_ip_index];
        console.log("Select next ip " + _ip);
        this.server_ip = _ip;
        this.view.server_ip = _ip;
        this.cmder.set_server_ip(_ip)
        // this.set_server_ip(this.server_ip_list[this.server_ip_index])
    }

    update_drone_traj(ns, traj) {
        this.threeview.update_drone_traj(ns, traj);
    }

    update_drone_traj_bspline(ns, traj) {
        for (var i = 0; i < traj.pos_pts.length; i++) {
            var pos = traj.pos_pts[i];
            var ret = this.transfer_vo_with_based(new THREE.Vector3(pos.x, pos.y, pos.z), new THREE.Quaternion(), traj.drone_id, this.primary_id);
            if (ret != null) {
                traj.pos_pts[i].x = ret.pos.x;
                traj.pos_pts[i].y = ret.pos.y;
                traj.pos_pts[i].z = ret.pos.z;
            }
        }
        this.threeview.update_drone_traj_bspline(ns, traj);
    }
    
    clear_drone_trajs() {
        this.threeview.clear_drone_trajs();
    }

    send_flyto_cmd(_id, direct) {
        let pos = { 
            x: 0,
            y: 0,
            z: 0
        }

        if (_id < 0) {
            return;
        }

        let t_pos = this.threeview.get_waypoint_target_pos(_id);

        if (this.global_local_mode) {
            if (_id in this.uav_local_poses && _id in this.uav_global_poses) {
                //Here assue start vo has same yaw with vicon
                let dx = t_pos.x - this.uav_global_poses[_id].pos.x;
                let dy = t_pos.y - this.uav_global_poses[_id].pos.y;
                let dz = t_pos.z - this.uav_global_poses[_id].pos.z;

                pos.x = dx + this.uav_local_poses[_id].x;
                pos.y = dy + this.uav_local_poses[_id].y;
                pos.z = dz + this.uav_local_poses[_id].z;

                this.cmder.send_flyto_cmd(_id, pos, direct);
            }
        } else {
            if( _id == this.primary_id) {
                //Can control primary drone in local mode now
                pos.x = t_pos.x;
                pos.y = t_pos.y;
                pos.z = t_pos.z;
                console.log("Sending...");
                this.cmder.send_flyto_cmd(_id, pos, direct);
            } else if (_id == -1) {
                pos.x = t_pos.x;
                pos.y = t_pos.y;
                pos.z = t_pos.z;
                console.log("Send all formation command", pos);
                this.cmder.formation_flyto(pos, direct);
            } else {
                var ret = this.transfer_vo_with_based(this.uav_local_poses[_id].pos, this.uav_local_poses[_id].quat, _id, this.primary_id);
                var _pos = ret.pos;
                // console.log("T", t_pos, "P TRANS", _pos);
                let dx = t_pos.x - _pos.x;
                let dy = t_pos.y - _pos.y;
                let dz = t_pos.z - _pos.z;
                
                pos.x = dx + this.uav_local_poses[_id].pos.x;
                pos.y = dy + this.uav_local_poses[_id].pos.y;
                pos.z = dz + this.uav_local_poses[_id].pos.z;
                // console.log("Send fly to", pos);
                this.cmder.send_flyto_cmd(_id, pos, direct);
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
            case "circle":
                this.cmder.start_circle_fly(this.select_id, null, 1.5, 20, "follow");
                break;
            case "flyto":
                this.send_flyto_cmd(this.select_id, 1);
                break;
            case "flyto_traj":
                this.send_flyto_cmd(this.select_id, 0);
                break;
            case "traj0":
                this.cmder.send_traj_cmd(this.select_id, 0);
                break;
            case "traj1":
                this.cmder.send_traj_cmd(this.select_id, 1);
                break;
            case "expo":
                this.cmder.send_simple_move(this.select_id);
                break;
            default:
                break;
        }

        this.warn_command(_cmd, this.select_id);
    }


    set_ros_conn(_conn) {
        this.view.ros_conn = _conn;
        if (_conn == "Nodejs" || _conn == "WebSock" ) {
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

    update_frontier(pcl) {
        if (this.display_pcl) {
            this.threeview.update_frontier(pcl);
        }
    }

    update_inc_pcl(pcl) {
        if (this.display_pcl) {
            this.threeview.update_inc_pcl(pcl);
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
            vo_latency:(status.vo_latency*1000).toFixed(0),
            lps_time_dt: this.view.lps_time - status.lps_time,
            bat_remain: status.bat_remain,
            bat_good: status.bat_remain > 300,
            _id:_id,
            ui:obj
        });

        if (!(this.view.primary_id in this.view.uavs)) {
            this.set_primary_id(_id)
        }

        // if (status.bat_vol < 14.7) {
            // this.warn_battery_level(_id, status.bat_vol);
        // }

        if (status.bat_remain < 300) {
            this.warn_battery_remain(_id, status.bat_remain);
        }

        if (!status.vo_valid) {
            this.warn_vo_(_id);
        }
        // warn_vo_(_id);

    }
    
    on_marker_add_lines(ns, lines, color) {
        this.threeview.on_marker_add_lines(ns, lines, new THREE.Color(color.r, color.g, color.b));
    }

    on_marker_delete_lines(ns) {
        this.threeview.on_marker_delete_lines(ns)
    }

    update_three_id_pose(_id, pos, quat, vx=null, vy=null, vz=null, covx=0, covy=0, covz=0, covyaw=0, update_yaw_cov = false) {
        if (!this.threeview.has_uav(_id)) {
            console.log("Inserting UAV", _id);
            this.threeview.insert_uav(_id);
        }
        if (this.threeview.has_uav(_id)) { 
            // console.log("Updating uav..", pos);       
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
        // console.log("Update Drone selfpose ", _id, pos, quat);
       this.uav_local_poses[_id] = {
           pos:pos, quat:quat
       };

       //For enable loop closure, we shouldn't check id is primary id
       
       if (!this.global_local_mode && (_id != this.primary_id || this.loop_mode )) {
        // Transfer coorindate with based coorinate
            var ret = this.transfer_vo_with_based(pos, quat, _id, this.primary_id);
            if (ret !== null) {
                this.update_three_id_pose(_id, ret.pos, ret.quat, ret.vx, ret.vy, ret.vz,
                    ret.covx, ret.covy, ret.covz, ret.covyaw);
            } else {
                // console.error("No return");
            }
            this.threeview.set_uav_fused_mode(_id);
       }

    }

    update_drone_detection(_id, target_id, rel_pos, inv_dep) {

        this.threeview.update_detection(_id, target_id, rel_pos, inv_dep);
    }

    transfer_vo_with_based(pos, quat, self_id, base_id) {
        if (! (base_id in this.other_vo_origin) || !(self_id in this.other_vo_origin[base_id])) {
            if (self_id == base_id) {
                return {
                    pos:pos,
                    quat:quat,
                    vx:null,
                    vy:null,
                    vz:null,
                    covx:0,
                    covx:0,
                    covx:0,
                    covyaw:0
                }
            } else {
                return null;
            }
        }

        // p.position = a.attitude * b.position + a.position;
        // p.attitude = a.attitude * b.attitude;
        // p.update_yaw();

        var other_vo_origin = this.other_vo_origin[base_id][self_id];//Is a

        var euler_a = new THREE.Euler(0, 0, other_vo_origin.yaw, 'XYZ' );
        var b_position = pos.clone();
        // console.log("B", b_position);
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

    on_select_uavs (_ids) {
        console.log(_ids, this.view.uavs, _ids.size, Object.keys(this.view.uavs).length);

        if (_ids.length == 1) {
            this.on_select_uav(_ids[0]);
        } else if (_ids.size == Object.keys(this.view.uavs).length) {
            this.on_select_uav(-1);
        } else {
            console.log("Set selected --", _ids);
            for (var _id in this.view.uav_label_colors) {
                this.view.uav_label_colors[_id] = uav_label_colors.unselected;
            }

            for (var _id of _ids) {
                this.view.uav_label_colors[_id] = uav_label_colors.selected;
            }
            
            this.threeview.on_select_uavs(_ids);
        }
    }

    on_select_uav (_id) {
        console.log("S", _id);
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
            for (var i in this.view.uav_label_colors) {
                console.log("Set", i, " label unselect");
                this.view.uav_label_colors[i] = uav_label_colors.unselected;
            }

            this.view.uav_label_colors[_id] = uav_label_colors.selected;
            this.threeview.on_select_uavs([_id]);
        } else {
            for (var i in this.view.uav_label_colors) {
                this.view.uav_label_colors[i] = uav_label_colors.selected;
            }
            this.threeview.on_select_uavs([-1]);
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

    warn_battery_remain(id, bat) {
        if (tnow() - this.last_speak_time > 1) {
            // var msg = new SpeechSynthesisUtterance("Warning! Node " + id + " battery is only " + bat.toFixed(1));
            var msg = new SpeechSynthesisUtterance("警告！节点" + id + " 续航只有 " + bat.toFixed(0) + "秒");
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
                case "flyto":
                    cmd = "飞向";
                    break;
                case "flyto_traj":
                    cmd = "飞向";
                    break;
                case "circle":
                    cmd = "绕圈";
                    break;
                case "expo":
                    cmd = "探索";
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

    <h5>
    <img src="material-design-icons/maps/drawable-xxxhdpi/ic_flight_white_48dp.png" class="small_icon" />{{status._id}}
    <span style="font-size:0.6em;text-align: right;" v-if="status.vo_valid">
    <span style="color:white;" class="number"> {{status.x}},{{status.y}},{{status.z}}/{{status.vo_latency}}ms </span>
    </span>
    <span style="font-size:0.6em;text-align: right;" v-else> 
        <span style="color:red;" class="number"> {{status.x}},{{status.y}},{{status.z}}/{{status.vo_latency}}ms  </span>
    </span>

    </h5>
    <ul class="list-group list-group-flush">
    <li class="list-group-item"> 
    <div class="uav_details">
        LPS_TIME <span  class="number"> {{status.lps_time}} </span>
        LPS_DT <span  class="number"> {{status.lps_time_dt}} </span>
    </div>
    </li>
    <li class="list-group-item"> 
    <div class="uav_details">
    ENDURACE: <span style="color:blue" v-if="status.bat_good">{{ Math.floor(status.bat_remain/60)}}min {{ (status.bat_remain%60).toFixed(0)}}s </span>
    <span style="color:red" v-else>{{ Math.floor(status.bat_remain/60)}}min {{ (status.bat_remain%60).toFixed(0)}}s </span>
    BATVOL:  <span style="color:blue" v-if="status.bat_good">{{status.bat_vol}} </span>
    <span style="color:red" v-else>{{status.bat_vol}} </span>
    </div>
    </li>
    <li class="list-group-item"> 
    <div class="uav_details">
      CTL_AUTH <span style="color:white">{{status.ctrl_auth}}</span>
      INPUT_MODE <span style="color:white">{{status.ctrl_input_mode}}</span>
      CTL_MODE <span style="color:white">{{status.ctrl_mode}}</span>
      FLT_SAT <span style="color:white">{{status.flight_status}}</span>
    </div>
    </li>
    </ul>
  </div>`
})


export {SwarmGCSUI}
