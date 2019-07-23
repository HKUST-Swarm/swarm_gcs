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

        this.ui.cmder = self;        

        this.setup_ros_conn();
    }

    setup_ros_sub_pub() {
        let ros = this.ros;
        let self = this;
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

    setup_ros_conn () {
        let _ui = this.ui;
        let ros = this.ros = new ROSLIB.Ros({
            // url: "ws://127.0.0.1:9090"
            url: "ws://192.168.1.208:9090"
        });
        let self = this;
        ros.on("connection", function () {
            // console.log("Connected to websocket server.");
            _ui.set_ros_conn("CONNECTED");
            self.setup_ros_sub_pub();
        });
        
        ros.on('error', function(error) {
            // console.log('Error connecting to websocket server: ', error);
            _ui.set_ros_conn("ERROR; Reconnecting");
            setTimeout(() => {
                self.setup_ros_conn();
            }, (1000));
        });
        
        ros.on('close', function() {
            // console.log('Connection to websocket server closed.');
            _ui.set_ros_conn("CLOSED; Reconnecting");

            setTimeout(() => {
                self.setup_ros_conn();
            }, (1000));
        });
    }

    on_incoming_data(incoming_msg) {
        let buf = _base64ToArrayBuffer(incoming_msg.data);
        // console.log(buf);
        let msgs = this.mav.parseBuffer(buf);
        // console.log(r);
        for (var k in msgs) {
          let msg = msgs[k];
          console.log(msg);
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
        this.ui.update_drone_selfpose(_id, status.x, status.y, status.z);

        // this.ui.set_bat_level(_id, status.bat_vol);
        // this.ui.set_drone_lps_time(_id, lps_time);
        // this.ui.set_drone_control_auth(_id, status.ctrl_auth);
        // this.ui.set_drone_control_mode(_id, status.ctrl_mode);
        // this.ui.set_drone_selfpose(status.x, status.y, status.z);
    }

    on_drone_vicon_pose(_id, pose) {

    }

    on_drone_realtime_info_recv(_id, lps_time, info) {
        console.log("RT msg");
        this.ui.update_drone_selfpose(_id, info.x, info.y, info.z, info.yaw/1000.0);
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




// module.exports = {
//     SwarmCommander:SwarmCommander,
//     SwarmGCSUI:SwarmGCSUI
// }
export {SwarmCommander}