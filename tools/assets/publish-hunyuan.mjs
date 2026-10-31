/** Stage reviewed assets for Pages, preserving the existing game prop footprints. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const root=path.resolve(import.meta.dirname,'../..');
const destination=path.join(root,'public/assets/hunyuan-v1');
const loader=new GLTFLoader();
loader.register(()=>({name:'publish_texture_metadata',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
async function bounds(bytes){const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''); return new THREE.Box3().setFromObject(gltf.scene);}
function fit(bytes,scale,translation){
 const length=bytes.readUInt32LE(12);
 const document=JSON.parse(bytes.subarray(20,20+length).toString());
 for(const scene of document.scenes){const index=document.nodes.length; document.nodes.push({name:'game_asset_fit',children:scene.nodes??[],scale,translation});scene.nodes=[index];}
 const json=Buffer.from(JSON.stringify(document));const padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(padded);
 const tail=bytes.subarray(20+length);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+tail.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
 return Buffer.concat([header,padded,tail]);
}
const assets=[];
async function write(kind,id,source,original){
 let bytes=await fs.readFile(path.join(root,source)); let transform=null;
 if(original){const [from,to]=await Promise.all([bounds(bytes),fs.readFile(path.join(root,original)).then(bounds)]);const size=from.getSize(new THREE.Vector3());const target=to.getSize(new THREE.Vector3());
 const uniform=Math.min(target.x/size.x,target.y/size.y,target.z/size.z);
 const scale=id==='door'?[target.x/size.x,target.y/size.y,target.z/size.z]:[uniform,uniform,uniform];
 const a=from.getCenter(new THREE.Vector3());const b=to.getCenter(new THREE.Vector3());
 const translation=[b.x-a.x*scale[0],to.min.y-from.min.y*scale[1],b.z-a.z*scale[2]];
 bytes=fit(bytes,scale,translation);transform={scale,translation};}
 const file=`${kind}/${id}.glb`;await fs.mkdir(path.join(destination,kind),{recursive:true});await fs.writeFile(path.join(destination,file),bytes);
 assets.push({id,kind,file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),transform});
}
for(const entry of await fs.readdir(path.join(root,'out/monsters-v1'),{withFileTypes:true})){if(!entry.isDirectory())continue;const source=`out/monsters-v1/${entry.name}/animated.glb`;try{await fs.access(path.join(root,source));}catch{continue;}await write('creatures',entry.name,source);}
for(const id of ['door','chest','torch','urn','pillar','potion'])await write('props',id,`out/props-v1/${id}/model.glb`,`public/assets/props/${id==='chest'?'crate':id}.glb`);
await fs.copyFile(path.join(root,'out/props-v1/door/TENCENT-HUNYUAN-3D-2.0-LICENSE.txt'),path.join(destination,'LICENSE.txt'));
await fs.writeFile(path.join(destination,'NOTICE.txt'),'Tencent Hunyuan 3D 2.0 is licensed under the Tencent Hunyuan 3D 2.0 Community License Agreement, Copyright © 2025 Tencent. All Rights Reserved. The trademark rights of “Tencent Hunyuan” are owned by Tencent or its affiliate.\n\nrougeXR modifications: texture processing, species rigs and animations, prop assembly and rigid hinges, and game footprint fitting. Tencent is not affiliated with, sponsoring, or endorsing rougeXR. See LICENSE.txt and ../../terms.html.\n');
await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify({collection:'hunyuan-v1',license:'LICENSE.txt',notice:'NOTICE.txt',assets},null,2)+'\n');
console.log(`Staged ${assets.length} meshes (${(assets.reduce((n,a)=>n+a.bytes,0)/1048576).toFixed(1)} MiB)`);
