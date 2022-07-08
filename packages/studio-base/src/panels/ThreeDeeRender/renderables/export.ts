// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";

export enum SceneFormat {
  GlTF,
  Glb,
}

export async function exportScene(format: SceneFormat, scene: THREE.Scene): Promise<Blob> {
  // Rotate our Z-up world to Y-up for export
  const output = new THREE.Scene();
  output.add(scene);
  scene.rotateX(-Math.PI / 2);

  let blob: Blob;
  switch (format) {
    case SceneFormat.GlTF: {
      const exporter = new GLTFExporter();
      const gltf = await exporter.parseAsync(output, { binary: false });
      const json = JSON.stringify(gltf)!;
      blob = new Blob([json]);
      break;
    }
    case SceneFormat.Glb: {
      const exporter = new GLTFExporter();
      const glb = await exporter.parseAsync(output, { binary: true });
      blob = new Blob([glb as ArrayBuffer]);
      break;
    }
  }

  // Rotate the scene back
  scene.rotateX(Math.PI / 2);
  output.remove(scene);

  return blob;
}
