
//Formations

//Formation 0
//                2
//   3          1          5
//               4

//Formation 1
//       2                   1
//                  5
//      3                    4


//Formation 2
//       2                   1
//      3                    4
//                  5


//Formation 3
//                   1
//                   5
//       2          3          4

//Formation 4
//                  1
//      2         3             4
//                  5
let scale = 1.5;
let height = 1.3;
let formations = {
    0: {
        1: {
            x: 0, y:0, z: height
        },
        2: {
            x:-scale, y:0, z: height
        },
        3: {
            x: 0, y:scale, z: height
        },
        4: {
            x: scale, y:0, z: height
        },
        5: {
            x: 0, y:-scale, z: height
        }
    },
    1: {
        1: {
            x: scale, y:scale, z: height
        },
        2: {
            x:-scale, y:scale, z: height
        },
        3: {
            x: -scale, y:-scale, z: height
        },
        4: {
            x: scale, y:-scale, z: height
        },
        5: {
            x: 0, y:0, z: height
        }
    },
    2: {
        1: {
            x: scale, y:-scale, z: height
        },
        2: {
            x:0, y:scale, z: height
        },
        3: {
            x: 0, y:0, z: height
        },
        4: {
            x: scale, y:scale, z: height
        },
        5: {
            x: -scale, y:0, z: height
        },
    },    
    3: {
        1: {
            x: scale, y:0, z: height
        },
        2: {
            x:-scale, y:-scale, z: height
        },
        3: {
            x: -scale, y:0, z: height
        },
        4: {
            x: -scale, y:scale, z: height
        },
        5: {
            x: 0, y:0, z: height
        }
    },
    4: {
        1: {
            x: scale, y:0, z: height
        },
        2: {
            x:0, y:-scale, z: height
        },
        3: {
            x: 0, y:0, z: height
        },
        4: {
            x: 0, y:scale, z: height
        },
        5: {
            x: -scale, y:0, z: height
        }
    }
};

function planar_distance(p1, p2){
    var d2 = (p1.x - p2.x)*(p1.x - p2.x) + (p1.y - p2.y);
    return  Math.sqrt(d2);
}

function generate_random_position(xmin, xmax, ymin, ymax, zmin, zmax) {
    var x = Math.random()*(xmax - xmin) + xmin;
    var y = Math.random()*(ymax - ymin) + ymin;
    var z = Math.random()*(zmax - zmin) + zmin;
    return  {x:x, y:y, z:z};
}


function generate_random_formation(xmin, xmax, ymin, ymax, zmin, zmax, safe_distance_planar, ids) {
    var ret = {};
    for (var i = 0; i <ids.length; i ++) {
        var id = ids[i];
        var pos = generate_random_position(xmin, xmax, ymin, ymax, zmin, zmax);
        for (var _id = 0; _id <ret.length; _id ++) {
            while (planar_distance(ret[_id], pos) > safe_distance_planar) {
                pos = generate_random_position(xmin, xmax, ymin, ymax, zmin, zmax);
            }
        }
        ret[id] = pos;
    }
    return ret;
}
export {formations, generate_random_formation}