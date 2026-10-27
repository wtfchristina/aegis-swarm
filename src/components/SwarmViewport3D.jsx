import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FORMATIONS } from '../engine/swarmSimulationEngine';

export default function SwarmViewport3D({ engineRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050811);
    scene.fog = new THREE.FogExp2(0x050811, 0.0032);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x88aaff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(80, 120, 90);
    scene.add(dirLight);

    const rimLight = new THREE.PointLight(0x00f0ff, 1.2, 220);
    rimLight.position.set(0, 0, 0);
    scene.add(rimLight);

    const gridHelper = new THREE.GridHelper(140, 28, 0x1e3a5f, 0x0d1b2a);
    gridHelper.position.y = -45;
    scene.add(gridHelper);

    const originGeo = new THREE.OctahedronGeometry(2.2, 0);
    const originMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
    });
    const originMesh = new THREE.Mesh(originGeo, originMat);
    scene.add(originMesh);

    // 1,400-Star Deep-Space Backdrop
    const starCount = 1400;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 600;
      starPositions[i + 1] = (Math.random() - 0.5) * 600;
      starPositions[i + 2] = (Math.random() - 0.5) * 600;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.9,
      transparent: true,
      opacity: 0.65,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    const engine = engineRef.current;
    const nodeMeshes = [];
    const barrierSpheres = [];
    const targetMarkers = [];
    const trailLines = [];

    const satBodyGeo = new THREE.OctahedronGeometry(1.9, 1);
    const barrierGeo = new THREE.SphereGeometry(1, 20, 16);
    const targetGeo = new THREE.RingGeometry(1.6, 2.2, 16);

    for (let i = 0; i < engine.nodeCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x00f5d4,
        emissive: 0x004455,
        metalness: 0.7,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(satBodyGeo, mat);
      mesh.userData = { nodeId: i };
      scene.add(mesh);
      nodeMeshes.push(mesh);

      const barrierMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
      });
      const bSphere = new THREE.Mesh(barrierGeo, barrierMat);
      scene.add(bSphere);
      barrierSpheres.push(bSphere);

      const tMat = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      });
      const tMesh = new THREE.Mesh(targetGeo, tMat);
      scene.add(tMesh);
      targetMarkers.push(tMesh);

      const maxTrailPts = 100;
      const trailPositions = new Float32Array(maxTrailPts * 3);
      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      const trailMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
      });
      const trailLine = new THREE.Line(trailGeo, trailMat);
      scene.add(trailLine);
      trailLines.push({ line: trailLine, geo: trailGeo, positions: trailPositions });
    }

    // Item 3: 5,000-Node GPU InstancedMesh for WebGPU Compute Swarm
    const maxGpuNodes = engine.massiveSwarmCount;
    const instGeo = new THREE.OctahedronGeometry(0.45, 0);
    const instMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
    });
    const instancedSwarmMesh = new THREE.InstancedMesh(
      instGeo,
      instMat,
      maxGpuNodes
    );
    instancedSwarmMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedSwarmMesh.visible = false;
    scene.add(instancedSwarmMesh);
    const dummyMatrix = new THREE.Matrix4();

    const islGeo = new THREE.BufferGeometry();
    const islPositions = new Float32Array(engine.nodeCount * engine.nodeCount * 6);
    islGeo.setAttribute('position', new THREE.BufferAttribute(islPositions, 3));
    const islMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.25,
    });
    const islLines = new THREE.LineSegments(islGeo, islMat);
    scene.add(islLines);

    const cbfGeo = new THREE.BufferGeometry();
    const cbfPositions = new Float32Array(engine.nodeCount * engine.nodeCount * 6);
    cbfGeo.setAttribute('position', new THREE.BufferAttribute(cbfPositions, 3));
    const cbfMat = new THREE.LineBasicMaterial({
      color: 0xf43f5e,
      linewidth: 2,
    });
    const cbfLines = new THREE.LineSegments(cbfGeo, cbfMat);
    scene.add(cbfLines);

    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { radius: 135, theta: 0.65, phi: 1.05 };

    const updateCameraPosition = () => {
      camera.position.x =
        spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z =
        spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.lookAt(0, 0, 0);
    };
    updateCameraPosition();

    const onPointerDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };
      spherical.theta += dx * 0.006;
      spherical.phi = Math.max(
        0.15,
        Math.min(Math.PI - 0.15, spherical.phi - dy * 0.006)
      );
      updateCameraPosition();
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    const onWheel = (e) => {
      e.preventDefault();
      spherical.radius = Math.max(
        45,
        Math.min(280, spherical.radius + e.deltaY * 0.08)
      );
      updateCameraPosition();
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const eng = engineRef.current;
      originMesh.rotation.y += 0.015;
      originMesh.rotation.x += 0.01;

      const formation = FORMATIONS[eng.formationKey];

      for (let i = 0; i < eng.nodeCount; i++) {
        const node = eng.nodes[i];
        const mesh = nodeMeshes[i];
        const bSphere = barrierSpheres[i];
        const tMesh = targetMarkers[i];

        mesh.position.set(node.pos.x, node.pos.y, node.pos.z);
        mesh.rotation.y += 0.02;

        if (eng.byzantineNodeId === node.id) {
          mesh.material.color.setHex(0xa855f7);
          mesh.material.emissive.setHex(0x581c87);
        } else if (node.cbfActive) {
          mesh.material.color.setHex(0xf43f5e);
          mesh.material.emissive.setHex(0x881337);
        } else if (node.raftState === 'LEADER') {
          mesh.material.color.setHex(0xfacc15);
          mesh.material.emissive.setHex(0x713f12);
        } else {
          mesh.material.color.setHex(
            node.partitionGroup === 'ALPHA' ? 0x00f5d4 : 0x38bdf8
          );
          mesh.material.emissive.setHex(0x0f172a);
        }

        bSphere.position.copy(mesh.position);
        const halfSafe = eng.safetyRadius * 0.5;
        bSphere.scale.set(halfSafe, halfSafe, halfSafe);
        if (node.cbfActive) {
          bSphere.material.color.setHex(0xf43f5e);
          bSphere.material.opacity = 0.35;
        } else {
          bSphere.material.color.setHex(0x10b981);
          bSphere.material.opacity = eng.cbfEnabled ? 0.1 : 0.02;
        }

        const target = formation.getSlot(node.slotAssignment, eng.nodeCount);
        tMesh.position.set(target.x, target.y, target.z);
        tMesh.lookAt(camera.position);

        const trailObj = trailLines[i];
        const trailLen = node.trail.length;
        for (let k = 0; k < trailLen; k++) {
          const pt = node.trail[k];
          trailObj.positions[k * 3] = pt.x;
          trailObj.positions[k * 3 + 1] = pt.y;
          trailObj.positions[k * 3 + 2] = pt.z;
        }
        trailObj.geo.setDrawRange(0, trailLen);
        trailObj.geo.attributes.position.needsUpdate = true;
      }

      // Update 5,000-Node GPU Compute Swarm InstancedMesh
      if (eng.massiveSwarmEnabled && eng.gpuSwarm) {
        instancedSwarmMesh.visible = true;
        const gpuPos = eng.gpuSwarm.positions;
        for (let i = 0; i < maxGpuNodes; i++) {
          const idx = i * 4;
          dummyMatrix.makeTranslation(
            gpuPos[idx],
            gpuPos[idx + 1],
            gpuPos[idx + 2]
          );
          instancedSwarmMesh.setMatrixAt(i, dummyMatrix);
        }
        instancedSwarmMesh.instanceMatrix.needsUpdate = true;
      } else {
        instancedSwarmMesh.visible = false;
      }

      let islIdx = 0;
      for (let i = 0; i < eng.nodeCount; i++) {
        for (let j = i + 1; j < eng.nodeCount; j++) {
          const n1 = eng.nodes[i];
          const n2 = eng.nodes[j];
          const blocked =
            eng.partitionActive && n1.partitionGroup !== n2.partitionGroup;
          if (!blocked) {
            islPositions[islIdx++] = n1.pos.x;
            islPositions[islIdx++] = n1.pos.y;
            islPositions[islIdx++] = n1.pos.z;
            islPositions[islIdx++] = n2.pos.x;
            islPositions[islIdx++] = n2.pos.y;
            islPositions[islIdx++] = n2.pos.z;
          }
        }
      }
      islGeo.setDrawRange(0, islIdx / 3);
      islGeo.attributes.position.needsUpdate = true;

      let cbfIdx = 0;
      for (const vec of eng.activeCbfVectors) {
        cbfPositions[cbfIdx++] = vec.p1.x;
        cbfPositions[cbfIdx++] = vec.p1.y;
        cbfPositions[cbfIdx++] = vec.p1.z;
        cbfPositions[cbfIdx++] = vec.p2.x;
        cbfPositions[cbfIdx++] = vec.p2.y;
        cbfPositions[cbfIdx++] = vec.p2.z;
      }
      cbfGeo.setDrawRange(0, cbfIdx / 3);
      cbfGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('wheel', onWheel);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [engineRef]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: 'grab',
      }}
    />
  );
}
