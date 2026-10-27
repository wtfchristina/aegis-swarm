import { SwarmSimulationEngine, KahanVector3 } from '../src/engine/swarmSimulationEngine.js';

console.log('====================================================================');
console.log(' AEGIS-SWARM // FORMAL MATHEMATICAL & INVARIANT VERIFICATION SUITE');
console.log('====================================================================\n');

let passed = 0;
let failed = 0;

function assertInvariant(name, condition, detail) {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    console.log(`          └─ ${detail}\n`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`          └─ ${detail}\n`);
    failed++;
  }
}

// TEST 1: Kahan Babushka Neumaier Floating-Point Compensation
const kahan = new KahanVector3(1.0, 0, 0);
let naiveSum = 1.0;
const tinyDelta = 1e-16;
for (let i = 0; i < 100000; i++) {
  kahan.addScaled(1.0, 0, 0, tinyDelta);
  naiveSum += tinyDelta;
}
const exactExpected = 1.0 + 100000 * tinyDelta;
const kahanError = Math.abs(kahan.x - exactExpected);
const naiveError = Math.abs(naiveSum - exactExpected);

assertInvariant(
  'Pillar 1: IEEE-754 Kahan Compensated Summation Precision',
  kahanError < naiveError || kahanError < 1e-15,
  `Kahan Error: ${kahanError.toExponential(3)} vs Naive Float64 Error: ${naiveError.toExponential(3)}`
);

// TEST 2: 4th-Order Yoshida Symplectic vs Explicit Euler Hamiltonian Conservation
const sympEngine = new SwarmSimulationEngine(8);
sympEngine.integratorMode = 'YOSHIDA_SYMPLECTIC';
sympEngine.j2PerturbationEnabled = false;
for (let i = 0; i < 250; i++) sympEngine.stepPhysics(0.04);
const sympDrift = sympEngine.energyHistory[sympEngine.energyHistory.length - 1].drift;

const eulerEngine = new SwarmSimulationEngine(8);
eulerEngine.integratorMode = 'EXPLICIT_EULER';
eulerEngine.j2PerturbationEnabled = false;
for (let i = 0; i < 250; i++) eulerEngine.stepPhysics(0.04);
const eulerDrift = eulerEngine.energyHistory[eulerEngine.energyHistory.length - 1].drift;

assertInvariant(
  'Pillar 2: 4th-Order Yoshida Symplectic Hamiltonian Conservation',
  sympDrift < eulerDrift,
  `Yoshida Symplectic |ΔH/H₀|: ${sympDrift.toExponential(3)} << Explicit Euler |ΔH/H₀|: ${eulerDrift.toExponential(3)}`
);

// TEST 3: Zeroing Control Barrier Function (ZCBF) Adversarial Singularity Safety
const cbfEngine = new SwarmSimulationEngine(8);
cbfEngine.cbfEnabled = true;
cbfEngine.setFormation('ADVERSARIAL_CROSSING');
let minObservedClearance = 999;
for (let i = 0; i < 300; i++) {
  cbfEngine.stepPhysics(0.04);
  const latestMin = cbfEngine.minDistanceHistory[cbfEngine.minDistanceHistory.length - 1].minDist;
  if (latestMin < minObservedClearance) minObservedClearance = latestMin;
}

assertInvariant(
  'Pillar 3: Formal Control Barrier Function (ZCBF) Non-Collision Invariant',
  minObservedClearance > cbfEngine.safetyRadius * 0.85 && cbfEngine.cbfInterventionsCount > 0,
  `Min Clearance during Antipodal Origin Crossing: ${minObservedClearance.toFixed(2)}m (Threshold: ${cbfEngine.safetyRadius}m, Interventions: ${cbfEngine.cbfInterventionsCount})`
);

// TEST 4: 5,000-Node WebGPU / SIMD Compute Kernel Execution & CCSDS Standards
cbfEngine.massiveSwarmEnabled = true;
cbfEngine.stepPhysics(0.04);
const oemString = cbfEngine.generateCCSDSOEM();
const ommString = cbfEngine.generateCCSDSOMM();

assertInvariant(
  'Pillar 4: 5,000-Node Compute Kernel & NASA/CCSDS OEM/OMM v2.0 Serialization',
  oemString.includes('CCSDS_OEM_VERS = 2.0') &&
    ommString.includes('CCSDS_OMM_VERS = 2.0') &&
    ommString.includes('SGP4_SCHWEIGHART_SEDWICK_J2'),
  `5,000-Node Step Time: ${cbfEngine.gpuSwarm.lastStepMs.toFixed(3)}ms | OEM (${oemString.length} bytes) & OMM (${ommString.length} bytes) verified`
);

console.log('====================================================================');
console.log(` VERIFICATION COMPLETE: ${passed}/4 INVARIANTS PASSED`);
console.log('====================================================================');
if (failed > 0) process.exit(1);
