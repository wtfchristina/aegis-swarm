let nodeCount = 8;
let simTime = 0;
let n = 0.055;
let safetyRadius = 11.5;
let cbfGamma = 1.6;
let partitionActive = false;
let packetLossRate = 0.05;
let byzantineNodeId = null;
let integratorMode = 'YOSHIDA_SYMPLECTIC';
let cbfEnabled = true;

let nodes = [];
let messageBus = [];

const CBRT2 = Math.pow(2, 1 / 3);
const YOSHIDA_W0 = -CBRT2 / (2 - CBRT2);
const YOSHIDA_W1 = 1 / (2 - CBRT2);
const YOSHIDA_C = [YOSHIDA_W1 / 2, (YOSHIDA_W0 + YOSHIDA_W1) / 2, (YOSHIDA_W0 + YOSHIDA_W1) / 2, YOSHIDA_W1 / 2];
const YOSHIDA_D = [YOSHIDA_W1, YOSHIDA_W0, YOSHIDA_W1];

self.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'INIT') {
    nodeCount = payload.nodeCount;
    initWorkerSwarm();
  } else if (type === 'CONFIG') {
    if (payload.integratorMode) integratorMode = payload.integratorMode;
    if (payload.cbfEnabled !== undefined) cbfEnabled = payload.cbfEnabled;
    if (payload.partitionActive !== undefined) partitionActive = payload.partitionActive;
    if (payload.packetLossRate !== undefined) packetLossRate = payload.packetLossRate;
  } else if (type === 'STEP') {
    stepWorkerPhysics(payload.dt);
  }
};

function initWorkerSwarm() {
  nodes = [];
  simTime = 0;
  messageBus = [];

  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2;
    const r0 = 36;
    nodes.push({
      id: i,
      partitionGroup: i < nodeCount / 2 ? 'ALPHA' : 'BETA',
      x: Math.cos(angle) * (r0 * 0.5),
      y: Math.sin(angle) * r0,
      z: Math.cos(angle) * (r0 * 0.6),
      vx: -n * Math.sin(angle) * r0 * 0.5,
      vy: 2 * n * Math.cos(angle) * (r0 * 0.5),
      vz: -n * Math.cos(angle) * (r0 * 0.6) * 0.3,
      raftState: i === 0 ? 'LEADER' : 'FOLLOWER',
      term: 1,
      vectorClock: new Array(nodeCount).fill(0),
      minPeerDist: 999,
      cbfActive: false,
    });
  }
}

function computeAcceleration(x, y, z, vx, vy, vz, u) {
  const r2 = x * x + y * y + z * z;
  const r = Math.sqrt(r2);
  const mu = 3.986004418e14;
  const J2 = 1.08263e-3;
  const Re = 6378137;
  const n2 = n * n;
  const z2_r2 = (z * z) / r2;
  const j2Factor = (1.5 * J2 * mu * Re * Re) / Math.pow(r, 5);

  return {
    ax: 3 * n2 * x + 2 * n * vy + j2Factor * x * (5 * z2_r2 - 1) + u.x,
    ay: -2 * n * vx + j2Factor * y * (5 * z2_r2 - 1) + u.y,
    az: -n2 * z + j2Factor * z * (5 * z2_r2 - 3) + u.z,
  };
}

function stepWorkerPhysics(dt) {
  simTime += dt;
  let globalMinDist = 999;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const angle = (i / nodeCount) * Math.PI * 2 + simTime * 0.05;
    const targetX = Math.cos(angle) * 19;
    const targetY = Math.sin(angle) * 38;
    const targetZ = Math.cos(angle) * 24;

    let ux = 0.38 * (targetX - node.x) - 0.95 * node.vx;
    let uy = 0.38 * (targetY - node.y) - 0.95 * node.vy;
    let uz = 0.38 * (targetZ - node.z) - 0.95 * node.vz;

    node.minPeerDist = 999;
    node.cbfActive = false;

    if (cbfEnabled) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const peer = nodes[j];
        const rx = node.x - peer.x;
        const ry = node.y - peer.y;
        const rz = node.z - peer.z;
        const dist = Math.hypot(rx, ry, rz);

        if (dist < node.minPeerDist) node.minPeerDist = dist;

        if (dist < safetyRadius * 2.1) {
          const vRelRadial = (node.vx - peer.vx) * (rx / dist) +
                             (node.vy - peer.vy) * (ry / dist) +
                             (node.vz - peer.vz) * (rz / dist);
          const h = dist - safetyRadius;
          const cbfMargin = vRelRadial + cbfGamma * h;

          if (cbfMargin < 0) {
            node.cbfActive = true;
            const rep = -cbfMargin * 2.8;
            ux += (rx / dist) * rep - (ry / dist) * 1.5;
            uy += (ry / dist) * rep + (rx / dist) * 1.5;
            uz += (rz / dist) * rep;
          }
        }
      }
    }

    if (node.minPeerDist < globalMinDist) globalMinDist = node.minPeerDist;

    if (integratorMode === 'YOSHIDA_SYMPLECTIC') {
      for (let k = 0; k < 3; k++) {
        node.x += node.vx * YOSHIDA_C[k] * dt;
        node.y += node.vy * YOSHIDA_C[k] * dt;
        node.z += node.vz * YOSHIDA_C[k] * dt;
        const acc = computeAcceleration(node.x, node.y, node.z, node.vx, node.vy, node.vz, { x: ux, y: uy, z: uz });
        node.vx += acc.ax * YOSHIDA_D[k] * dt;
        node.vy += acc.ay * YOSHIDA_D[k] * dt;
        node.vz += acc.az * YOSHIDA_D[k] * dt;
      }
      node.x += node.vx * YOSHIDA_C[3] * dt;
      node.y += node.vy * YOSHIDA_C[3] * dt;
      node.z += node.vz * YOSHIDA_C[3] * dt;
    } else {
      const acc = computeAcceleration(node.x, node.y, node.z, node.vx, node.vy, node.vz, { x: ux, y: uy, z: uz });
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      node.z += node.vz * dt;
      node.vx += acc.ax * dt;
      node.vy += acc.ay * dt;
      node.vz += acc.az * dt;
    }
  }

  self.postMessage({ type: 'TICK', simTime, nodes, globalMinDist });
}
