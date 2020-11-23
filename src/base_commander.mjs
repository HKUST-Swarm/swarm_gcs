class BaseCommander {
  constructor(ui) {
      this.ui = ui;

      this.ui.cmder = this;        

      this.server_ip = this.ui.server_ip;
      this.setup_ros_conn();

      this.connected = false;
  }
  
  setup_ros_sub_pub() {
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

  setup_ros_conn () {
      let _ui = this.ui;
      var _ip = this.server_ip;
      if (_ip == "") {
          _ip = "127.0.0.1";
      }
      let ros = this.ros = new ROSLIB.Ros({
          // url: "ws://127.0.0.1:9090"
          url: "ws://"+ _ip + ":9090"
      });
      let self = this;
      ros.on("connection", function () {
          // console.log("Connected to websocket server.");
          self.connected = true;
          _ui.set_ros_conn("OK");

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
          _ui.set_ros_conn("CLOSED");
          self.connected = false;
          _ui.select_next_server_ip();
          ros.close();
          self.vicon_subs = {};

          setTimeout(() => {
              self.setup_ros_conn();
          }, (1000));
      });
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
  }

  send_emergency_cmd() {
      console.log("Will send emergency command");
  }

}

export {BaseCommander}
