const fs = require('fs');
const THREE = require('three');

// Let's compute the world bounding box directly from the GLTF accessors
const fd = fs.openSync('public/models/Cartoon_City_Free.glb', 'r');
const h = Buffer.alloc(20);
fs.readSync(fd, h, 0, 20, 0);
const len = h.readUInt32LE(12);
const buf = Buffer.alloc(len);
fs.readSync(fd, buf, 0, len, 20);
fs.closeSync(fd);
const json = JSON.parse(buf.toString('utf8'));

console.log('--- ALL NODES IN GLTF ---');
json.nodes.forEach((n, idx) => {
  if (/building|twisted|tower|fountain|bus/i.test(n.name)) {
    console.log(`Node ${idx}: "${n.name}"`);
    console.log('  translation:', n.translation);
    console.log('  rotation:', n.rotation);
    console.log('  scale:', n.scale);
    if (n.mesh !== undefined) {
      const m = json.meshes[n.mesh];
      const acc = json.accessors[m.primitives[0].attributes.POSITION];
      console.log('  local min:', acc.min, 'max:', acc.max);
    }
  }
});
