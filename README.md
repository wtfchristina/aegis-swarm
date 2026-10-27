# AEGIS-SWARM // Distributed Autonomous GNC & Formal Safety Engine

[![Live Demo](https://img.shields.io/badge/Live-Vercel-38bdf8?style=flat-square&logo=vercel)](https://aegis-swarm.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-wtfchristina%2Faegis--swarm-0f172a?style=flat-square&logo=github)](https://github.com/wtfchristina/aegis-swarm)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Aegis-Swarm** is an advanced browser-based astrodynamics and distributed systems laboratory designed to model, simulate, and visually verify decentralized spacecraft swarms operating without a central ground controller.

## Architectural & Mathematical Pillars

### 1. Asynchronous Distributed Consensus & Lamport Vector Clocks
* **Raft Consensus State Machine:** Nodes elect local partition leaders, manage terms, and replicate heartbeat logs over a simulated Inter-Satellite Link (ISL) mesh.
* **Lamport Vector Clocks:** Every node maintains a vector clock to track causal delivery ordering across asynchronous message passing.
* **Asynchronous Web Worker Co-Processor:** Audits pairwise separation invariants, kinetic energy, and vector clock checksums off the main UI thread.
* **Chaos Engineering:** Supports split-brain network partitions, Byzantine telemetry spoofing, and stochastic packet loss.

### 2. Schweighart-Sedwick $J_2$ Relative Dynamics & Yoshida Symplectic Integration
* **Relative Motion & Perturbations:** Governed by Schweighart-Sedwick $J_2$-modified Clohessy-Wiltshire equations in the local Hill / LVLH reference frame, including differential atmospheric drag ($\Delta B^*$).
* **Yoshida Symplectic Integrator ($4\text{th-Order}$):** Preserves Hamiltonian energy (Jacobi integral) over extended horizons, preventing exponential secular drift.
* **Kahan Compensated Summation:** Eliminates IEEE-754 floating-point addition truncation error.

### 3. Formal Control Barrier Functions (ZCBF) & CCSDS Telemetry
* **Safe Set Invariance:** Enforces pairwise center-to-center Euclidean separation distances $h_{ij} = \|\mathbf{r}_{ij}\|^2 - R_{\text{safe}}^2 \ge 0$.
* **QP-Free Minimal Projection:** Minimally projects nominal actuator commands onto the safe half-space when approaching the influence horizon, guaranteeing zero collisions ($d_{\min} > R_{\text{safe}}$).
* **NASA / CCSDS OEM v2.0 Export:** One-click serialization of live state vectors, $\Delta v$ expenditure, and Lamport vector clocks into standard Orbit Ephemeris Message (`.oem`) format.

## Local Development & Quickstart

```bash
git clone [https://github.com/wtfchristina/aegis-swarm.git](https://github.com/wtfchristina/aegis-swarm.git)
cd aegis-swarm
npm install
npm run dev

