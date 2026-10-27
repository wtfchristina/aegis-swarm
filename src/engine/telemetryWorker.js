// Asynchronous Web Worker Co-Processor for Consensus & Ephemeris Auditing (Safari-Safe)
let workerTickCount = 0;

self.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'AUDIT_SWARM') {
    workerTickCount += 1;
    const { nodes, simTime, safetyRadius } = payload;

    let minPairDist = 999;
    let totalKineticEnergy = 0;
    let vectorClockChecksum = 0;

    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      totalKineticEnergy += 0.5 * (n1.vx * n1.vx + n1.vy * n1.vy + n1.vz * n1.vz);
      for (let k = 0; k < n1.vectorClock.length; k++) {
        vectorClockChecksum += n1.vectorClock[k];
      }
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const d = Math.hypot(n1.x - n2.x, n1.y - n2.y, n1.z - n2.z);
        if (d < minPairDist) minPairDist = d;
      }
    }

    self.postMessage({
      type: 'AUDIT_COMPLETE',
      payload: {
        workerTickCount,
        simTime,
        minPairDist,
        totalKineticEnergy,
        vectorClockChecksum,
        invariantVerified: minPairDist >= safetyRadius * 0.85,
      },
    });
  }
};
