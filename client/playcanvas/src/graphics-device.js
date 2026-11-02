// Graphics 3 — GPU-device selection for the isolated PlayCanvas visual client.
// Firefox on supported platforms uses WebGL2 directly: attempting WebGPU
// first is unnecessary for the already qualified Greyhaven WebGL2 artwork.
// No Rust/World/Combat/Chat state is read or changed here.
export function preferredGreyhavenDeviceTypes(pc, userAgent) {
  if (typeof userAgent !== 'string') throw new TypeError('Browser user agent required');
  if (typeof pc?.DEVICETYPE_WEBGL2 !== 'string' ||
      typeof pc?.DEVICETYPE_WEBGPU !== 'string') {
    throw new TypeError('PlayCanvas WebGL2 and WebGPU device constants required');
  }
  return /\bFirefox\/\d+\b/.test(userAgent)
    ? Object.freeze([pc.DEVICETYPE_WEBGL2])
    : Object.freeze([pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2]);
}

export async function createGreyhavenGraphicsDevice(pc, canvas, userAgent) {
  const deviceTypes=preferredGreyhavenDeviceTypes(pc,userAgent);
  // The official PlayCanvas Engine still owns context/device creation,
  // fallback and loss recovery. Never fake a WebGL context or WebGPU device.
  const device=await pc.createGraphicsDevice(canvas,{deviceTypes});
  if (!device || !['webgpu','webgl2'].includes(device.deviceType)) {
    throw new Error('PlayCanvas did not return a valid WebGPU or WebGL2 device');
  }
  if (deviceTypes[0]===pc.DEVICETYPE_WEBGL2 && device.deviceType!=='webgl2') {
    throw new Error('Firefox requires a genuine WebGL2 graphics device');
  }
  return device;
}
