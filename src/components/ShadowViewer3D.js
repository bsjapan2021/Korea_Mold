import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

const ShadowViewer3D = ({ 
  buildingHeight = 20, 
  buildingWidth = 20,
  buildingDepth = 30,
  solarBuildingHeight = 10,
  solarBuildingWidth = 50,
  solarBuildingDepth = 30,
  buildingDistance = 30,
  buildingLayout = [], // 건물 배치 정보 배열
  panelTilt = 30, 
  panelAzimuth = 180,
  panelRows = 15,    // 패널 행 수
  panelCols = 10,    // 패널 열 수  
  panelWidth = 2,    // 패널 폭
  panelDepth = 1,    // 패널 깊이
  currentTime = 12,
  shadowLoss = 0,
  latitude = 37.5,   // 위도 정보
  month = 12,        // 월 정보
  calculateSolarElevation = null, // 태양 고도각 계산 함수
  calculateSolarAzimuth = null    // 태양 방위각 계산 함수
}) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationRef = useRef(null);
  const sunRef = useRef(null);
  const sunLightRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState('overview'); // overview, heatmap, animation
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationTime, setAnimationTime] = useState(6); // 6시부터 시작
  const [isLooping, setIsLooping] = useState(false); // 반복 애니메이션 옵션
  const [animationSpeed, setAnimationSpeed] = useState(1); // 애니메이션 속도 (1 = 기본)
  const [realisticMode, setRealisticMode] = useState(true); // 실사 모드 토글

  // 실제 태양 위치 계산 함수 (SolarShadowCalculator와 동일한 로직)
  const calculateActualSunPosition = useCallback((time) => {
    if (!calculateSolarElevation || !calculateSolarAzimuth) {
      // 계산 함수가 없을 경우 기본 간단한 계산 사용
      const sunAngle = (time - 12) * 15 * Math.PI / 180;
      const solarBuildingX = 25;
      return {
        x: solarBuildingX + Math.sin(sunAngle) * 150,
        y: Math.cos(sunAngle) * 80 + 60,
        z: 0,
        elevation: Math.cos(sunAngle) * 60 + 30, // 간단한 고도각 계산
        azimuth: ((time - 6) / 12) * 180 + 90   // 간단한 방위각 계산
      };
    }

    // 실제 태양 계산 함수 사용
    const elevation = calculateSolarElevation(latitude, month, time);
    const azimuth = calculateSolarAzimuth(latitude, month, time);
    
    // 고도각과 방위각을 3D 좌표로 변환
    const elevationRad = elevation * Math.PI / 180;
    const azimuthRad = azimuth * Math.PI / 180;
    
    // 태양광 건물을 기준으로 한 위치 계산
    const solarBuildingX = 25;
    const solarBuildingZ = 0;
    const distance = 150; // 태양까지의 기본 거리
    
    // 방위각: 남쪽(0°)을 기준으로 동쪽이 음수, 서쪽이 양수
    // Three.js 좌표계에서 X축(동서), Z축(남북) 변환
    const sunX = solarBuildingX + Math.sin(azimuthRad) * distance * Math.cos(elevationRad);
    const sunY = Math.sin(elevationRad) * distance + 20; // 최소 높이 보장
    const sunZ = solarBuildingZ - Math.cos(azimuthRad) * distance * Math.cos(elevationRad);
    
    return {
      x: sunX,
      y: Math.max(sunY, 20), // 지평선 아래로 내려가지 않도록
      z: sunZ,
      elevation: elevation,
      azimuth: azimuth
    };
  }, [calculateSolarElevation, calculateSolarAzimuth, latitude, month]);

  // 텍스처 생성 함수들
  const createGrassTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // 베이스 잔디색
    ctx.fillStyle = '#4a7c3b';
    ctx.fillRect(0, 0, 256, 256);
    
    // 잔디 디테일 추가
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const shade = Math.random() * 0.3;
      ctx.fillStyle = `rgb(${Math.floor(74 * (1 + shade))}, ${Math.floor(124 * (1 + shade))}, ${Math.floor(59 * (1 + shade))})`;
      ctx.fillRect(x, y, 2, 2);
    }
    
    return new THREE.CanvasTexture(canvas);
  };

  const createBrickTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // 베이스 벽돌색
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(0, 0, 256, 256);
    
    // 벽돌 패턴
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 64) {
        const offsetX = (y / 32) % 2 === 0 ? 0 : 32;
        ctx.strokeRect(x + offsetX, y, 64, 32);
      }
    }
    
    return new THREE.CanvasTexture(canvas);
  };

  const createWindowTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // 유리창 베이스
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 256, 256);
    
    // 창틀
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 236, 236);
    ctx.strokeRect(10, 123, 236, 10);
    ctx.strokeRect(123, 10, 10, 236);
    
    // 반사 효과
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, 'rgba(135, 206, 235, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    return new THREE.CanvasTexture(canvas);
  };

  const createPanelTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // 어두운 파란색 베이스
    ctx.fillStyle = '#1a2b5c';
    ctx.fillRect(0, 0, 256, 256);
    
    // 태양광 셀 패턴
    const cellSize = 32;
    for (let y = 0; y < 256; y += cellSize) {
      for (let x = 0; x < 256; x += cellSize) {
        ctx.fillStyle = '#0f1f4a';
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        
        // 셀 내부 라인
        ctx.strokeStyle = '#0a1535';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 6, y + 6, cellSize - 12, cellSize - 12);
      }
    }
    
    return new THREE.CanvasTexture(canvas);
  };

  const createTree = () => {
    const treeGroup = new THREE.Group();
    
    // 나무 줄기
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.8, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513,
      roughness: 0.9,
      metalness: 0.1
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 4;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);
    
    // 나무 잎
    const leavesGeometry = new THREE.SphereGeometry(4, 8, 6);
    const leavesMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x228B22,
      roughness: 0.8,
      metalness: 0.1
    });
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.y = 10;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    treeGroup.add(leaves);
    
    return treeGroup;
  };

  const createCloud = () => {
    const cloudGroup = new THREE.Group();
    
    // 구름은 여러 개의 구체로 구성
    for (let i = 0; i < 5; i++) {
      const cloudGeometry = new THREE.SphereGeometry(
        3 + Math.random() * 2, 
        8, 
        6
      );
      const cloudMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.8,
        roughness: 1.0,
        metalness: 0.0
      });
      const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
      cloudPart.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 8
      );
      cloudGroup.add(cloudPart);
    }
    
    return cloudGroup;
  };

  const addEnvironmentElements = useCallback((scene) => {
    if (!realisticMode) return;

    // 나무들 추가
    for (let i = 0; i < 8; i++) {
      const tree = createTree();
      const angle = (i / 8) * Math.PI * 2;
      const distance = 80 + Math.random() * 20;
      tree.position.set(
        Math.cos(angle) * distance,
        0,
        Math.sin(angle) * distance
      );
      tree.scale.setScalar(0.8 + Math.random() * 0.4);
      scene.add(tree);
    }
    
    // 도로/보도 추가
    const roadGeometry = new THREE.PlaneGeometry(200, 8);
    const roadMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.9,
      metalness: 0.1
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.position.z = -60;
    road.receiveShadow = true;
    scene.add(road);
    
    // 주차장 라인
    for (let i = 0; i < 10; i++) {
      const lineGeometry = new THREE.PlaneGeometry(2, 0.2);
      const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(i * 5 - 22.5, 0.02, -45);
      scene.add(line);
    }
    
    // 구름들 추가
    for (let i = 0; i < 5; i++) {
      const cloud = createCloud();
      cloud.position.set(
        (Math.random() - 0.5) * 400,
        50 + Math.random() * 30,
        (Math.random() - 0.5) * 400
      );
      cloud.scale.setScalar(2 + Math.random() * 3);
      scene.add(cloud);
    }
  }, [realisticMode]);

  useEffect(() => {
    if (!mountRef.current) return;

    // 기존 장면 정리
    if (sceneRef.current) {
      sceneRef.current.clear();
    }

    // Scene 설정
    const scene = new THREE.Scene();
    
    if (realisticMode) {
      // 하늘 그라데이션 배경 생성
      const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
      const skyMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vPosition;
          void main() {
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vPosition;
          void main() {
            float h = normalize(vPosition).y;
            vec3 skyColor = mix(vec3(0.5, 0.7, 1.0), vec3(0.8, 0.9, 1.0), h * 0.5 + 0.5);
            gl_FragColor = vec4(skyColor, 1.0);
          }
        `,
        side: THREE.BackSide
      });
      const sky = new THREE.Mesh(skyGeometry, skyMaterial);
      scene.add(sky);
    } else {
      scene.background = new THREE.Color(0x87CEEB);
    }
    
    sceneRef.current = scene;

    // Camera 설정
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(50, 40, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer 설정
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    if (realisticMode) {
      renderer.physicallyCorrectLights = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
    }
    
    rendererRef.current = renderer;

    // 향상된 조명 설정
    const sunLight = new THREE.DirectionalLight(0xffffff, realisticMode ? 3 : 1);
    
    // 실제 태양 위치 계산 사용
    const sunPosition = calculateActualSunPosition(currentTime);
    
    sunLight.position.set(sunPosition.x, sunPosition.y, sunPosition.z);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = realisticMode ? 4096 : 2048;
    sunLight.shadow.mapSize.height = realisticMode ? 4096 : 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    if (realisticMode) {
      sunLight.shadow.bias = -0.0001;
    }
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // 환경광
    const ambientLight = new THREE.AmbientLight(0x87CEEB, realisticMode ? 0.3 : 0.4);
    scene.add(ambientLight);

    if (realisticMode) {
      // 하늘 반사광
      const skyLight = new THREE.HemisphereLight(0x87CEEB, 0x654321, 0.5);
      scene.add(skyLight);
    }

    // 지면 생성
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    let groundMaterial;
    
    if (realisticMode) {
      const grassTexture = createGrassTexture();
      grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
      grassTexture.repeat.set(20, 20);
      
      groundMaterial = new THREE.MeshStandardMaterial({ 
        map: grassTexture,
        roughness: 0.8,
        metalness: 0.1
      });
    } else {
      groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
    }
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 건물들 생성
    if (buildingLayout.length > 0) {
      buildingLayout.forEach((buildingInfo, index) => {
        const buildingGroup = new THREE.Group();
        
        // 건물 본체
        const buildingGeometry = new THREE.BoxGeometry(
          buildingWidth || 20, 
          buildingHeight, 
          buildingDepth || 30
        );
        
        let buildingMaterial;
        if (realisticMode) {
          const brickTexture = createBrickTexture();
          brickTexture.wrapS = brickTexture.wrapT = THREE.RepeatWrapping;
          brickTexture.repeat.set(2, buildingHeight / 10);
          
          buildingMaterial = new THREE.MeshStandardMaterial({ 
            map: brickTexture,
            roughness: 0.8,
            metalness: 0.1,
            normalScale: new THREE.Vector2(0.5, 0.5)
          });
        } else {
          buildingMaterial = new THREE.MeshLambertMaterial({ 
            color: index === 0 ? 0x8B4513 : 0x654321
          });
        }
        
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = buildingHeight / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        buildingGroup.add(building);
        
        if (realisticMode) {
          // 지붕 추가
          const roofGeometry = new THREE.ConeGeometry(
            Math.max(buildingWidth, buildingDepth) * 0.6, 
            buildingHeight * 0.15, 
            4
          );
          const roofMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.7,
            metalness: 0.2
          });
          const roof = new THREE.Mesh(roofGeometry, roofMaterial);
          roof.position.y = buildingHeight + (buildingHeight * 0.075);
          roof.rotation.y = Math.PI / 4;
          roof.castShadow = true;
          buildingGroup.add(roof);
          
          // 창문들 추가
          const windowTexture = createWindowTexture();
          const windowMaterial = new THREE.MeshStandardMaterial({ 
            map: windowTexture,
            transparent: true,
            opacity: 0.9,
            roughness: 0.1,
            metalness: 0.8
          });
          
          // 앞면 창문들
          for (let floor = 1; floor < Math.floor(buildingHeight / 4); floor++) {
            for (let i = 0; i < 3; i++) {
              const windowGeometry = new THREE.PlaneGeometry(3, 2.5);
              const window = new THREE.Mesh(windowGeometry, windowMaterial);
              window.position.set(
                (i - 1) * 6, 
                floor * 4, 
                (buildingDepth || 30) / 2 + 0.1
              );
              buildingGroup.add(window);
            }
          }
        }
        
        // 건물 위치 설정
        const distance = buildingDistance;
        const x = buildingInfo.x || distance * Math.sin(buildingInfo.orientation * Math.PI / 180);
        const z = buildingInfo.z || -distance * Math.cos(buildingInfo.orientation * Math.PI / 180);
        
        buildingGroup.position.set(x, 0, z);
        scene.add(buildingGroup);
      });
    } else {
      // 기본 단일 건물
      const buildingGroup = new THREE.Group();
      
      const buildingGeometry = new THREE.BoxGeometry(
        buildingWidth || 20, 
        buildingHeight, 
        buildingDepth || 30
      );
      
      let buildingMaterial;
      if (realisticMode) {
        const brickTexture = createBrickTexture();
        brickTexture.wrapS = brickTexture.wrapT = THREE.RepeatWrapping;
        brickTexture.repeat.set(2, buildingHeight / 10);
        
        buildingMaterial = new THREE.MeshStandardMaterial({ 
          map: brickTexture,
          roughness: 0.8,
          metalness: 0.1
        });
      } else {
        buildingMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
      }
      
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.set(0, buildingHeight / 2, 0);
      building.castShadow = true;
      building.receiveShadow = true;
      buildingGroup.add(building);
      
      buildingGroup.position.set(-buildingDistance, 0, 0);
      scene.add(buildingGroup);
    }

    // 태양광 패널이 설치된 건물
    const solarBuildingGroup = new THREE.Group();
    
    const solarBuildingGeometry = new THREE.BoxGeometry(
      solarBuildingWidth || 50,
      solarBuildingHeight || 10,
      solarBuildingDepth || 30
    );
    
    let solarBuildingMaterial;
    if (realisticMode) {
      solarBuildingMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xf0f0f0,
        roughness: 0.3,
        metalness: 0.6,
        transparent: true,
        opacity: 0.9
      });
    } else {
      solarBuildingMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x4682B4,
        transparent: true,
        opacity: 0.7
      });
    }
    
    const solarBuilding = new THREE.Mesh(solarBuildingGeometry, solarBuildingMaterial);
    solarBuilding.position.set(0, (solarBuildingHeight || 10) / 2, 0);
    solarBuilding.castShadow = true;
    solarBuilding.receiveShadow = true;
    solarBuildingGroup.add(solarBuilding);
    
    if (realisticMode) {
      // 건물 가장자리 강조
      const edgeGeometry = new THREE.EdgesGeometry(solarBuildingGeometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 });
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.position.copy(solarBuilding.position);
      solarBuildingGroup.add(edges);
      
      // 현대적 유리창들 추가
      const glassTexture = createWindowTexture();
      const glassMaterial = new THREE.MeshStandardMaterial({
        map: glassTexture,
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
        metalness: 0.9
      });
      
      // 정면 유리창
      const frontGlassGeometry = new THREE.PlaneGeometry(
        (solarBuildingWidth || 50) * 0.8,
        (solarBuildingHeight || 10) * 0.6
      );
      const frontGlass = new THREE.Mesh(frontGlassGeometry, glassMaterial);
      frontGlass.position.set(0, (solarBuildingHeight || 10) / 2, (solarBuildingDepth || 30) / 2 + 0.1);
      solarBuildingGroup.add(frontGlass);
    }
    
    solarBuildingGroup.position.set(25, 0, 0);
    scene.add(solarBuildingGroup);

    // 태양광 패널 그룹 생성
    const panelGroup = new THREE.Group();
    const panelThickness = realisticMode ? 0.05 : 0.01;
    const panelSpacing = 0.2;

    for (let row = 0; row < panelRows; row++) {
      for (let col = 0; col < panelCols; col++) {
        if (realisticMode) {
          // 고품질 3D 패널
          const singlePanelGroup = new THREE.Group();
          
          // 패널 프레임
          const frameGeometry = new THREE.BoxGeometry(
            panelWidth + 0.1, 
            panelThickness * 2, 
            panelDepth + 0.1
          );
          const frameMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x888888,
            roughness: 0.3,
            metalness: 0.8
          });
          const frame = new THREE.Mesh(frameGeometry, frameMaterial);
          frame.castShadow = true;
          frame.receiveShadow = true;
          singlePanelGroup.add(frame);
          
          // 패널 표면
          const panelGeometry = new THREE.BoxGeometry(
            panelWidth, 
            panelThickness, 
            panelDepth
          );
          
          let panelMaterial;
          if (viewMode === 'heatmap') {
            const panelX = col * (panelWidth + panelSpacing) - (panelCols * (panelWidth + panelSpacing)) / 2;
            const panelZ = row * (panelDepth + panelSpacing) - (panelRows * (panelDepth + panelSpacing)) / 2;
            const distanceFromBuilding = Math.sqrt(
              Math.pow(panelX + buildingDistance, 2) + Math.pow(panelZ, 2)
            );
            
            const shadowRatio = Math.max(0, Math.min(1, 
              (buildingHeight * 2) / (distanceFromBuilding + 10) - 0.2
            ));
            
            const red = Math.floor(shadowRatio * 255);
            const green = Math.floor((1 - shadowRatio) * 255);
            const heatColor = (red << 16) | (green << 8) | 0;
            
            panelMaterial = new THREE.MeshStandardMaterial({ 
              color: heatColor,
              roughness: 0.2,
              metalness: 0.1,
              transparent: true,
              opacity: 0.9
            });
          } else {
            const solarPanelTexture = createPanelTexture();
            panelMaterial = new THREE.MeshStandardMaterial({ 
              map: solarPanelTexture,
              roughness: 0.1,
              metalness: 0.3,
              transparent: true,
              opacity: 0.95
            });
          }
          
          const panel = new THREE.Mesh(panelGeometry, panelMaterial);
          panel.position.y = panelThickness;
          panel.castShadow = true;
          panel.receiveShadow = true;
          singlePanelGroup.add(panel);
          
          // 패널 유리 반사층
          const glassGeometry = new THREE.PlaneGeometry(panelWidth * 0.95, panelDepth * 0.95);
          const glassPanelMaterial = new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0.1,
            roughness: 0.0,
            metalness: 0.9,
            color: 0x87CEEB
          });
          const glass = new THREE.Mesh(glassGeometry, glassPanelMaterial);
          glass.position.y = panelThickness * 2.1;
          glass.rotation.x = -Math.PI / 2;
          singlePanelGroup.add(glass);
          
          // 패널 위치 설정
          singlePanelGroup.position.set(
            col * (panelWidth + panelSpacing) - (panelCols * (panelWidth + panelSpacing)) / 2,
            0,
            row * (panelDepth + panelSpacing) - (panelRows * (panelDepth + panelSpacing)) / 2
          );
          
          // 패널 기울기 적용
          singlePanelGroup.rotation.x = -panelTilt * Math.PI / 180;
          singlePanelGroup.rotation.y = (panelAzimuth - 180) * Math.PI / 180;
          
          panelGroup.add(singlePanelGroup);
        } else {
          // 간단한 2D 패널 (기존 방식)
          const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelDepth);
          
          let panelColor = 0x1E3A8A;
          if (viewMode === 'heatmap') {
            const panelX = col * (panelWidth + panelSpacing) - (panelCols * (panelWidth + panelSpacing)) / 2;
            const panelZ = row * (panelDepth + panelSpacing) - (panelRows * (panelDepth + panelSpacing)) / 2;
            const distanceFromBuilding = Math.sqrt(
              Math.pow(panelX + buildingDistance, 2) + Math.pow(panelZ, 2)
            );
            
            const shadowRatio = Math.max(0, Math.min(1, 
              (buildingHeight * 2) / (distanceFromBuilding + 10) - 0.2
            ));
            
            const red = Math.floor(shadowRatio * 255);
            const green = Math.floor((1 - shadowRatio) * 255);
            panelColor = (red << 16) | (green << 8) | 0;
          }
          
          const panelMaterial = new THREE.MeshLambertMaterial({ 
            color: panelColor,
            side: THREE.DoubleSide 
          });
          const panel = new THREE.Mesh(panelGeometry, panelMaterial);
          
          panel.position.set(
            col * (panelWidth + panelSpacing) - (panelCols * (panelWidth + panelSpacing)) / 2,
            0.1,
            row * (panelDepth + panelSpacing) - (panelRows * (panelDepth + panelSpacing)) / 2
          );
          
          panel.rotation.x = -panelTilt * Math.PI / 180;
          panel.rotation.y = panelAzimuth * Math.PI / 180;
          panel.receiveShadow = true;
          
          panelGroup.add(panel);
        }
      }
    }
    
    if (realisticMode) {
      // 패널 지지대 추가
      const supportMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x666666,
        roughness: 0.4,
        metalness: 0.8
      });
      
      // 메인 지지대들
      for (let i = 0; i <= panelCols; i += Math.ceil(panelCols / 4)) {
        const supportGeometry = new THREE.CylinderGeometry(0.05, 0.1, 1.5);
        const support = new THREE.Mesh(supportGeometry, supportMaterial);
        support.position.set(
          i * (panelWidth + panelSpacing) - (panelCols * (panelWidth + panelSpacing)) / 2,
          -0.75,
          0
        );
        support.castShadow = true;
        panelGroup.add(support);
      }
    }
    
    panelGroup.position.set(25, solarBuildingHeight + 0.5, 0);
    scene.add(panelGroup);

    // 환경 장식 요소들 추가
    addEnvironmentElements(scene);
    
    // 태양 표시
    const sunGroup = new THREE.Group();
    
    const sunGeometry = new THREE.SphereGeometry(8, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xFFFF00,
      transparent: true,
      opacity: realisticMode ? 0.9 : 1.0
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sunGroup.add(sun);
    
    if (realisticMode) {
      // 태양 광선 효과
      const raysGeometry = new THREE.RingGeometry(10, 15, 16);
      const raysMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFDD44,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      const rays = new THREE.Mesh(raysGeometry, raysMaterial);
      rays.lookAt(camera.position);
      sunGroup.add(rays);
    }
    
    sunGroup.position.copy(sunLight.position);
    sunGroup.position.multiplyScalar(0.3);
    scene.add(sunGroup);
    sunRef.current = sunGroup;

    // 그림자 가시화 (선택적)
    if (viewMode === 'overview') {
      const shadowHelper = new THREE.DirectionalLightHelper(sunLight, 5);
      scene.add(shadowHelper);
    }

    // 마우스 컨트롤
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let cameraRadius = 70;
    let cameraTheta = 0;
    let cameraPhi = Math.PI / 4;

    const onMouseDown = (event) => {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseUp = () => {
      mouseDown = false;
    };

    const onMouseMove = (event) => {
      if (!mouseDown) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      cameraTheta -= deltaX * 0.01;
      cameraPhi += deltaY * 0.01;
      cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi));

      const x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
      const y = cameraRadius * Math.cos(cameraPhi);
      const z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);

      camera.position.set(x, y, z);
      camera.lookAt(0, 0, 0);

      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onWheel = (event) => {
      cameraRadius += event.deltaY * 0.05;
      cameraRadius = Math.max(20, Math.min(150, cameraRadius));

      const x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
      const y = cameraRadius * Math.cos(cameraPhi);
      const z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);

      camera.position.set(x, y, z);
      camera.lookAt(0, 0, 0);
    };

    // 이벤트 리스너 추가
    mountRef.current.addEventListener('mousedown', onMouseDown);
    mountRef.current.addEventListener('mouseup', onMouseUp);
    mountRef.current.addEventListener('mousemove', onMouseMove);
    mountRef.current.addEventListener('wheel', onWheel);

    // 렌더링 루프
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    // DOM에 추가
    const mountElement = mountRef.current;
    mountElement.appendChild(renderer.domElement);
    animate();
    setIsLoaded(true);

    // 정리 함수
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mountElement && renderer.domElement && mountElement.contains(renderer.domElement)) {
        mountElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [buildingHeight, buildingWidth, buildingDepth, solarBuildingHeight, solarBuildingWidth, solarBuildingDepth, buildingDistance, buildingLayout, panelTilt, panelAzimuth, panelRows, panelCols, panelWidth, panelDepth, currentTime, viewMode, realisticMode, addEnvironmentElements, calculateActualSunPosition]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const startAnimation = useCallback(() => {
    setIsAnimating(true);
    setAnimationTime(6);
  }, []);

  // 애니메이션 로직
  useEffect(() => {
    if (!isAnimating || !sunLightRef.current || !sunRef.current) return;
    
    let timeoutId;
    
    const animate = () => {
      setAnimationTime(prevTime => {
        let nextTime = prevTime + (0.2 * animationSpeed);
        
        if (nextTime >= 18) {
          if (isLooping) {
            nextTime = 6;
          } else {
            setIsAnimating(false);
            return prevTime;
          }
        }
        
        // 태양 위치 업데이트 - 실제 태양 계산 사용
        const sunPosition = calculateActualSunPosition(nextTime);
        
        const newSunPosition = new THREE.Vector3(sunPosition.x, sunPosition.y, sunPosition.z);
        
        sunLightRef.current.position.copy(newSunPosition);
        
        const sunDisplayPosition = newSunPosition.clone();
        sunDisplayPosition.multiplyScalar(0.3);
        sunRef.current.position.copy(sunDisplayPosition);
        
        return nextTime;
      });
      
      timeoutId = setTimeout(animate, 100);
    };
    
    timeoutId = setTimeout(animate, 100);
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isAnimating, isLooping, animationSpeed, calculateActualSunPosition]);

  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
  }, []);

  return (
    <div className="w-full">
      {/* 뷰 모드 선택 탭 */}
      <div className="flex mb-4 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => handleViewModeChange('overview')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'overview'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
        >
          🏢 전체 보기
        </button>
        <button
          onClick={() => handleViewModeChange('heatmap')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'heatmap'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
        >
          🌡️ 히트맵
        </button>
        <button
          onClick={() => handleViewModeChange('animation')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'animation'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
        >
          🎬 애니메이션
        </button>
        
        {/* 실사 모드 토글 */}
        <div className="flex items-center ml-auto">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={realisticMode}
              onChange={(e) => setRealisticMode(e.target.checked)}
              className="rounded"
            />
            🏞️ 실사 모드
          </label>
        </div>
      </div>

      {/* 애니메이션 컨트롤 */}
      {viewMode === 'animation' && (
        <div className="mb-4 bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={startAnimation}
              disabled={isAnimating}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-sm"
            >
              {isAnimating ? '▶️ 재생중' : '▶️ 시작'}
            </button>
            <button
              onClick={stopAnimation}
              disabled={!isAnimating}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded text-sm"
            >
              ⏹️ 정지
            </button>
            
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">반복:</label>
              <input
                type="checkbox"
                checked={isLooping}
                onChange={(e) => setIsLooping(e.target.checked)}
                className="rounded"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-white text-sm">속도:</label>
              <select
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                className="bg-gray-700 text-white rounded px-2 py-1 text-sm"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>
            
            {isAnimating && (
              <div className="flex items-center gap-2">
                <span className="text-white text-sm">
                  시간: {animationTime.toFixed(1)}시
                </span>
                {isLooping && (
                  <span className="text-blue-300 text-xs bg-blue-900/30 px-2 py-1 rounded">
                    무한반복
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 태양 정보 표시 */}
      <div className="absolute top-4 left-4 bg-black/70 text-white text-xs p-3 rounded">
        <p className="font-semibold mb-2">☀️ 태양 정보</p>
        {(() => {
          const currentSunInfo = calculateActualSunPosition(isAnimating ? animationTime : currentTime);
          return (
            <div>
              <p>고도각: {currentSunInfo.elevation.toFixed(1)}°</p>
              <p>방위각: {currentSunInfo.azimuth.toFixed(1)}°</p>
              <p>시간: {(isAnimating ? animationTime : currentTime).toFixed(1)}시</p>
              <p>월: {month}월, 위도: {latitude.toFixed(1)}°</p>
            </div>
          );
        })()}
      </div>

      {/* 3D 뷰어 */}
      <div className="relative">
        <div
          ref={mountRef}
          className="w-full h-96 bg-gray-900 rounded-lg overflow-hidden border border-gray-700"
          style={{ minHeight: '400px' }}
        />
        
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p>3D 모델 로딩 중...</p>
            </div>
          </div>
        )}

        {/* 컨트롤 안내 */}
        <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs p-2 rounded">
          <p>🖱️ 드래그: 회전</p>
          <p>🖱️ 휠: 줌</p>
          {realisticMode && <p>🏞️ 실사 모드: ON</p>}
        </div>

        {/* 차폐율 범례 (히트맵 모드) */}
        {viewMode === 'heatmap' && (
          <div className="absolute top-4 right-4 bg-black/70 text-white text-xs p-3 rounded">
            <p className="font-semibold mb-2">차폐율 범례</p>
            <div className="flex items-center mb-1">
              <div className="w-4 h-3 bg-red-500 mr-2"></div>
              <span>높음 (70-100%)</span>
            </div>
            <div className="flex items-center mb-1">
              <div className="w-4 h-3 bg-orange-500 mr-2"></div>
              <span>보통 (30-70%)</span>
            </div>
            <div className="flex items-center mb-1">
              <div className="w-4 h-3 bg-yellow-500 mr-2"></div>
              <span>낮음 (10-30%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-3 bg-green-500 mr-2"></div>
              <span>정상 (0-10%)</span>
            </div>
          </div>
        )}

        {/* 시간별 애니메이션 정보 */}
        {viewMode === 'animation' && isAnimating && (
          <div className="absolute top-4 left-4 bg-black/70 text-white text-sm p-3 rounded">
            <p className="font-semibold mb-1">시간별 그림자 분석</p>
            <p>현재 시간: {animationTime.toFixed(1)}시</p>
            <p>예상 손실률: {shadowLoss.toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShadowViewer3D;
