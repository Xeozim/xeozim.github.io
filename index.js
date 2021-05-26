import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import {OrbitControls} from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js'
import {OBJLoader} from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/OBJLoader.js';
import {Lut} from 'https://unpkg.com/three@0.127.0/examples/jsm/math/Lut.js';
import { geoInterpolate } from 'https://d3js.org/d3-geo.v2.min.js';
const canvas = document.querySelector('canvas.webgl')

// Globe Geometry
const GLOBE_RADIUS = 1;
const CURVE_MIN_ALTITUDE = 0.1;
const CURVE_MAX_ALTITUDE = 1;
const DEGREE_TO_RADIAN = Math.PI / 180;

// Utilities
function clamp(num, min, max) {
  return num <= min ? min : (num >= max ? max : num);
}
// Convert lat/lng to 3D point on globe
function coordinateToPosition(lat, lng, radius) {
    // theta = latitude, phi = longitude
    var theta = lat*DEGREE_TO_RADIAN;
    // Longitudes inverted because the world is inside out
    // var phi = -lng*DEGREE_TO_RADIAN;
    var phi = lng*DEGREE_TO_RADIAN;
    
    var x = Math.cos(theta)*Math.sin(phi);
    var y = Math.sin(theta);
    var z = Math.cos(theta)*Math.cos(phi);

    return new THREE.Vector3(x,y,z).multiplyScalar(radius);
}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// instantiate a loader for OBJ files
const loader = new OBJLoader();
function loadobj(path, material){
    // load the borders
    loader.load(
        // resource URL
        path,
        // called when resource is loaded
        function ( object ) {
            object.traverse(node => {
                node.material = material;
            })
            scene.add( object );
        },
        // called when loading is in progresses
        function ( xhr ) {
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        // called when loading has errors
        function ( error ) {
            console.log( 'An error happened' );
        }
    );
}

// Objects
{
    // Lights
    {
        const color = 0xFFFFFF;
        const intensity = 1;
        const light = new THREE.AmbientLight(color, intensity);
        light.position.set(0, 0, 0);
        scene.add(light);
    }

    // Basic Earth Sphere
    const geometry = new THREE.SphereGeometry( 0.999, 32, 32 );
    const material = new THREE.MeshBasicMaterial( {color: 0x0088ff} );
    const sphere = new THREE.Mesh( geometry, material );
    scene.add( sphere );

    // Add the data grid
    loadobj('models/world_grid_nofaces.obj',new THREE.MeshBasicMaterial({
        opacity: 0.25,
        transparent: true
    }));
    // And the country borders grid
    loadobj('models/borders_3d_nofaces.obj',new THREE.MeshBasicMaterial({
        color:0x000000f
    }));

    // Add the lines for the g_slim data
    // Look-up table (colormap) https://threejs.org/docs/#examples/en/math/Lut
    var lut = new Lut('blackbody',256);

    var centre = new THREE.Vector3(0,0,0);
    var request = new XMLHttpRequest();
    request.open('GET', 'data/g_slim.json', false);
    request.send(null)
    var g_slim_data = JSON.parse(request.responseText);
    for(var i = 0; i < g_slim_data.length; i++) {
        var loc_data = g_slim_data[i];
        // Longitudes inverted because the globe is drawn inside out
        const startLat = loc_data.loc_a_latitude;
        const startLng = loc_data.loc_a_longitude;
        const endLat = loc_data.loc_b_latitude;
        const endLng = loc_data.loc_b_longitude;
        const start = coordinateToPosition(startLat, startLng, GLOBE_RADIUS);
        const end = coordinateToPosition(endLat, endLng, GLOBE_RADIUS);
        // altitude
        const altitude = clamp(start.distanceTo(end) * .75, CURVE_MIN_ALTITUDE, CURVE_MAX_ALTITUDE);
        
        const interpolate = geoInterpolate([startLng, startLat], [endLng, endLat]);
        const midCoord1 = interpolate(0.25);
        const midCoord2 = interpolate(0.75);
        const mid1 = coordinateToPosition(midCoord1[1], midCoord1[0], GLOBE_RADIUS + altitude);
        const mid2 = coordinateToPosition(midCoord2[1], midCoord2[0], GLOBE_RADIUS + altitude);
        
        var color = lut.getColor(loc_data.edge_weight);

        // curve creation https://threejs.org/docs/#api/en/extras/curves/CubicBezierCurve3
        const curve = new THREE.CubicBezierCurve3(start, mid1, mid2, end)
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints( points );
        
        const material = new THREE.LineBasicMaterial( { color : color } );
        
        // Create the final object to add to the scene
        const curveObject = new THREE.Line( geometry, material );
        scene.add(curveObject);
    }
}


/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 0
camera.position.y = 0
camera.position.z = 1

scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)


/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.appendChild( renderer.domElement );

/**
 * Animate
 */

const clock = new THREE.Clock()

const tick = () =>
{

    const elapsedTime = clock.getElapsedTime()

    // Update orbital controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()