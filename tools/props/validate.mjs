/** Verify generated props, rigid hinge motion, and actual functional openings. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const root=path.resolve(import.meta.dirname,'../..');
const catalog=JSON.parse(await fs.readFile(path.join(root,'art/prop-references/hunyuan-v1/prompts.json'),'utf8'));
const loader=new GLTFLoader();
loader.register(()=>({name:'audit_texture',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
const reports=[];
for(const entry of catalog.assets){
 if(process.argv.length>2&&!process.argv.slice(2).includes(entry.id))continue;
 const file=path.join(root,'out/props-v1',entry.id,'model.glb');const bytes=await fs.readFile(file);
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 assert(json.buffers.every(b=>!b.uri),'External buffer');
 assert(json.images?.length&&json.images.every(i=>i.bufferView!==undefined&&!i.uri),'External/missing texture');
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 assert.deepEqual(gltf.animations.map(c=>c.name).sort(),[...entry.clips].sort(),entry.id+' clips');
 let vertices=0,triangles=0;const meshes=[];
 gltf.scene.traverse(obj=>{if(obj.isMesh){meshes.push(obj);vertices+=obj.geometry.attributes.position.count;triangles+=(obj.geometry.index?.count??obj.geometry.attributes.position.count)/3;}});
 assert(meshes.length>=entry.parts.length,entry.id+' missing components');
 const budget=entry.parts.reduce((n,id)=>n+catalog.parts.find(p=>p.id===id).triangles,0)+1500;
 assert(triangles<=budget,entry.id+' geometry budget');
 gltf.scene.updateMatrixWorld(true);
 function points(obj){
  obj.updateWorldMatrix(true,true);const values=[];obj.traverse(mesh=>{if(!mesh.isMesh)return;
   const point=new THREE.Vector3();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);assert(point.toArray().every(Number.isFinite),'Nonfinite vertex');values.push(...point.toArray());
   }
  });return values;
 }
 const all=points(gltf.scene);assert(all.length>0);
 const minY=Math.min(...all.filter((_,i)=>i%3===1));assert(minY>=-.002,entry.id+' ground contact');
 const details={};
 if(entry.clips.length){
  const fixed=gltf.scene.getObjectByName(entry.id==='door'?'door_frame':'chest_base');
  const moving=gltf.scene.getObjectByName(entry.id==='door'?'door_leaf':'chest_lid');
  const hinge=gltf.scene.getObjectByName(entry.id+'_hinge');assert(fixed&&moving&&hinge,'Missing hinge parts');
  const fixedRest=points(fixed);const origin=hinge.getWorldPosition(new THREE.Vector3());
  const mixer=new THREE.AnimationMixer(gltf.scene);const poses={};
  for(const clip of gltf.animations){
   mixer.stopAllAction();const action=mixer.clipAction(clip).reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(0);
   const first=points(moving);let last=first,motion=0;
   for(let i=1;i<=12;i++){
    mixer.setTime(clip.duration*i/12);last=points(moving);const stable=points(fixed);
    assert(Math.max(...stable.map((v,j)=>Math.abs(v-fixedRest[j])))<.00001,'Stationary component moved');
    assert(hinge.getWorldPosition(new THREE.Vector3()).distanceTo(origin)<.00001,'Hinge pivot drift');
    motion=Math.max(motion,...last.map((v,j)=>Math.abs(v-first[j])));
   }
   assert(motion>.3,'Hinge does not open enough');poses[clip.name]={first,last};details[clip.name]={duration:clip.duration,maxVertexMotion:motion};
  }
  for(const [a,b] of [[poses.open.first,poses.close.last],[poses.open.last,poses.close.first]])assert(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<.0001,'Open and close do not match');
  mixer.stopAllAction();gltf.scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  if(entry.id==='door'){
   for(const x of [-.4,0,.4])for(const y of [.3,.9,1.7]){
    ray.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));assert(ray.intersectObject(fixed,true).length===0,'Doorway passage blocked');
   }
   details.clearOpening='0.8m-wide tested passage, clear through frame';
  }else{
   ray.set(new THREE.Vector3(0,2,0),new THREE.Vector3(0,-1,0));const hits=ray.intersectObject(fixed,true);
   assert(hits.length&&hits[0].point.y<.15,'Chest cavity blocked or bottom missing');details.interiorFloorY=hits[0].point.y;
  }
 }
 reports.push({id:entry.id,vertices,triangles,bytes:bytes.length,textures:json.images.length,clips:entry.clips,details,result:'passed'});
 console.log(`PASS ${entry.id}: ${vertices} vertices / ${triangles} triangles; ${entry.clips.join(', ')||'static'}`);
}
await fs.writeFile(path.join(root,'out/props-v1/validation.json'),JSON.stringify(reports,null,2)+'\n');
console.log(reports.length+' generated props verified');
