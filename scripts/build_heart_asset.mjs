/**
 * Builds public/models/cardiovision-heart.glb from the Human Reference Atlas (HRA) v1.3
 * "3D Reference Organ for Heart, Female" and "3D Reference Organ for Blood Vasculature, Female".
 *
 * Both source files are CC BY 4.0 and share one Visible-Human-derived coordinate frame (metres).
 * The script keeps the entire heart object plus ONLY the heart-related vascular subtree
 * (`VH_F_blood_vasculature_of_heart`), and drops long distal stumps that are not useful for a
 * heart-centred view. Node names are preserved so LAD / LCX / RCA remain individually selectable.
 *
 * Usage:
 *   node scripts/build_heart_asset.mjs <heart.glb> <blood-vasculature.glb> [output.glb]
 *
 * Sources:
 *   https://cdn.humanatlas.io/digital-objects/ref-organ/heart-female/v1.3/assets/3d-vh-f-heart.glb
 *   https://cdn.humanatlas.io/digital-objects/ref-organ/blood-vasculature-female/v1.3/assets/3d-vh-f-blood-vasculature.glb
 */
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, mergeDocuments, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const [heartPath, vasPath, outArg] = process.argv.slice(2);
if (!heartPath || !vasPath) {
  console.error('Usage: node scripts/build_heart_asset.mjs <heart.glb> <blood-vasculature.glb> [output.glb]');
  process.exit(1);
}
const outPath = resolve(outArg ?? 'public/models/cardiovision-heart.glb');

// Distal portions of vessels that leave the heart region; removing them keeps the framing heart-centred.
const DROP_NODES = new Set([
  'VH_F_descending_aorta_b',
  'VH_F_inferior_vena_cava_b',
  'VH_F_left_common_carotid_artery_b',
  'VH_F_left_subclavian_artery_b',
  'VH_F_brachiocephalic_artery_b',
]);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const doc = await io.read(heartPath);
const vasDoc = await io.read(vasPath);
mergeDocuments(doc, vasDoc);

const scenes = doc.getRoot().listScenes();
if (scenes.length !== 2) throw new Error(`Expected 2 scenes after merge, got ${scenes.length}`);
const [scene, vasScene] = scenes;
const heartRoot = scene.listChildren()[0];
const vasRoot = vasScene.listChildren()[0];

const findByName = (node, name) => {
  if (node.getName() === name) return node;
  for (const child of node.listChildren()) {
    const hit = findByName(child, name);
    if (hit) return hit;
  }
  return null;
};

const vasHeart = findByName(vasRoot, 'VH_F_blood_vasculature_of_heart');
if (!vasHeart) throw new Error('VH_F_blood_vasculature_of_heart subtree not found in vasculature GLB');

// Drop distal stumps.
const toDrop = [];
vasHeart.traverse((n) => {
  if (DROP_NODES.has(n.getName())) toDrop.push(n);
});
for (const n of toDrop) n.dispose();

// Move the heart vasculature next to the heart, then discard the rest of the body vasculature.
vasRoot.removeChild(vasHeart);
heartRoot.addChild(vasHeart);
const disposeTree = (node) => {
  for (const c of node.listChildren()) disposeTree(c);
  node.dispose();
};
vasScene.removeChild(vasRoot);
disposeTree(vasRoot);
vasScene.dispose();

// Re-parent under a single, clearly named root so the scene is self-describing.
heartRoot.setName('CardioVision_HRA_Heart_v1_3_Female');

// Remove vertex colours so the app controls the look through materials.
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const color = prim.getAttribute('COLOR_0');
    if (color) prim.setAttribute('COLOR_0', null);
  }
}

// GLB allows a single buffer; merging two documents leaves one per source.
const buffers = doc.getRoot().listBuffers();
for (const accessor of doc.getRoot().listAccessors()) accessor.setBuffer(buffers[0]);
buffers.slice(1).forEach((b) => b.dispose());

await doc.transform(
  prune(),
  dedup(),
  weld({ tolerance: 0.0000001 }),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizePosition: 14, quantizeNormal: 10 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

doc.getRoot().getAsset().copyright =
  'Geometry: Human Reference Atlas v1.3 3D Reference Organs (Heart, Female; Blood Vasculature, Female), ' +
  'Browne & Schlehlein, CC BY 4.0, https://humanatlas.io/3d-reference-library. Subset/merged by CardioVision AI.';
doc.getRoot().getAsset().generator = 'CardioVision AI scripts/build_heart_asset.mjs';

await io.write(outPath, doc);

let tris = 0;
let meshNodes = 0;
doc.getRoot().listNodes().forEach((n) => {
  if (n.getMesh()) meshNodes += 1;
});
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    tris += idx ? idx.getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3;
  }
}
console.log(`Wrote ${outPath}`);
console.log(`  size: ${(statSync(outPath).size / 1024 / 1024).toFixed(2)} MB`);
console.log(`  mesh nodes: ${meshNodes}, triangles: ${Math.round(tris)}`);
