import { SwarmCommander } from './src/swarm_commander.mjs';
import { SwarmGCSUI } from "./src/gcs_view.mjs";
var ui = new SwarmGCSUI({}, {
  chessboard:true,
  grid: false
});
// console.log(ui);
var sc = new SwarmCommander(ui);
