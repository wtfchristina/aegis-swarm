export class KahanVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.cx = 0;
    this.cy = 0;
    this.cz = 0;
  }

  addScaled(vx, vy, vz, scale) {
    const dx = vx * scale;
    const yx = dx - this.cx;
    const tx = this.x + yx;
    this.cx = (tx - this.x) - yx;
    this.x = tx;

    const dy = vy * scale;
    const yy = dy - this.cy;
    const ty = this.y + yy;
    this.cy = (ty - this.y) - yy;
    this.y = ty;

    const dz = vz * scale;
    const yz = dz - this.cz;
    const tz = this.z + yz;
    this.cz = (tz - this.z) - yz;
    this.z = tz;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.cx = 0;
    this.cy = 0;
    this.cz = 0;
  }
}

const CBRT2 = Math.pow(2, 1 / 3);
const YOSHIDA_W0 = -CBRT2 / (2 - CBRT2);
const YOSHIDA_W1 = 1 / (2 - CBRT2);
const YOSHIDA_C = [
  YOSHIDA_W1 / 2,
  (YOSHIDA_W0 + YOSHIDA_W1) / 2,
  (YOSHIDA_W0 + YOSHIDA_W1) / 2,
  YOSHIDA_W1 / 2,
];
const YOSHIDA_D = [YOSHIDA_W1, YOSHIDA_W0, YOSHIDA_W1];

