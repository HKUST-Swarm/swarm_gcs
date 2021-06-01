
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

export {formations}