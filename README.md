# Intro
![SwarmGCS](./docs/swarm_gcs.png)
# Build
Prerequirements
LCM is required now.

```
git clone https://github.com/lcm-proj/lcm
mkdir -p lcm/build
cd lcm/build
cmake -DCMAKE_BUILD_TYPE=Release ..
make -j8
sudo make install
```

For ros, rosbridge_suite and inf_uwb_ros is required. System rosbridge_suite may conflict with latest Python.
```
pip install pymongo
pip install autobahn
pip install twisted
sudo apt install ros-<ROS_DISTRO>-rosauth
```

For rosbridge
```
cd catkin_ws/src
git clone https://github.com/RobotWebTools/rosbridge_suite
git clone https://github.com/HKUST-Swarm/inf_uwb_ros
```

Build to executable

```bash
./build.sh
```

# Usage
Way 0: Most convient way:

```
roslaunch rosbridge_server rosbridge_websocket.launch
```

Then open 

http://swarm-gcs.xuhao1.me in browser and select Server IP: 127.0.0.1


Way 2: Use nginx as webserver

Clone swarm_gcs
```
cd path-to-swarm_gcs/
git clone https://github.com/HKUST-Swarm/swarm_gcs
git submodule init
git submodule update
```


```
sudo apt install nginx
```

Modified mime types for serving mjs file
>sudo gedit /etc/nginx/mime.types 

Add     
>application/javascript mjs;

after line 8.

Modified default server
>sudo gedit /etc/nginx/sites-enabled/default

to 
```

server {
	listen 80 default_server;
	listen [::]:80 default_server;

	root path-to-swarm_gcs/swarm_gcs;

	server_name _;

	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ =404;
	}

}

```

And reload nginx:
```
sudo nginx -s reload
```
Then open http://127.0.0.1 or open http://your-ip/ on mobile device (iPad 12 inch) or other computer. And for ros serving:

```
roslaunch launch/swarm_simulation.launch
```

Note: After updating code, you may need to clear your Chrome cache.

Way 3: Download executable from Release and unzip it

```bash
cd swarm_gcs-linux-x64
roslaunch launch/swarm_simulation.launch
```

```
cd swarm_gcs-linux-x64
./swarm_gcs
```

Way 4:

Clone swarm_gcs
```
cd path-to-swarm_gcs/
git clone https://github.com/HKUST-Swarm/swarm_gcs
git submodule init
git submodule update
```

Install nodejs and http-server.
```
sudo npm install http-server -g
```

```
cd swarm_gcs
http-server -c-1
```
Then open http://127.0.0.1:8080 in Chrome