export const FORMATIONS = {
  INTERFEROMETRY_RING: {
    name: 'Synthetic Aperture Ring (In-Plane Projected Ellipse)',
    getSlot: (idx, total, radius = 38) => {
      const angle = (idx / total) * Math.PI * 2;
      return {
        x: Math.cos(angle) * (radius * 0.5),
        y: Math.sin(angle) * radius,
        z: Math.cos(angle) * (radius * 0.866),
      };
    },
  },
  TETRAHEDRAL_ARRAY: {
    name: '3D Tetrahedral Gravitational Wave Lattice',
    getSlot: (idx, total, radius = 40) => {
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const y = 1 - (idx / (total - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = goldenAngle * idx;
      return {
        x: Math.cos(theta) * r * radius,
        y: y * radius,
        z: Math.sin(theta) * r * radius,
      };
    },
  },
  ADVERSARIAL_CROSSING: {
    name: 'Stress Test: Antipodal Singularity Swap (Collision Course)',
    getSlot: (idx, total, radius = 42) => {
      const angle = (((idx + Math.floor(total / 2)) % total) / total) * Math.PI * 2;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: (idx % 2 === 0 ? 1 : -1) * 4,
      };
    },
  },
};

export class SwarmSimulationEngine {
  constructor(nodeCount = 8) {
    this.nodeCount = nodeCount;
    this.n = 0.055;
    this.simTime = 0;

    this.integratorMode = 'YOSHIDA_SYMPLECTIC';
    this.cbfEnabled = true;
    this.safetyRadius = 11.5;
    this.cbfGamma = 1.6;
    this.formationKey = 'INTERFEROMETRY_RING';

    // Environmental Perturbations (J2 Oblateness & Differential Drag)
    this.j2PerturbationEnabled = true;
    this.differentialDragEnabled = true;
    this.inclinationRad = (97.4 * Math.PI) / 180; // Sun-Synchronous LEO reference inclination

    this.partitionActive = false;
    this.packetLossRate = 0.05;
    this.byzantineNodeId = null;
    this.messageBus = [];

    this.nodes = [];
    this.energyHistory = [];
    this.minDistanceHistory = [];
    this.cbfInterventionsCount = 0;
    this.totalDeltaV = 0;
    this.activeLinks = [];
    this.activeCbfVectors = [];

    // Asynchronous Background Co-Processor Worker
    this.workerStatus = {
      active: false,
      workerTickCount: 0,
      vectorClockChecksum: 0,
      invariantVerified: true,
    };

    try {
      this.worker = new Worker(new URL('./telemetryWorker.js', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (e) => {
        if (e.data.type === 'AUDIT_COMPLETE') {
          this.workerStatus = {
            active: true,
            ...e.data.payload,
          };
        }
      };
    } catch {
      this.worker = null;
    }

    this.initSwarm();
  }

  initSwarm() {
    this.nodes = [];
    this.simTime = 0;
    this.energyHistory = [];
    this.minDistanceHistory = [];
    this.cbfInterventionsCount = 0;
    this.totalDeltaV = 0;

    for (let i = 0; i < this.nodeCount; i++) {
      const angle = (i / this.nodeCount) * Math.PI * 2;
      const r0 = 36;
      const x = Math.cos(angle) * (r0 * 0.5);
      const y = Math.sin(angle) * r0;
      const z = Math.cos(angle) * (r0 * 0.6);

      const vx = -this.n * y * 0.5;
      const vy = 2 * this.n * x;
      const vz = -this.n * z * 0.3;

      this.nodes.push({
        id: i,
        name: `SAT-0${i + 1}`,
        partitionGroup: i < this.nodeCount / 2 ? 'ALPHA' : 'BETA',
        pos: new KahanVector3(x, y, z),
        vel: new KahanVector3(vx, vy, vz),
        ballisticPos: new KahanVector3(x, y, z),
        ballisticVel: new KahanVector3(vx, vy, vz),
        initialHamiltonian: 0,
        currentHamiltonianDrift: 0,
        ballisticCoeffRatio: 1 + (i - this.nodeCount / 2) * 0.08, // Differential B* drag ratio
        deltaVUsed: 0,

        raftState: i === 0 ? 'LEADER' : 'FOLLOWER',
        term: 1,
        leaderId: 0,
        electionTimer: 1.5 + Math.random() * 1.5,
        heartbeatTimer: 0,
        vectorClock: new Array(this.nodeCount).fill(0),
        slotAssignment: i,
        knownEphem: {},

        uNom: { x: 0, y: 0, z: 0 },
        uSafe: { x: 0, y: 0, z: 0 },
        cbfActive: false,
        minPeerDist: 999,
        trail: [],
      });
    }

    this.nodes.forEach((node) => {
      node.initialHamiltonian = this.computeJacobiHamiltonian(
        node.ballisticPos,
        node.ballisticVel
      );
      this.nodes.forEach((peer) => {
        node.knownEphem[peer.id] = {
          x: peer.pos.x,
          y: peer.pos.y,
          z: peer.pos.z,
          vx: peer.vel.x,
          vy: peer.vel.y,
          vz: peer.vel.z,
          timestamp: 0,
          byzantineFlagged: false,
        };
      });
    });
  }

  /**
   * Schweighart-Sedwick J2-Modified Hill / Clohessy-Wiltshire Coefficient c
   */
  getJ2FactorS() {
    if (!this.j2PerturbationEnabled) return 0;
    const J2 = 1.08262668e-3;
    const Re_r0 = 6378.137 / 6928.137; // 550 km LEO reference altitude
    return (
      1.5 * J2 * Re_r0 * Re_r0 * (1 + 3 * Math.cos(2 * this.inclinationRad))
    );
  }

  computeJacobiHamiltonian(pos, vel) {
    const v2 = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
    const n2 = this.n * this.n;
    const s = this.getJ2FactorS();
    const c2 = 1 + s;
    const kJ2 = 3 * n2 * c2 + 2 * n2 * s;
    const omegaZ2 = n2 * (1 + 3 * s);
    const potential = -0.5 * kJ2 * (pos.x * pos.x) + 0.5 * omegaZ2 * (pos.z * pos.z);
    return 0.5 * v2 + potential;
  }

  computeAcceleration(
    pos,
    vel,
    u = { x: 0, y: 0, z: 0 },
    includeCoriolis = true,
    node = null
  ) {
    const n = this.n;
    const n2 = n * n;
    const s = this.getJ2FactorS();
    const c = Math.sqrt(1 + s);

    const coriolisX = includeCoriolis ? 2 * n * c * vel.y : 0;
    const coriolisY = includeCoriolis ? -2 * n * c * vel.x : 0;

    // Schweighart-Sedwick J2 secular nodal regression & cross-track breathing
    const kJ2 = (3 * c * c + 2 * s) * n2;
    const omegaZ2 = (1 + 3 * s) * n2;
    const j2CrossCouplingZ =
      this.j2PerturbationEnabled && includeCoriolis
        ? 0.004 * Math.sin(this.simTime * n) * pos.x
        : 0;

    // Differential Atmospheric Drag along In-Track (-Y) axis
    let dragAy = 0;
    let dragAx = 0;
    if (this.differentialDragEnabled && node && includeCoriolis) {
      const deltaBStar = node.ballisticCoeffRatio - 1.0;
      dragAy = -0.018 * deltaBStar - 0.0012 * vel.y;
      dragAx = -0.0008 * vel.x;
    }

    return {
      ax: kJ2 * pos.x + coriolisX + dragAx + u.x,
      ay: coriolisY + dragAy + u.y,
      az: -omegaZ2 * pos.z + j2CrossCouplingZ + u.z,
    };
  }

  setFormation(formationKey) {
    if (!FORMATIONS[formationKey]) return;
    this.formationKey = formationKey;
    this.nodes.forEach((n) => {
      if (n.raftState === 'LEADER') {
        n.term += 1;
        n.vectorClock[n.id] += 1;
      }
    });
  }

  stepDistributedNetwork(dt) {
    this.activeLinks = [];

    for (const node of this.nodes) {
      node.vectorClock[node.id] += 1;

      if (node.raftState === 'LEADER') {
        node.heartbeatTimer -= dt;
        if (node.heartbeatTimer <= 0) {
          node.heartbeatTimer = 0.25;
          this.broadcastPacket(node, 'APPEND_ENTRIES');
        }
      } else {
        node.electionTimer -= dt;
        if (node.electionTimer <= 0) {
          node.raftState = 'LEADER';
          node.term += 1;
          node.leaderId = node.id;
          node.electionTimer = 1.5 + Math.random() * 1.5;
          node.heartbeatTimer = 0;
          this.broadcastPacket(node, 'APPEND_ENTRIES');
        }
      }

      this.broadcastPacket(node, 'GOSSIP_EPHEMERIS');
    }

    const remainingPackets = [];
    for (const pkt of this.messageBus) {
      pkt.ttl -= dt;
      if (pkt.ttl <= 0) {
        const sender = this.nodes[pkt.from];
        const receiver = this.nodes[pkt.to];

        const partitionBlocked =
          this.partitionActive && sender.partitionGroup !== receiver.partitionGroup;
        const dropped = Math.random() < this.packetLossRate;

        if (!partitionBlocked && !dropped) {
          this.deliverPacket(sender, receiver, pkt);
          this.activeLinks.push({
            from: sender.id,
            to: receiver.id,
            type: pkt.type,
            partitionGroup: sender.partitionGroup,
          });
        }
      } else {
        remainingPackets.push(pkt);
      }
    }
    this.messageBus = remainingPackets;
  }

  broadcastPacket(sender, type) {
    const isByzantine = sender.id === this.byzantineNodeId;

    for (const peer of this.nodes) {
      if (peer.id === sender.id) continue;

      const reportedPos = isByzantine
        ? {
            x: sender.pos.x + Math.sin(this.simTime * 7) * 28,
            y: sender.pos.y + Math.cos(this.simTime * 5) * 28,
            z: sender.pos.z - 20,
          }
        : { x: sender.pos.x, y: sender.pos.y, z: sender.pos.z };

      this.messageBus.push({
        from: sender.id,
        to: peer.id,
        type,
        term: sender.term,
        leaderId: sender.leaderId,
        vectorClock: [...sender.vectorClock],
        ephem: {
          ...reportedPos,
          vx: sender.vel.x,
          vy: sender.vel.y,
          vz: sender.vel.z,
          isCorrupted: isByzantine,
        },
        ttl: 0.04 + Math.random() * 0.04,
      });
    }
  }

  deliverPacket(sender, receiver, pkt) {
    for (let k = 0; k < this.nodeCount; k++) {
      receiver.vectorClock[k] = Math.max(receiver.vectorClock[k], pkt.vectorClock[k]);
    }

    if (pkt.type === 'APPEND_ENTRIES') {
      if (pkt.term >= receiver.term) {
        receiver.term = pkt.term;
        receiver.raftState = 'FOLLOWER';
        receiver.leaderId = pkt.from;
        receiver.electionTimer = 1.4 + Math.random() * 1.2;
      }
    }

    if (pkt.type === 'GOSSIP_EPHEMERIS') {
      const trueDx = sender.pos.x - receiver.pos.x;
      const trueDy = sender.pos.y - receiver.pos.y;
      const trueDz = sender.pos.z - receiver.pos.z;
      const reportedDx = pkt.ephem.x - receiver.pos.x;
      const reportedDy = pkt.ephem.y - receiver.pos.y;
      const reportedDz = pkt.ephem.z - receiver.pos.z;

      const innovationError = Math.hypot(
        trueDx - reportedDx,
        trueDy - reportedDy,
        trueDz - reportedDz
      );

      if (innovationError > 8.0) {
        receiver.knownEphem[sender.id] = {
          x: sender.pos.x,
          y: sender.pos.y,
          z: sender.pos.z,
          vx: sender.vel.x,
          vy: sender.vel.y,
          vz: sender.vel.z,
          timestamp: this.simTime,
          byzantineFlagged: true,
        };
      } else {
        receiver.knownEphem[sender.id] = {
          ...pkt.ephem,
          timestamp: this.simTime,
          byzantineFlagged: false,
        };
      }
    }
  }

  computeGuidanceAndSafetyFilter(node) {
    const formation = FORMATIONS[this.formationKey];
    const partitionPhaseShift =
      this.partitionActive && node.partitionGroup === 'BETA' ? 1 : 0;
    const slotIndex = (node.slotAssignment + partitionPhaseShift) % this.nodeCount;
    const target = formation.getSlot(slotIndex, this.nodeCount);

    const kp = 0.38;
    const kd = 0.95;
    const maxThrust = 18.0;

    let ux = kp * (target.x - node.pos.x) - kd * node.vel.x;
    let uy = kp * (target.y - node.pos.y) - kd * node.vel.y;
    let uz = kp * (target.z - node.pos.z) - kd * node.vel.z;

    node.uNom = { x: ux, y: uy, z: uz };
    node.cbfActive = false;
    node.minPeerDist = 999;

    for (const peer of this.nodes) {
      if (peer.id === node.id) continue;

      const rx = node.pos.x - peer.pos.x;
      const ry = node.pos.y - peer.pos.y;
      const rz = node.pos.z - peer.pos.z;
      const dist = Math.hypot(rx, ry, rz);

      if (dist < node.minPeerDist) {
        node.minPeerDist = dist;
      }

      if (!this.cbfEnabled) continue;

      const vx = node.vel.x - peer.vel.x;
      const vy = node.vel.y - peer.vel.y;
      const vz = node.vel.z - peer.vel.z;

      const nx = rx / (dist + 1e-6);
      const ny = ry / (dist + 1e-6);
      const nz = rz / (dist + 1e-6);

      const vRelRadial = vx * nx + vy * ny + vz * nz;
      const h = dist - this.safetyRadius;
      const influenceHorizon = this.safetyRadius * 2.1;

      if (dist < influenceHorizon) {
        const cbfMargin = vRelRadial + this.cbfGamma * h;

        if (cbfMargin < 0) {
          node.cbfActive = true;
          this.cbfInterventionsCount += 1;

          const requiredRepulsion = -cbfMargin * 2.6;
          const curlX = -ny * 2.2;
          const curlY = nx * 2.2;

          ux += nx * requiredRepulsion + curlX;
          uy += ny * requiredRepulsion + curlY;
          uz += nz * requiredRepulsion;

          this.activeCbfVectors.push({
            fromId: node.id,
            toId: peer.id,
            p1: { x: node.pos.x, y: node.pos.y, z: node.pos.z },
            p2: { x: peer.pos.x, y: peer.pos.y, z: peer.pos.z },
            dist,
          });
        }
      }
    }

    const mag = Math.hypot(ux, uy, uz);
    if (mag > maxThrust) {
      ux = (ux / mag) * maxThrust;
      uy = (uy / mag) * maxThrust;
      uz = (uz / mag) * maxThrust;
    }

    node.uSafe = { x: ux, y: uy, z: uz };
    return node.uSafe;
  }

  stepPhysics(dt) {
    this.simTime += dt;
    this.activeCbfVectors = [];

    this.stepDistributedNetwork(dt);

    let globalMinDist = 999;
    let avgEnergyDrift = 0;

    for (const node of this.nodes) {
      const u = this.computeGuidanceAndSafetyFilter(node);

      // Accumulate Delta-V expenditure (scaled to m/s)
      const dvStep = Math.hypot(u.x, u.y, u.z) * dt * 0.015;
      node.deltaVUsed += dvStep;
      this.totalDeltaV += dvStep;

      if (this.integratorMode === 'YOSHIDA_SYMPLECTIC') {
        for (let k = 0; k < 3; k++) {
          node.pos.addScaled(
            node.vel.x,
            node.vel.y,
            node.vel.z,
            YOSHIDA_C[k] * dt
          );
          const acc = this.computeAcceleration(node.pos, node.vel, u, true, node);
          node.vel.addScaled(acc.ax, acc.ay, acc.az, YOSHIDA_D[k] * dt);

          node.ballisticPos.addScaled(
            node.ballisticVel.x,
            node.ballisticVel.y,
            node.ballisticVel.z,
            YOSHIDA_C[k] * dt
          );
          const bAcc = this.computeAcceleration(
            node.ballisticPos,
            node.ballisticVel,
            { x: 0, y: 0, z: 0 },
            false,
            null
          );
          node.ballisticVel.addScaled(
            bAcc.ax,
            bAcc.ay,
            bAcc.az,
            YOSHIDA_D[k] * dt
          );
        }
        node.pos.addScaled(node.vel.x, node.vel.y, node.vel.z, YOSHIDA_C[3] * dt);
        node.ballisticPos.addScaled(
          node.ballisticVel.x,
          node.ballisticVel.y,
          node.ballisticVel.z,
          YOSHIDA_C[3] * dt
        );
      } else {
        const acc = this.computeAcceleration(node.pos, node.vel, u, true, node);
        node.pos.x += node.vel.x * dt;
        node.pos.y += node.vel.y * dt;
        node.pos.z += node.vel.z * dt;
        node.vel.x += acc.ax * dt;
        node.vel.y += acc.ay * dt;
        node.vel.z += acc.az * dt;

        const bAcc = this.computeAcceleration(
          node.ballisticPos,
          node.ballisticVel,
          { x: 0, y: 0, z: 0 },
          false,
          null
        );
        node.ballisticPos.x += node.ballisticVel.x * dt;
        node.ballisticPos.y += node.ballisticVel.y * dt;
        node.ballisticPos.z += node.ballisticVel.z * dt;
        node.ballisticVel.x += bAcc.ax * dt;
        node.ballisticVel.y += bAcc.ay * dt;
        node.ballisticVel.z += bAcc.az * dt;
      }

      const currentH = this.computeJacobiHamiltonian(
        node.ballisticPos,
        node.ballisticVel
      );
      const relDrift =
        Math.abs(currentH - node.initialHamiltonian) /
        (Math.abs(node.initialHamiltonian) + 1e-9);
      node.currentHamiltonianDrift = Math.max(relDrift, 1e-16);
      avgEnergyDrift += node.currentHamiltonianDrift;

      if (node.minPeerDist < globalMinDist) {
        globalMinDist = node.minPeerDist;
      }

      if (Math.floor(this.simTime * 20) % 2 === 0) {
        node.trail.push({ x: node.pos.x, y: node.pos.y, z: node.pos.z });
        if (node.trail.length > 95) node.trail.shift();
      }
    }

    avgEnergyDrift /= this.nodeCount;

    this.energyHistory.push({
      t: this.simTime,
      drift: avgEnergyDrift,
      mode: this.integratorMode,
    });
    if (this.energyHistory.length > 140) this.energyHistory.shift();

    this.minDistanceHistory.push({
      t: this.simTime,
      minDist: globalMinDist,
      safeThreshold: this.safetyRadius,
    });
    if (this.minDistanceHistory.length > 140) this.minDistanceHistory.shift();

    // Dispatch state snapshot to Asynchronous Web Worker Co-Processor
    if (this.worker) {
      this.worker.postMessage({
        type: 'AUDIT_SWARM',
        payload: {
          simTime: this.simTime,
          safetyRadius: this.safetyRadius,
          nodes: this.nodes.map((n) => ({
            id: n.id,
            x: n.pos.x,
            y: n.pos.y,
            z: n.pos.z,
            vx: n.vel.x,
            vy: n.vel.y,
            vz: n.vel.z,
            vectorClock: n.vectorClock,
          })),
        },
      });
    }
  }

  /**
   * Generates standard NASA / CCSDS OEM (Orbit Ephemeris Message v2.0) Telemetry File
   */
  generateCCSDSOEM() {
    const nowIso = new Date().toISOString();
    let oem = `CCSDS_OEM_VERS = 2.0\n`;
    oem += `CREATION_DATE  = ${nowIso}\n`;
    oem += `ORIGINATOR     = AEGIS-SWARM AUTONOMOUS GNC LAB (CHRISTINA HOLT)\n`;
    oem += `COMMENT        = Integrator: ${this.integratorMode} | J2 Oblateness: ${this.j2PerturbationEnabled ? 'ACTIVE' : 'OFF'} | ZCBF Filter: ${this.cbfEnabled ? 'ENGAGED' : 'BYPASSED'}\n`;
    oem += `COMMENT        = Total Swarm Delta-V Expended: ${this.totalDeltaV.toFixed(4)} m/s | CBF Interventions: ${this.cbfInterventionsCount}\n\n`;

    for (const node of this.nodes) {
      oem += `META_START\n`;
      oem += `OBJECT_NAME          = ${node.name}\n`;
      oem += `OBJECT_ID            = 2026-AEGIS-0${node.id + 1}\n`;
      oem += `CENTER_NAME          = CHIEF_LVLH_ORIGIN\n`;
      oem += `REF_FRAME            = HILL_LVLH\n`;
      oem += `TIME_SYSTEM          = UTC\n`;
      oem += `META_STOP\n\n`;
      oem += `COMMENT  Raft Role: ${node.raftState} (Term ${node.term}) | Partition: ${node.partitionGroup} | Lamport Vector Clock: [${node.vectorClock.join(', ')}]\n`;
      oem += `COMMENT  Epoch(s)        X (km)          Y (km)          Z (km)          VX (km/s)       VY (km/s)       VZ (km/s)\n`;

      const trailSlice = node.trail.slice(-10);
      trailSlice.forEach((pt, idx) => {
        const t = Math.max(0, this.simTime - (trailSlice.length - idx) * 0.08).toFixed(3);
        const xKm = (pt.x / 1000).toExponential(6);
        const yKm = (pt.y / 1000).toExponential(6);
        const zKm = (pt.z / 1000).toExponential(6);
        const vxKm = (node.vel.x / 1000).toExponential(6);
        const vyKm = (node.vel.y / 1000).toExponential(6);
        const vzKm = (node.vel.z / 1000).toExponential(6);
        oem += `${t.padStart(10, ' ')}  ${xKm}  ${yKm}  ${zKm}  ${vxKm}  ${vyKm}  ${vzKm}\n`;
      });
      oem += `\n`;
    }
    return oem;
  }
}
