const rosnodejs = require('rosnodejs');
const { ipcMain } = require('electron')

rosnodejs.initNode('/my_node')
.then(() => {
  const nh = rosnodejs.nh;
  const sub = nh.subscribe('/sdf_map/occupancy_all_4', 'sensor_msgs/PointCloud2', (msg) => {
    ipcMain.send("pcl", msg);
  });
});


