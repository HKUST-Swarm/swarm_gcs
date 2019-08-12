/**
 * @author David V. Lu!! - davidvlu@gmail.com
 * @author Mathieu Bredif - mathieu.bredif@ign.fr
 */

/**
 * Decodes the base64-encoded array 'inbytes' into the array 'outbytes'
 * until 'inbytes' is exhausted or 'outbytes' is filled.
 * if 'record_size' is specified, records of length 'record_size' bytes
 * are copied every other 'pointRatio' records.
 * returns the number of decoded records
 */

import * as THREE from '../build/three.module.js';


function decode64(inbytes, outbytes, record_size, pointRatio) {
    var x,b=0,l=0,j=0,L=inbytes.length,A=outbytes.length;
    record_size = record_size || A; // default copies everything (no skipping)
    pointRatio = pointRatio || 1; // default copies everything (no skipping)
    var bitskip = (pointRatio-1) * record_size * 8;
    for(x=0;x<L&&j<A;x++){
        b=(b<<6)+decode64.e[inbytes.charAt(x)];
        l+=6;
        if(l>=8){
            l-=8;
            outbytes[j++]=(b>>>l)&0xff;
            if((j % record_size) === 0) { // skip records
                // no    optimization: for(var i=0;i<bitskip;x++){l+=6;if(l>=8) {l-=8;i+=8;}}
                // first optimization: for(;l<bitskip;l+=6){x++;} l=l%8;
                x += Math.ceil((bitskip - l) / 6);
                l = l % 8;

                if(l>0){b=decode64.e[inbytes.charAt(x)];}
            }
        }
    }
    return Math.floor(j/record_size);
}
// initialize decoder with static lookup table 'e'
decode64.S='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
decode64.e={};
for(var i=0;i<64;i++){decode64.e[decode64.S.charAt(i)]=i;}


/**
 * A PointCloud2 client that listens to a given topic and displays the points.
 *
 * @constructor
 * @param options - object with following keys:
 *
 *  * ros - the ROSLIB.Ros connection handle
 *  * topic - the marker topic to listen to (default: '/points')
 *  * tfClient - the TF client handle to use
 *  * compression (optional) - message compression (default: 'cbor')
 *  * rootObject (optional) - the root object to add this marker to use for the points.
 *  * max_pts (optional) - number of points to draw (default: 10000)
 *  * pointRatio (optional) - point subsampling ratio (default: 1, no subsampling)
 *  * messageRatio (optional) - message subsampling ratio (default: 1, no subsampling)
 *  * material (optional) - a material object or an option to construct a PointsMaterial.
 *  * colorsrc (optional) - the field to be used for coloring (default: 'rgb')
 *  * colormap (optional) - function that turns the colorsrc field value to a color
 */
class PointCloud2 {
    constructor(msg) {
      this.max_pts = 100000;
      this.points = [];
      this.buffer = null;
      console.log("loading msg");
      this.colors = []
      this.points = []

      this.processMessage(msg);

    }
    processMessage (msg){

    var fields = {};
    for (var k in msg.fields) {
      fields[msg.fields[k].name] = msg.fields[k];
    }
    // console.log(fields);
    // if(!this.points.setup(msg.header.frame_id, msg.point_step, msg.fields)) {
        // return;
    // }
    console.log("Loading pointcloud");

    var n, pointRatio = this.points.pointRatio;
    var bufSz = this.max_pts * msg.point_step;

    if (msg.data.buffer) {
      this.buffer = msg.data.slice(0, Math.min(msg.data.byteLength, bufSz));
      n = Math.min(msg.height*msg.width / pointRatio, this.points.positions.array.length / 3);
    } else {
      if (!this.buffer || this.buffer.byteLength < bufSz) {
        this.buffer = new Uint8Array(bufSz);
      }
      n = decode64(msg.data, this.buffer, msg.point_step, pointRatio);
      pointRatio = 1;
    }

    var dv = new DataView(this.buffer.buffer);
    var littleEndian = !msg.is_bigendian;
    var x = fields.x.offset;
    var y = fields.y.offset;
    var z = fields.z.offset;
  
    var base;
    for(var i = 0; i < n; i++){
      base = i * pointRatio * msg.point_step;
      // this.points.positions.array[3*i    ] = dv.getFloat32(base+x, littleEndian);
      // this.points.positions.array[3*i + 1] = dv.getFloat32(base+y, littleEndian);
      // this.points.positions.array[3*i + 2] = dv.getFloat32(base+z, littleEndian);

      var px = dv.getFloat32(base+x, littleEndian);
      var py = dv.getFloat32(base+y, littleEndian);
      var pz = dv.getFloat32(base+z, littleEndian);

      this.points.push(px);
      this.points.push(py);
      this.points.push(pz);

      var vx = ( px / 10 ) + 0.5;
			var vy = ( py / 10 ) + 0.5;
      var vz = ( pz / 2.0 ) +1.5;
      // console.log(vx);
      var color = new THREE.Color();
      color.setHSL(vz, 1, 0.5);
			this.colors.push( color.r, color.g, color.b );

      // if(this.points.colors){
      //     color = this.points.colormap(this.points.getColor(dv,base,littleEndian));
      //     this.points.colors.array[3*i    ] = color.r;
      //     this.points.colors.array[3*i + 1] = color.g;
      //     this.points.colors.array[3*i + 2] = color.b;
      // }
    }
    console.log("PCL length" + (this.points.length/3/1000.0).toFixed(1) + "k points");
  };

  points_object() {
    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( this.points, 3 ) );
    geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( this.colors, 3 ) );
    geometry.computeBoundingSphere();
    var material = new THREE.PointsMaterial( { size: 0.1, vertexColors: THREE.VertexColors } );
    var points = new THREE.Points( geometry, material );
    return points;
  }
}

export {PointCloud2};