const fs = require('fs');
global.self = global;
const THREE = require('three');
const { GLTFLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');

const data = fs.readFileSync('public/models/Cartoon_City_Free.glb');
const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const CITY_SCALE = 1.0;
const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const cityModel = gltf.scene;
  cityModel.scale.set(CITY_SCALE, CITY_SCALE, CITY_SCALE);
  cityModel.updateMatrixWorld(true);

  const baseColliders = [];

  cityModel.traverse((node) => {
    const name = node.name || '';
    const isBuilding = name.includes('Building') || name.includes('TwistedTower');
    const isPlazaLandmark = name.includes('Fountain') || name.includes('Bus_Stop');

    if (isBuilding || isPlazaLandmark) {
      let hasBuildingDescendant = false;
      node.traverse((child) => {
        if (child === node || hasBuildingDescendant) return;
        const cn = child.name;
        if (cn.includes('Building') || cn.includes('TwistedTower') || cn.includes('Fountain') || cn.includes('Bus_Stop')) {
          hasBuildingDescendant = true;
        }
      });

      if (!hasBuildingDescendant) {
        node.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(node);
        const size = new THREE.Vector3();
        box.getSize(size);
        console.log(`Building found: "${name}", size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}), box: min(${box.min.x.toFixed(1)}, ${box.min.y.toFixed(1)}, ${box.min.z.toFixed(1)}) max(${box.max.x.toFixed(1)}, ${box.max.y.toFixed(1)}, ${box.max.z.toFixed(1)})`);
        if (size.x > 0.4 && size.z > 0.4 && size.x < 70 && size.z < 70) {
          if (name.includes('Eco_Building_Slope')) {
            const tier1 = new THREE.Box3(
              new THREE.Vector3(box.min.x, box.min.y, box.min.z),
              new THREE.Vector3(box.max.x, box.min.y + 14.5, box.max.z)
            );
            const tier2 = new THREE.Box3(
              new THREE.Vector3(box.min.x + 0.5, box.min.y + 14.5, box.min.z + 4.0),
              new THREE.Vector3(box.max.x - 0.5, box.min.y + 28.5, box.max.z)
            );
            const tier3 = new THREE.Box3(
              new THREE.Vector3(box.min.x + 1.0, box.min.y + 28.5, box.min.z + 10.0),
              new THREE.Vector3(box.max.x - 1.0, box.min.y + 42.5, box.max.z)
            );
            const tier4 = new THREE.Box3(
              new THREE.Vector3(box.min.x + 1.5, box.min.y + 42.5, box.min.z + 18.0),
              new THREE.Vector3(box.max.x - 1.5, box.max.y, box.max.z)
            );
            baseColliders.push(tier1, tier2, tier3, tier4);
          } else {
            baseColliders.push(box);
          }
        }
      }
    }
  });

  console.log('Total base building colliders created:', baseColliders.length);
  baseColliders.forEach((b, i) => {
    console.log(`Collider #${i}: min(${b.min.x.toFixed(1)}, ${b.min.y.toFixed(1)}, ${b.min.z.toFixed(1)}) -> max(${b.max.x.toFixed(1)}, ${b.max.y.toFixed(1)}, ${b.max.z.toFixed(1)})`);
  });
});
