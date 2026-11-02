import { createAuthoritativeSnapshotView } from './authoritative-snapshot-view.mjs';

export function createPlayCanvasActorLayer(app, pc) {
  const parent = new pc.Entity('Rust authoritative actors — read-only debug silhouettes');
  app.root.addChild(parent);

  function makeMaterial(hex) {
    const m = new pc.StandardMaterial();
    m.diffuse = new pc.Color(...hex);
    m.gloss = 16;
    m.update();
    return m;
  }
  const otherMaterial = makeMaterial([0.72, 0.78, 0.82]);
  const ownMaterial = makeMaterial([0.90, 0.67, 0.30]);
  const faceMaterial = makeMaterial([0.13, 0.19, 0.21]);

  function renderPrimitive(name, shape, position, scale, material) {
    const e = new pc.Entity(name);
    e.addComponent('render', { type: shape, material, castShadows: true, receiveShadows: true });
    e.setLocalPosition(...position);
    e.setLocalScale(...scale);
    return e;
  }

  function updateActor(handle, pose) {
    handle.setPosition(pose.position.x, pose.position.y, pose.position.z);
    // Facing is visual, not input or combat authority.
    handle.setEulerAngles(0, -pose.facing * 180 / Math.PI, 0);
    handle.findByName('authoritative snapshot body').render.material =
      pose.isOwn ? ownMaterial : otherMaterial;
    handle.snapshot = pose;
  }

  const view = createAuthoritativeSnapshotView({
    create(pose) {
      const root = new pc.Entity('Rust snapshot actor ' + pose.netId);
      const body = renderPrimitive('authoritative snapshot body', 'cylinder', [0, 0.75, 0],
        [0.56, 1.35, 0.56], pose.isOwn ? ownMaterial : otherMaterial);
      const nose = renderPrimitive('facing indicator — no attack authority', 'box',
        [0, 1.12, 0.36], [0.16, 0.15, 0.26], faceMaterial);
      root.addChild(body);
      root.addChild(nose);
      parent.addChild(root);
      updateActor(root, pose);
      return root;
    },
    update: updateActor,
    remove(handle) { handle.destroy(); }
  });

  return Object.freeze({
    reconcile: view.reconcile,
    get count() { return view.count; },
    destroy() {
      view.clear();
      parent.destroy();
      otherMaterial.destroy?.();
      ownMaterial.destroy?.();
      faceMaterial.destroy?.();
    }
  });
}
