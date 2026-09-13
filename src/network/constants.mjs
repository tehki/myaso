export const NETWORK = Object.freeze({
  protocolVersion: 1,
  serverSimulationHz: 60,
  clientPredictionHz: 120,
  inputSendHz: 60,
  snapshotSendHz: 20,
  inputRedundancy: 3,
  targetPlayersPerMap: 512,
  conservativeDatagramBytes: 1100,
  worldWidth: 8192,
  worldHeight: 8192,
  worldCoordinateScale: 4,
  maxWorldCoordinate: 0xffff / 4,
  interest: Object.freeze({
    cellSize: 256,
    combatRadius: 420,
    nearRadius: 700,
    midRadius: 1500,
    farRadius: 2600,
    nearIntervalTicks: 3,
    midIntervalTicks: 6,
    farIntervalTicks: 30,
  }),
  reconciliation: Object.freeze({
    inputHistoryMs: 350,
    maxServerRewindMs: 150,
    remoteInterpolationMs: 90,
    maxRemoteExtrapolationMs: 100,
    hardSnapDistance: 96,
    softCorrectionRate: 0.22,
  }),
});

export const PACKET_TYPE = Object.freeze({
  INPUT: 1,
  SNAPSHOT: 2,
  INPUT_ACK: 3,
});

export const SNAPSHOT_FLAG = Object.freeze({
  FULL: 1 << 0,
});
