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
      this.max_pts = 10000;
      this.points = [];
      this.buffer = null;
      console.log("loading msg");
      this.processMessage(msg);
    }
    processMessage (msg){
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
    var x = 0;
    var y = 0;
    var z = 0;
    var base, color;
    for(var i = 0; i < n; i++){
      base = i * pointRatio * msg.point_step;
      // this.points.positions.array[3*i    ] = dv.getFloat32(base+x, littleEndian);
      // this.points.positions.array[3*i + 1] = dv.getFloat32(base+y, littleEndian);
      // this.points.positions.array[3*i + 2] = dv.getFloat32(base+z, littleEndian);
      this.points.push(dv.getFloat32(base+x, littleEndian));
      this.points.push(dv.getFloat32(base+y, littleEndian));
      this.points.push(dv.getFloat32(base+z, littleEndian));

      // if(this.points.colors){
      //     color = this.points.colormap(this.points.getColor(dv,base,littleEndian));
      //     this.points.colors.array[3*i    ] = color.r;
      //     this.points.colors.array[3*i + 1] = color.g;
      //     this.points.colors.array[3*i + 2] = color.b;
      // }
    }
    console.log("PCL length", this.points.length/3)
  };
}

export {PointCloud2};