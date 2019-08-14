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



function tnow() {
  return new Date().getTime() / 1000;
}

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


class PointCloud2 {
    constructor(msg, is_pcl2 = true, debug_output = false ) {
      this.max_pts = 100000;
      this.points = [];
      this.buffer = null;
      this.debug_output = debug_output;
      if (this.debug_output) {
        console.log("loading msg");
      }
      this.colors = []
      this.points = []
      this.grid_size = 0.15;

      this.grid_map = {}

      if (is_pcl2) {
        this.processMessage_pcl2(msg);
      } else {
        this.processMessage_pcl(msg);
      }


    }
    processMessage_pcl (msg) {
      var ts = tnow();

      for(var i = 0; i < msg.points.length; i++){
        var px = msg.points[i].x;
        var py = msg.points[i].y;
        var pz = msg.points[i].z;
  
        var pxn = Math.round(px / this.grid_size);
        var pyn = Math.round(py / this.grid_size);
        var pzn = Math.round(pz / this.grid_size);
        px = pxn * this.grid_size;
        py = pyn * this.grid_size;
        pz = pzn * this.grid_size;
  
        var obj = pxn.toString() + "|" + pyn.toString() + "|" + pzn.toString();
        // console.log(obj);
        if (isNaN(px) || isNaN(py) || isNaN(pz)) {
          continue;
        }
  
        if (this.grid_map[obj] == true) {
          continue;
        } else {
          this.grid_map[obj] = true;
        }
  
        this.points.push(px);
        this.points.push(py);
        this.points.push(pz);
  
        var vx = ( px / 10 ) + 0.5;
        var vy = ( py / 10 ) + 0.5;
        var vz = ( (2 - pz) / 10 ) + 0.5;
        // console.log(vx);
        var color = new THREE.Color();
        color.setHSL(vz, 1, 0.5);
        this.colors.push( color.r, color.g, color.b );
  
      }
      if (this.debug_output) {
        console.log("PCL length" + (this.points.length/3/1000.0).toFixed(1) + "k points; total size " + (msg.points.length/1000.0).toFixed(1) + "k cost time " + ((tnow() - ts)*1000).toFixed(1) + "ms");
      }
    }
    processMessage_pcl2 (msg){

    var ts = tnow();

    var fields = {};
    for (var k in msg.fields) {
      fields[msg.fields[k].name] = msg.fields[k];
    }
    // console.log(fields);
    // if(!this.points.setup(msg.header.frame_id, msg.point_step, msg.fields)) {
        // return;
    // }
    if (this.debug_output) {
      console.log("Loading pointcloud");
    }

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

      var pxn = Math.round(px / this.grid_size);
      var pyn = Math.round(py / this.grid_size);
      var pzn = Math.round(pz / this.grid_size);
      px = pxn * this.grid_size;
      py = pyn * this.grid_size;
      pz = pzn * this.grid_size;

      var obj = pxn.toString() + "|" + pyn.toString() + "|" + pzn.toString();
      // console.log(obj);
      if (isNaN(px) || isNaN(py) || isNaN(pz)) {
        continue;
      }

      if (this.grid_map[obj] == true) {
        continue;
      } else {
        this.grid_map[obj] = true;
      }

      this.points.push(px);
      this.points.push(py);
      this.points.push(pz);

      var vx = ( px / 10 ) + 0.5;
			var vy = ( py / 10 ) + 0.5;
      var vz = ( (3 - pz) / 10 ) + 0.5;
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

    if (this.debug_output) {
      console.log("PCL2 length" + (this.points.length/3/1000.0).toFixed(1) + "k points; total size " + (n/1000.0).toFixed(1) + "k cost time " + ((tnow() - ts)*1000).toFixed(1) + "ms");
    }

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
  boxes_object() {
    var bufferGeometry = new THREE.BoxBufferGeometry(this.grid_size, this.grid_size, this.grid_size );
    var geometry = new THREE.InstancedBufferGeometry();
    geometry.index = bufferGeometry.index;
    geometry.attributes.position = bufferGeometry.attributes.position;
    geometry.attributes.uv = bufferGeometry.attributes.uv;

    var colorAttribute = new THREE.InstancedBufferAttribute( new Float32Array( this.colors ), 3 );
    var offsetAttribute = new THREE.InstancedBufferAttribute( new Float32Array( this.points ), 3 );
    
    
    var material = new THREE.RawShaderMaterial( {
      // wireframe: true,
      vertexShader: document.getElementById( 'vertexShader' ).textContent,
      fragmentShader: document.getElementById( 'fshader' ).textContent
    } );
    material.extensions.derivatives = true;


    var vectors = [
      new THREE.Vector3( 1, 0, 0 ),
      new THREE.Vector3( 0, 1, 0 ),
      new THREE.Vector3( 0, 0, 1 )
    ];

    var centers = new Float32Array( offsetAttribute.count * 3);
    for ( var i = 0, l = offsetAttribute.count; i < l; i ++ ) {
      vectors[ i % 3 ].toArray( centers, i * 3 );
    }

    // console.log(centers);

    // console.log(this.centers)

    geometry.addAttribute( 'center', 
      new THREE.InstancedBufferAttribute( new Float32Array( centers), 3 )
    );

    geometry.addAttribute( 'offset', offsetAttribute );
    geometry.addAttribute( 'ca', colorAttribute );
    // geometry.addAttribute('edgeColor', new Float32Array([0, 0, 0]))
    var mesh = new THREE.Mesh( geometry, material );
    mesh.frustumCulled = false;
    return mesh;
    
  }
}

export {PointCloud2};