import {ThreeView} from "./ThreeView.mjs"

function tnow() {
    return new Date().getTime() / 1000;
}

class SwarmGCSUI {
    constructor() {
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
                ros_conn: "UNCONNECTED",
                ros_conn_color: "red",
                self_id_color: "gray",
                total_remote_color: "gray",
                available_remote_color: "gray",
                lps_time_color:"gray",
                uavs: {}, // { 0:dstatus},
                selected_uav: "All",
                select_id: -1,
                marker_path:"",
                display_mode:_dis_mode,
                primary_id:this.primary_id
            },
            methods: {
                select_all: function() {
                    obj.on_select_uav(-1);
                },
                command: function(_cmd) {
                    obj.send_command(_cmd);
                },
                set_display_mode_local : function () {
                    obj.set_display_mode("LOCAL");
                },
                set_display_mode_global : function () {
                    obj.set_display_mode("GLOBAL");
                },
                set_primary_id: function (_id) {
                    obj.set_primary_id(_id);
                }
            }
        });

        this.threeview = new ThreeView();
        this.threeview.ui = this;

        this.uav_local_poses = {};
        this.uav_global_poses = {};
        this.uav_local_poses_in_drone_coor = {};
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
        if (this.count ++ % 10 == 0) {
            this.view.lps_time_color = "green"
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
        let obj = this;
        Vue.set(this.view.uavs, _id, {
            x:status.x.toFixed(2),
            y:status.y.toFixed(2),
            z:status.z.toFixed(2),
            bat_vol:status.bat_vol.toFixed(2),
            ctrl_auth:ctrl_auths[status.control_auth],
            ctrl_mode:ctrl_modes[status.commander_mode],
            flight_status:all_flight_status[status.flight_status],
            vo_valid:status.vo_valid,
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

    update_three_id_pose(_id, x, y, z, yaw = null, vx=null, vy=null, vz=null, covx=0, covy=0, covz=0, covyaw=0, update_yaw_cov = false) {
        if (!this.threeview.has_uav(_id)) {
            this.threeview.insert_uav(_id);
        }
        if (this.threeview.has_uav(_id)) {        
            this.threeview.update_uav_pose(_id, x, y, z, yaw, vx, vy, vz, covx, covy, covz, covyaw, update_yaw_cov);
        }
    }

    update_drone_globalpose(_id, x, y, z, yaw = null) {
        if (this.global_local_mode) {
            this.update_three_id_pose(_id, x, y, z, yaw);
        }
        this.uav_global_poses[_id]= {
            x:x, y:y, z:z, yaw:yaw
        };
    }

    update_drone_selfpose(_id, x, y, z, yaw = null, vx=null, vy=null, vz=null) {
       if (!this.global_local_mode && _id == this.primary_id) {
            this.update_three_id_pose(_id, x, y, z, yaw, vx, vy, vz);
       }

       this.uav_local_poses[_id] = {
           x:x, y:y, z:z, yaw:yaw
       };
    }


    update_drone_localpose_in_coorinate(node_id, x, y, z, yaw, base_id, covx=0, covy=0, covz=0, covyaw=0) {
        if (!this.global_local_mode && base_id == this.primary_id) {
            // console.log(node_id);
            this.update_three_id_pose(node_id, x, y, z, yaw, null, null,null, covx, covy, covz, covyaw, true);
            this.threeview.set_uav_fused_mode(node_id);
            if (! (base_id in this.uav_local_poses_in_drone_coor)) {
                this.uav_local_poses_in_drone_coor[base_id]  = {};
            }

            this.uav_local_poses_in_drone_coor[base_id][node_id] = {
                x:x,y:y,z:z,yaw:yaw
            };
       }
    }

    on_select_uav (_id) {
        this.select_id = _id;
        if (_id < 0) {
            this.view.selected_uav = "ALL";
            this.view.marker_path = "";

        } else {
            this.view.selected_uav = "Drone ID: " + _id;
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
    <div v-on:click="select_uav(status.ui, status._id)" class="card" style="width: 100%; height=5em;">
    <h5>
    <span class="glyphicon glyphicon-plane" aria-hidden="true"></span> {{status._id}}
    </h5>
    <ul class="list-group list-group-flush">
    <li v-if="status.vo_valid" class="list-group-item"> 
    X:<span style="color:green;"> {{status.x}} </span>
    Y:<span style="color:green;"> {{status.y}} </span>
    Z:<span style="color:green;"> {{status.z}} </span>
    </li>
    <li v-else class="list-group-item"> 
        <span style="color:red;">INVAILD </span>
        X:<span style="color:red;"> {{status.x}} </span>
        Y:<span style="color:red;"> {{status.y}} </span>
        Z:<span style="color:red;"> {{status.z}} </span>
    </li>
    <li class="list-group-item"> 
    <small>
      LPS_TIME {{status.lps_time}}
      CTRL_AUTH <span style="color:green">{{status.ctrl_auth}}</span>
      CTRL_MODE <span style="color:green">{{status.ctrl_mode}}</span>
      FLIGHT_STATUS <span style="color:green">{{status.flight_status}}</span>
      BATVOL: {{status.bat_vol}}
    </small>
    </li>
    </ul>
    <img v-bind:src="'./imgs/4x4_1000-'+status._id + '.svg'" style="height:3em; width:3em; right:0em; position:absolute;" />
  </div>`
})


export {SwarmGCSUI}
