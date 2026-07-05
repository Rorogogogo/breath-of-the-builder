import * as THREE from 'three';
import { WORLD_RADIUS, WATER_LEVEL } from './terrain';

/**
 * Stylised toon ocean: transparent plane with gentle vertex waves injected
 * into the material shader. `update(t)` drives the wave time.
 */
export function createWater(): { mesh: THREE.Mesh; update: (t: number) => void } {
  const geo = new THREE.PlaneGeometry(WORLD_RADIUS * 8, WORLD_RADIUS * 8, 96, 96);
  geo.rotateX(-Math.PI / 2);

  const uTime = { value: 0 };
  const mat = new THREE.MeshPhongMaterial({
    color: '#3fa7d1',
    emissive: '#0d3a52',
    specular: '#bfe9ff',
    shininess: 90,
    transparent: true,
    opacity: 0.82,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.y += sin(position.x * 0.12 + uTime * 1.4) * 0.22
                       + cos(position.z * 0.09 + uTime * 1.1) * 0.18;`
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_LEVEL;
  return { mesh, update: (t) => (uTime.value = t) };
}
