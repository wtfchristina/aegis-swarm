import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Cpu,
  Network,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Radio,
  Lock,
  Unlock,
  GitBranch,
  Download,
  Globe,
  Wind,
} from 'lucide-react';
import { SwarmSimulationEngine, FORMATIONS } from './engine/swarmSimulationEngine';
import SwarmViewport3D from './components/SwarmViewport3D';

export default function App() {
  const engineRef = useRef(new SwarmSimulationEngine(8));
  const [isRunning, setIsRunning] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(0);
  const [, setTelemetryTick] = useState(0);

  useEffect(() => {
    let intervalId;
    if (isRunning) {
      intervalId = setInterval(() => {
        engineRef.current.stepPhysics(0.04);
        setTelemetryTick((t) => t + 1);
      }, 30);
    }
    return () => clearInterval(intervalId);
  }, [isRunning]);

  const eng = engineRef.current;
  const latestEnergy =
    eng.energyHistory[eng.energyHistory.length - 1]?.drift || 1e-15;
  const latestMinDist =
    eng.minDistanceHistory[eng.minDistanceHistory.length - 1]?.minDist || 99.9;
  const activeLeaders = eng.nodes.filter((n) => n.raftState === 'LEADER');

  const handleToggleIntegrator = (mode) => {
    eng.integratorMode = mode;
    setTelemetryTick((t) => t + 1);
  };

  const handleToggleCBF = () => {
    eng.cbfEnabled = !eng.cbfEnabled;
    setTelemetryTick((t) => t + 1);
  };

  const handleTogglePartition = () => {
    eng.partitionActive = !eng.partitionActive;
    setTelemetryTick((t) => t + 1);
  };

  const handleToggleByzantine = () => {
    eng.byzantineNodeId = eng.byzantineNodeId === null ? 2 : null;
    setTelemetryTick((t) => t + 1);
  };

  const handleToggleJ2 = () => {
    eng.j2PerturbationEnabled = !eng.j2PerturbationEnabled;
    setTelemetryTick((t) => t + 1);
  };

  const handleToggleDrag = () => {
    eng.differentialDragEnabled = !eng.differentialDragEnabled;
    setTelemetryTick((t) => t + 1);
  };

  const handleExportCCSDS = () => {
    const oemContent = eng.generateCCSDSOEM();
    const blob = new Blob([oemContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AEGIS_SWARM_CCSDS_OEM_${Math.floor(eng.simTime)}s.oem`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    eng.initSwarm();
    setTelemetryTick((t) => t + 1);
  };

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <div style={styles.brandBlock}>
          <div style={styles.statusDot} />
          <div>
            <h1 style={styles.title}>
              AEGIS-SWARM // DISTRIBUTED AUTONOMOUS GNC & FORMAL SAFETY LAB
            </h1>
            <p style={styles.subtitle}>
              Raft Consensus Mesh • 4th-Order Yoshida Symplectic (Kahan Float64) • J₂ Oblateness • Control Barrier Functions (ZCBF)
            </p>
          </div>
        </div>

        <div style={styles.headerMetrics}>
          <div style={styles.metricBadge}>
            <span style={styles.metricLabel}>WORKER THREAD AUDIT</span>
            <span style={{ ...styles.metricValue, color: '#00f5d4', fontSize: 12 }}>
              {eng.workerStatus.active
                ? `SYNC #${eng.workerStatus.workerTickCount}`
                : 'LOCAL LOOP'}
            </span>
          </div>

          <div style={styles.metricBadge}>
            <span style={styles.metricLabel}>MIN SEPARATION (d_min)</span>
            <span
              style={{
                ...styles.metricValue,
                color:
                  latestMinDist < eng.safetyRadius
                    ? '#f43f5e'
                    : latestMinDist < eng.safetyRadius * 1.35
                    ? '#facc15'
                    : '#10b981',
              }}
            >
              {latestMinDist.toFixed(2)} m
            </span>
          </div>

          <div style={styles.metricBadge}>
            <span style={styles.metricLabel}>HAMILTONIAN DRIFT |ΔH/H₀|</span>
            <span
              style={{
                ...styles.metricValue,
                color:
                  eng.integratorMode === 'YOSHIDA_SYMPLECTIC' ? '#38bdf8' : '#fb923c',
              }}
            >
              {latestEnergy.toExponential(2)}
            </span>
          </div>

          <div style={styles.metricBadge}>
            <span style={styles.metricLabel}>SWARM ΔV EXPENDED</span>
            <span style={{ ...styles.metricValue, color: '#facc15' }}>
              {eng.totalDeltaV.toFixed(2)} m/s
            </span>
          </div>

          <div style={styles.metricBadge}>
            <span style={styles.metricLabel}>CBF INTERVENTIONS</span>
            <span style={{ ...styles.metricValue, color: '#f43f5e' }}>
              {eng.cbfInterventionsCount}
            </span>
          </div>

          <div style={styles.simControls}>
            <button
              onClick={handleExportCCSDS}
              style={styles.exportBtn}
              title="Download NASA/CCSDS OEM v2.0 Ephemeris Telemetry"
            >
              <Download size={14} />
              <span>CCSDS OEM</span>
            </button>
            <button
              onClick={() => setIsRunning(!isRunning)}
              style={styles.iconBtn}
              title={isRunning ? 'Pause Propagation' : 'Resume Propagation'}
            >
              {isRunning ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              onClick={handleReset}
              style={styles.iconBtn}
              title="Reset Constellation Ephemeris"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </header>

      <div style={styles.workbench}>
        <aside style={styles.leftPanel}>
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <Network size={15} color="#38bdf8" />
              <span style={styles.cardTitle}>
                1. DISTRIBUTED CONSENSUS & CHAOS
              </span>
            </div>
            <p style={styles.cardDesc}>
              Inject asynchronous network partitions (split-brain) or Byzantine telemetry corruption across the Inter-Satellite Link (ISL) mesh.
            </p>

            <button
              onClick={handleTogglePartition}
              style={{
                ...styles.actionBtn,
                backgroundColor: eng.partitionActive ? '#7f1d1d' : '#0f172a',
                borderColor: eng.partitionActive ? '#f43f5e' : '#1e293b',
              }}
            >
              <GitBranch size={14} />
              <span>
                {eng.partitionActive
                  ? 'SPLIT-BRAIN PARTITION: ACTIVE (ALPHA // BETA)'
                  : 'INJECT SPLIT-BRAIN NETWORK PARTITION'}
              </span>
            </button>

            <button
              onClick={handleToggleByzantine}
              style={{
                ...styles.actionBtn,
                marginTop: 8,
                backgroundColor:
                  eng.byzantineNodeId !== null ? '#4c1d95' : '#0f172a',
                borderColor:
                  eng.byzantineNodeId !== null ? '#a855f7' : '#1e293b',
              }}
            >
              <Radio size={14} />
              <span>
                {eng.byzantineNodeId !== null
                  ? 'BYZANTINE FAULT ACTIVE (SAT-03 SPOOFING)'
                  : 'INJECT BYZANTINE ROGUE TELEMETRY (SAT-03)'}
              </span>
            </button>

            <div style={styles.sliderRow}>
              <div style={styles.sliderHeader}>
                <span>ISL PACKET LOSS RATE</span>
                <span style={{ color: '#38bdf8' }}>
                  {Math.round(eng.packetLossRate * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.75"
                step="0.05"
                value={eng.packetLossRate}
                onChange={(e) => {
                  eng.packetLossRate = parseFloat(e.target.value);
                  setTelemetryTick((t) => t + 1);
                }}
                style={styles.slider}
              />
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <Cpu size={15} color="#00f5d4" />
              <span style={styles.cardTitle}>
                2. SYMPLECTIC INTEGRATOR & PERTURBATIONS
              </span>
            </div>
            <p style={styles.cardDesc}>
              Compare 4th-order symplectic integration against Explicit Euler, and toggle Schweighart-Sedwick J₂ oblateness & differential drag.
            </p>

            <div style={styles.SegmentGroup}>
              <button
                onClick={() => handleToggleIntegrator('YOSHIDA_SYMPLECTIC')}
                style={{
                  ...styles.segmentBtn,
                  backgroundColor:
                    eng.integratorMode === 'YOSHIDA_SYMPLECTIC'
                      ? '#0284c7'
                      : '#0f172a',
                  color:
                    eng.integratorMode === 'YOSHIDA_SYMPLECTIC'
                      ? '#ffffff'
                      : '#94a3b8',
                }}
              >
                Yoshida 4th-Order Symplectic + Kahan
              </button>
              <button
                onClick={() => handleToggleIntegrator('EXPLICIT_EULER')}
                style={{
                  ...styles.segmentBtn,
                  backgroundColor:
                    eng.integratorMode === 'EXPLICIT_EULER'
                      ? '#ea580c'
                      : '#0f172a',
                  color:
                    eng.integratorMode === 'EXPLICIT_EULER'
                      ? '#ffffff'
                      : '#94a3b8',
                }}
              >
                Naive Explicit Euler (Drifts)
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                onClick={handleToggleJ2}
                style={{
                  ...styles.perturbationBtn,
                  backgroundColor: eng.j2PerturbationEnabled ? '#0c4a6e' : '#090d16',
                  borderColor: eng.j2PerturbationEnabled ? '#38bdf8' : '#1e293b',
                }}
              >
                <Globe size={13} color="#38bdf8" />
                <span>J₂ Oblateness: {eng.j2PerturbationEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={handleToggleDrag}
                style={{
                  ...styles.perturbationBtn,
                  backgroundColor: eng.differentialDragEnabled ? '#0c4a6e' : '#090d16',
                  borderColor: eng.differentialDragEnabled ? '#00f5d4' : '#1e293b',
                }}
              >
                <Wind size={13} color="#00f5d4" />
                <span>Diff. Drag: {eng.differentialDragEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <ShieldAlert size={15} color="#10b981" />
              <span style={styles.cardTitle}>
                3. FORMAL SAFETY INVARIANT (ZCBF)
              </span>
            </div>
            <p style={styles.cardDesc}>
              Enforces forward invariance of the safe set h(x) ≥ 0. Command an Adversarial Antipodal Swap to watch CBF prevent mid-origin collisions.
            </p>

            <button
              onClick={handleToggleCBF}
              style={{
                ...styles.actionBtn,
                backgroundColor: eng.cbfEnabled ? '#064e3b' : '#7f1d1d',
                borderColor: eng.cbfEnabled ? '#10b981' : '#f43f5e',
              }}
            >
              {eng.cbfEnabled ? <Lock size={14} /> : <Unlock size={14} />}
              <span>
                {eng.cbfEnabled
                  ? 'CBF SAFETY FILTER: ENGAGED (h_ij ≥ 0)'
                  : 'CBF SAFETY FILTER: BYPASSED (UNSAFE!)'}
              </span>
            </button>

            <div style={{ marginTop: 10 }}>
              <span style={styles.smallLabel}>COMMAND SWARM RECONFIGURATION</span>
              {Object.entries(FORMATIONS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => {
                    eng.setFormation(key);
                    setTelemetryTick((t) => t + 1);
                  }}
                  style={{
                    ...styles.formationBtn,
                    borderColor:
                      eng.formationKey === key ? '#38bdf8' : '#1e293b',
                    backgroundColor:
                      eng.formationKey === key ? '#0c4a6e' : '#090d16',
                  }}
                >
                  <Zap
                    size={13}
                    color={
                      key === 'ADVERSARIAL_CROSSING' ? '#f43f5e' : '#38bdf8'
                    }
                  />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main style={styles.viewportWrapper}>
          <SwarmViewport3D
            engineRef={engineRef}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />

          <div style={styles.viewportLegend}>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, backgroundColor: '#facc15' }} />
              <span>Raft Leader ({activeLeaders.map((n) => n.name).join(', ')})</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, backgroundColor: '#00f5d4' }} />
              <span>Follower (Alpha Partition)</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, backgroundColor: '#38bdf8' }} />
              <span>Follower (Beta Partition)</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, backgroundColor: '#f43f5e' }} />
              <span>Active CBF Repulsion Barrier</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.dot, backgroundColor: '#a855f7' }} />
              <span>Byzantine Spoofing Node</span>
            </div>
          </div>
        </main>

        <aside style={styles.rightPanel}>
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <Activity size={15} color="#facc15" />
              <span style={styles.cardTitle}>
                RAFT QUORUM & LAMPORT VECTOR CLOCKS
              </span>
            </div>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>NODE</th>
                    <th style={styles.th}>ROLE / TERM</th>
                    <th style={styles.th}>VECTOR CLOCK [V₀..V₇]</th>
                    <th style={styles.th}>d_min</th>
                  </tr>
                </thead>
                <tbody>
                  {eng.nodes.map((node) => {
                    const isByz = eng.byzantineNodeId === node.id;
                    return (
                      <tr
                        key={node.id}
                        style={{
                          backgroundColor: node.cbfActive
                            ? 'rgba(244, 63, 94, 0.14)'
                            : 'transparent',
                        }}
                      >
                        <td style={styles.td}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isByz
                                ? '#a855f7'
                                : node.raftState === 'LEADER'
                                ? '#facc15'
                                : '#e2e8f0',
                            }}
                          >
                            {node.name}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.roleTag,
                              backgroundColor: isByz
                                ? '#581c87'
                                : node.raftState === 'LEADER'
                                ? '#713f12'
                                : '#1e293b',
                              color: isByz
                                ? '#e9d5ff'
                                : node.raftState === 'LEADER'
                                ? '#fde047'
                                : '#94a3b8',
                            }}
                          >
                            {isByz ? 'BYZANTINE' : node.raftState} (T{node.term})
                          </span>
                        </td>
                        <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 10 }}>
                          [{node.vectorClock.map((v) => v % 100).join(' ')}]
                        </td>
                        <td
                          style={{
                            ...styles.td,
                            color:
                              node.minPeerDist < eng.safetyRadius
                                ? '#f43f5e'
                                : '#10b981',
                            fontWeight: 600,
                          }}
                        >
                          {node.minPeerDist.toFixed(1)}m
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <Cpu size={15} color="#38bdf8" />
              <span style={styles.cardTitle}>
                LOG₁₀ HAMILTONIAN DRIFT |ΔH / H₀|
              </span>
            </div>
            <p style={styles.cardDesc}>
              Symplectic integration bounds energy oscillations across arbitrary horizons; Explicit Euler diverges exponentially.
            </p>
            <svg width="100%" height="105" viewBox="0 0 280 105" style={styles.svgChart}>
              <line x1="0" y1="20" x2="280" y2="20" stroke="#1e293b" strokeDasharray="3,3" />
              <line x1="0" y1="55" x2="280" y2="55" stroke="#1e293b" strokeDasharray="3,3" />
              <line x1="0" y1="90" x2="280" y2="90" stroke="#1e293b" strokeDasharray="3,3" />
              <text x="4" y="16" fill="#64748b" fontSize="9">10⁻¹ (Divergent)</text>
              <text x="4" y="86" fill="#64748b" fontSize="9">10⁻⁶ (Symplectic Bound)</text>

              {eng.energyHistory.length > 1 && (
                <polyline
                  fill="none"
                  stroke={
                    eng.integratorMode === 'YOSHIDA_SYMPLECTIC'
                      ? '#00f5d4'
                      : '#fb923c'
                  }
                  strokeWidth="2"
                  points={eng.energyHistory
                    .map((pt, i) => {
                      const x = (i / 140) * 280;
                      const logVal = Math.log10(Math.max(pt.drift, 1e-8));
                      const y = 95 - ((logVal + 8) / 8) * 85;
                      return `${x.toFixed(1)},${Math.max(8, Math.min(98, y)).toFixed(1)}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          </section>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <ShieldAlert size={15} color="#f43f5e" />
              <span style={styles.cardTitle}>
                MINIMUM INTER-SATELLITE CLEARANCE
              </span>
            </div>
            <p style={styles.cardDesc}>
              Red dashed line marks hard collision threshold R_safe = {eng.safetyRadius}m.
            </p>
            <svg width="100%" height="105" viewBox="0 0 280 105" style={styles.svgChart}>
              <line
                x1="0"
                y1={100 - (eng.safetyRadius / 45) * 90}
                x2="280"
                y2={100 - (eng.safetyRadius / 45) * 90}
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <text
                x="6"
                y={96 - (eng.safetyRadius / 45) * 90}
                fill="#f43f5e"
                fontSize="9"
              >
                Barrier Boundary R_safe ({eng.safetyRadius}m)
              </text>

              {eng.minDistanceHistory.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  points={eng.minDistanceHistory
                    .map((pt, i) => {
                      const x = (i / 140) * 280;
                      const clamped = Math.min(pt.minDist, 45);
                      const y = 100 - (clamped / 45) * 90;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>
          </section>
        </aside>
      </div>
    </div>
  );
}

const styles = {
  appContainer: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#050811',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
  },
  header: {
    height: 62,
    backgroundColor: '#090d16',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    flexShrink: 0,
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#00f5d4',
    boxShadow: '0 0 10px #00f5d4',
  },
  title: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '0.06em',
    margin: 0,
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    margin: '2px 0 0 0',
  },
  headerMetrics: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  metricBadge: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 6,
    padding: '5px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.05em',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: 800,
    fontFamily: 'monospace',
  },
  simControls: {
    display: 'flex',
    gap: 6,
  },
  exportBtn: {
    backgroundColor: '#0284c7',
    border: '1px solid #38bdf8',
    color: '#ffffff',
    borderRadius: 6,
    padding: '0 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#f8fafc',
    borderRadius: 6,
    padding: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workbench: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '330px 1fr 360px',
    overflow: 'hidden',
  },
  leftPanel: {
    backgroundColor: '#090d16',
    borderRight: '1px solid #1e293b',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflowY: 'auto',
  },
  rightPanel: {
    backgroundColor: '#090d16',
    borderLeft: '1px solid #1e293b',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflowY: 'auto',
  },
  card: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 8,
    padding: 12,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.05em',
    color: '#f1f5f9',
  },
  cardDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 1.45,
    margin: '0 0 10px 0',
  },
  actionBtn: {
    width: '100%',
    padding: '9px 10px',
    borderRadius: 6,
    border: '1px solid #1e293b',
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
  },
  perturbationBtn: {
    flex: 1,
    padding: '7px 8px',
    borderRadius: 6,
    border: '1px solid #1e293b',
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  sliderRow: {
    marginTop: 10,
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    fontWeight: 700,
    color: '#94a3b8',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
  },
  SegmentGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  segmentBtn: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #1e293b',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
  },
  smallLabel: {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: '0.04em',
  },
  formationBtn: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #1e293b',
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    textAlign: 'left',
  },
  viewportWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  viewportLegend: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    border: '1px solid #1e293b',
    borderRadius: 8,
    padding: '8px 14px',
    display: 'flex',
    gap: 16,
    backdropFilter: 'blur(6px)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: '#cbd5e1',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
  },
  th: {
    textAlign: 'left',
    padding: '5px 4px',
    borderBottom: '1px solid #1e293b',
    color: '#64748b',
    fontSize: 9,
    fontWeight: 700,
  },
  td: {
    padding: '5px 4px',
    borderBottom: '1px solid rgba(30, 41, 59, 0.5)',
  },
  roleTag: {
    padding: '2px 5px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 700,
  },
  svgChart: {
    backgroundColor: '#050811',
    borderRadius: 6,
    border: '1px solid #1e293b',
  },
};
