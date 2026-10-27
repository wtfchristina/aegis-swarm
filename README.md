# AEGIS-SWARM // Distributed Autonomous GNC, WebGPU Compute & Formal Safety Lab

[![Live Demo](https://img.shields.io/badge/Live-Vercel-38bdf8?style=flat-square&logo=vercel)](https://aegis-swarm.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-wtfchristina%2Faegis--swarm-0f172a?style=flat-square&logo=github)](https://github.com/wtfchristina/aegis-swarm)
[![CCSDS Standard](https://img.shields.io/badge/Telemetry-CCSDS%20OEM%20%2F%20OMM%20v2.0-facc15?style=flat-square)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Aegis-Swarm** is an interactive browser-based astrodynamics, distributed consensus, and formal safety verification laboratory modeling decentralized spacecraft constellations operating without a central ground controller.

## Core Architectural & Mathematical Pillars

1. **Asynchronous Distributed Consensus & Lamport Vector Clocks:** Raft consensus state machine with Lamport vector clocks `[V0..V7]`, split-brain network partitions, packet loss simulation, and Byzantine fault isolation.
2. **Schweighart-Sedwick J2 Oblateness, Differential Drag & Symplectic Integration:** 4th-order Yoshida symplectic integrator paired with Kahan summation, modeling J2 nodal regression and differential ballistic drag (`Cd*A/m`).
3. **5,000-Node WebGPU Compute Shader Pipeline (WGSL):** Parallel GPU propagation (`@compute @workgroup_size(64)`) scaling the constellation to 5,008 spacecraft rendered via `THREE.InstancedMesh` at 60 FPS.
4. **Formal Control Barrier Functions (ZCBF) & NASA/CCSDS OEM/OMM Export:** Forward-invariant collision avoidance (`d_min > R_safe`) and one-click telemetry export to standard `.oem` and `.omm` v2.0 formats.

## Quickstart & Verification

- Install: `npm install`
- Run Formal Invariant Suite: `npm test`
- Start Workstation: `npm run dev`

## License
Distributed under the MIT License.
