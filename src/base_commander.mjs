class BaseCommander {
  constructor(ui) {
      this.ui = ui;

      this.ui.cmder = this;        

      this.server_ip = this.ui.server_ip;
      this.nodejs = false;

      console.log("Initializing commander")
      try {
        const rosnodejs = require('rosnodejs');
        rosnodejs.loadAllPackages();
        rosnodejs.initNode('/swarm_gcs');
        this.rosnodejs = rosnodejs;
        this.nh = rosnodejs.nh;
        this.nodejs = true;
        console.log("nodejs interface success!");
        this.connected = true;
        ui.set_ros_conn("Nodejs");
        this.setup_ros_sub_pub_nodejs();
        this.setup_udp_nodejs();
      }
      catch (e){
        console.error("Could not initialize nodejs", e, ", use websocket interface");
        this.setup_ros_conn();
      }

      this.connected = false;
  }

  setup_udp_nodejs() {
    console.log("Not implement yet");
  }

  setup_ros_sub_pub_nodejs() {
    console.log("Not implement yet");
  }

  setup_ros_sub_pub_websocket() {
    console.log("Not implement yet");
  }

  set_server_ip(_ip, reconnect=false) {
      if (reconnect || _ip != this.server_ip) {
          console.log("Try to connect", _ip);
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
      try {
        let ros = this.ros = new ROSLIB.Ros({
            // url: "ws://127.0.0.1:9090"
            url: "ws://"+ _ip + ":9090"
        });
        let self = this;
        ros.on("connection", function () {
            // console.log("Connected to websocket server.");
            self.connected = true;
            _ui.set_ros_conn("WebSock");

            self.setup_ros_sub_pub_websocket();
        });
        
        ros.on('error', function(error) {
            console.log('Error connecting to websocket server: ', error);
            _ui.set_ros_conn("ERROR");
            self.connected = false;
            self.vicon_subs = {};
            ros.close();
            setTimeout(() => {
                // _ui.select_next_server_ip();
            }, (500));
        });
        
        ros.on('close', function() {
            console.log('Connection to websocket server closed.');
            _ui.set_ros_conn("CLOSED");
            self.connected = false;
            ros.close();
            self.vicon_subs = {};
            setTimeout(() => {
                // _ui.select_next_server_ip();
            }, (500));
        });
    }
    catch (error) {
        console.error(error, "Try to reconnect!!!");
        _ui.set_ros_conn("ERROR");
        self.connected = false;
        self.vicon_subs = {};
        ros.close();

        setTimeout(() => {
            // _ui.select_next_server_ip();
        }, (500));

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
  }

  send_emergency_cmd() {
      console.log("Will send emergency command");
  }

}

export {BaseCommander}
