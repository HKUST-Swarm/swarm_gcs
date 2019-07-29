var selectionBox = new SelectionBox( camera, scene );
var helper = new SelectionHelper( selectionBox, renderer, 'selectBox' );
document.addEventListener( 'mousedown', function ( event ) {
    for ( var item of selectionBox.collection ) {
        item.material.emissive = new THREE.Color( 0x000000 );
    }
    selectionBox.startPoint.set(
        ( event.clientX / window.innerWidth ) * 2 - 1,
        - ( event.clientY / window.innerHeight ) * 2 + 1,
        0.5 );
} );
document.addEventListener( 'mousemove', function ( event ) {
    if ( helper.isDown ) {
        for ( var i = 0; i < selectionBox.collection.length; i ++ ) {
            selectionBox.collection[ i ].material.emissive = new THREE.Color( 0x000000 );
        }
        selectionBox.endPoint.set(
            ( event.clientX / window.innerWidth ) * 2 - 1,
            - ( event.clientY / window.innerHeight ) * 2 + 1,
            0.5 );
        var allSelected = selectionBox.select();
        for ( var i = 0; i < allSelected.length; i ++ ) {
            allSelected[ i ].material.emissive = new THREE.Color( 0x0000ff );
        }
    }
} );
document.addEventListener( 'mouseup', function ( event ) {
    selectionBox.endPoint.set(
        ( event.clientX / window.innerWidth ) * 2 - 1,
        - ( event.clientY / window.innerHeight ) * 2 + 1,
        0.5 );
    var allSelected = selectionBox.select();
    for ( var i = 0; i < allSelected.length; i ++ ) {
        allSelected[ i ].material.emissive = new THREE.Color( 0x0000ff );
    }
} );