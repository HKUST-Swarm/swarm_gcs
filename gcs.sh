#!/usr/bin/env bash
WLAN=wlx08107bc45a07
sudo ifconfig $WLAN multicast
sudo route add -net 224.0.0.0 netmask 240.0.0.0 dev $WLAN
source /opt/ros/noetic/setup.bash
source /home/xuhao/swarm_ws/devel/setup.bash
source $HOME/.zshrc
gnome-terminal -- zsh -c "roslaunch inf_uwb_ros uwb_node_gcs.launch" 
/home/xuhao/swarm_gcs/swarm_gcs-linux-x64/swarm_gcs
echo "Start GCS Finished"
