import * as THREE from 'three';

const q = a => new THREE.Quaternion().fromArray(a);
const reflect = value => new THREE.Quaternion(value.x, -value.y, -value.z, value.w);

export function sampleHumanoid(rig, source, nodes, rest, lhs, rhs, mix) {
  const value = (attribute, fallback=0) => {
    const c=source[attribute];return c ? c[lhs]+(c[rhs]-c[lhs])*mix : fallback;
  };
  for(const bone of rig.bones) {
    const xyz=bone.muscles.map((index,axis)=>{
      const v=index<0?0:value(42+index);
      return v*(v<0?-bone.min[axis]:bone.max[axis])*bone.sign[axis];
    });
    const axis=new THREE.Vector3(0,xyz[1],xyz[2]), length=axis.length();
    const swing=new THREE.Quaternion();
    if(length>1e-8)swing.setFromAxisAngle(axis.divideScalar(length),length);
    const twist=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),xyz[0]);
    nodes[bone.node].quaternion.copy(reflect(q(bone.pre).multiply(swing).multiply(twist).multiply(q(bone.post).invert())));
  }
  const rootQ=q([value(10),value(11),value(12),value(13,1)]).normalize();
  const correction=rootQ.multiply(q(rig.rootRotation).invert());
  nodes[rig.hips].quaternion.copy(reflect(correction).multiply(q(rest[rig.hips].rotation)));
  const p=rest[rig.hips].position;
  nodes[rig.hips].position.set(p[0]-(value(7)*rig.scale-rig.rootPosition[0]),
    p[1]+value(8,1)*rig.scale-rig.rootPosition[1],p[2]+value(9)*rig.scale-rig.rootPosition[2]);
}

// Apply the gaze in model coordinates; imported bones have nonstandard axes.
export function modelSpaceGaze(bone, pitch, yaw) {
  bone.parent.updateWorldMatrix(true,false);
  const parentQ=bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const delta=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
  bone.quaternion.premultiply(parentQ.clone().invert().multiply(delta).multiply(parentQ));
}
