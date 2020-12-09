browserify libs/mavlink.js -o libs/mavlink_bundle.js
electron-packager . swarm_gcs --overwrite
cp -r launch swarm_gcs-linux-x64/
zip -r swarm_gcs-linux-x64.zip swarm_gcs-linux-x64
