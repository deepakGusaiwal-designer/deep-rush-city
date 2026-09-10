const fs = require('fs');
global.self = global;
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

// Load GLB file directly using GLTFLoader in Node
const data = fs.readFileSync('public/models/Cartoon_City_Free.glb');
const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const scene = gltf.scene;
  const CITY_SCALE = 1.0;
  scene.scale.set(CITY_SCALE, CITY_SCALE, CITY_SCALE);
  scene.updateMatrixWorld(true);

  console.log('--- BUILDINGS IN GLTF SCENE ---');
  scene.traverse((node) => {
    const name = node.name || '';
    if (name.includes('Building') || name.includes('TwistedTower')) {
      let hasBuildingDescendant = false;
      node.traverse((child) => {
        if (child === node || hasBuildingDescendant) return;
        const cn = child.name;
        if (cn.includes('Building') || cn.includes('TwistedTower')) {
          hasBuildingDescendant = true;
        }
      });
      console.log('Node:', name, 'isMesh:', node.isMesh, 'hasBuildingDescendant:', hasBuildingDescendant);
      if (!hasBuildingDescendant) {
        node.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(node);
        console.log('  -> Box3 min:', box.min, 'max:', box.max);
        const size = new THREE.Vector3();
        box.getSize(size);
        console.log('  -> Size:', size);
      }
    }
  });
}, (err) => console.error(err));
