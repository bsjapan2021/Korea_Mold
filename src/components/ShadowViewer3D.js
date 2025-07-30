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
  panelTilt = 30, 
  panelAzimuth = 180,
  currentTime = 12,
  shadowLoss = 0
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

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene 설정
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 하늘색
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
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 조명 설정
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    const sunAngle = (currentTime - 12) * 15 * Math.PI / 180; // 태양 각도
    sunLight.position.set(
      Math.sin(sunAngle) * 100,
      Math.cos(sunAngle) * 50 + 30,
      0
    );
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // 환경광
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    // 지면 생성
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 그림자를 만드는 높은 건물 생성 (실제 크기)
    const buildingGeometry = new THREE.BoxGeometry(
      buildingWidth || 20, 
      buildingHeight, 
      buildingDepth || 30
    );
    const buildingMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(-buildingDistance, buildingHeight / 2, 0);
    building.castShadow = true;
    scene.add(building);

    // 태양광 패널이 설치된 건물 생성 (실제 크기)
    const solarBuildingGeometry = new THREE.BoxGeometry(
      solarBuildingWidth || 50,
      solarBuildingHeight || 10,
      solarBuildingDepth || 30
    );
    const solarBuildingMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x4682B4,
      transparent: true,
      opacity: 0.7
    });
    const solarBuilding = new THREE.Mesh(solarBuildingGeometry, solarBuildingMaterial);
    solarBuilding.position.set(25, (solarBuildingHeight || 10) / 2, 0);
    solarBuilding.castShadow = true;
    solarBuilding.receiveShadow = true;
    scene.add(solarBuilding);

    // 태양광 패널 그룹 생성
    const panelGroup = new THREE.Group();
    const panelRows = 5;
    const panelCols = 8;
    const panelWidth = 2;
    const panelHeight = 1;
    const panelSpacing = 0.2;

    for (let row = 0; row < panelRows; row++) {
      for (let col = 0; col < panelCols; col++) {
        const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);
        
        // 히트맵 모드에서는 차폐율에 따라 색상 변경
        let panelColor = 0x1E3A8A; // 기본 파란색 (태양광 패널)
        if (viewMode === 'heatmap') {
          // 거리와 각도에 따른 차폐율 계산 (간단화)
          const panelX = col * (panelWidth + panelSpacing) - (panelCols * (panelWidth + panelSpacing)) / 2;
          const panelZ = row * (panelHeight + panelSpacing) - (panelRows * (panelHeight + panelSpacing)) / 2;
          const distanceFromBuilding = Math.sqrt(
            Math.pow(panelX + buildingDistance, 2) + Math.pow(panelZ, 2)
          );
          
          // 차폐율 계산 (거리와 건물 높이 고려)
          const shadowRatio = Math.max(0, Math.min(1, 
            (buildingHeight * 2) / (distanceFromBuilding + 10) - 0.2
          ));
          
          // 차폐율에 따른 색상 (빨간색 = 높은 차폐, 녹색 = 낮은 차폐)
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
          row * (panelHeight + panelSpacing) - (panelRows * (panelHeight + panelSpacing)) / 2
        );
        
        // 패널 기울기 적용
        panel.rotation.x = -panelTilt * Math.PI / 180;
        panel.rotation.y = panelAzimuth * Math.PI / 180;
        panel.receiveShadow = true;
        
        panelGroup.add(panel);
      }
    }
    
    // 패널 그룹을 태양광 설치 건물 위에 배치
    panelGroup.position.set(25, solarBuildingHeight + 0.5, 0); // 건물 위 0.5m
    scene.add(panelGroup);

    // 태양 표시 (더 크게)
    const sunGeometry = new THREE.SphereGeometry(8, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.copy(sunLight.position);
    sun.position.multiplyScalar(0.3); // 크기 조정
    scene.add(sun);
    sunRef.current = sun;

    // 그림자 가시화 (선택적)
    if (viewMode === 'overview') {
      const shadowHelper = new THREE.DirectionalLightHelper(sunLight, 5);
      scene.add(shadowHelper);
    }

    // Controls (마우스로 회전/줌)
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
      
      cameraTheta += deltaX * 0.01;
      cameraPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraPhi + deltaY * 0.01));
      
      mouseX = event.clientX;
      mouseY = event.clientY;
      
      updateCameraPosition();
    };

    const onWheel = (event) => {
      cameraRadius += event.deltaY * 0.1;
      cameraRadius = Math.max(20, Math.min(150, cameraRadius));
      updateCameraPosition();
    };

    const updateCameraPosition = () => {
      camera.position.x = cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
      camera.position.y = cameraRadius * Math.cos(cameraPhi);
      camera.position.z = cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
      camera.lookAt(0, 5, 0);
    };

    const currentMount = mountRef.current;
    currentMount.addEventListener('mousedown', onMouseDown);
    currentMount.addEventListener('mouseup', onMouseUp);
    currentMount.addEventListener('mousemove', onMouseMove);
    currentMount.addEventListener('wheel', onWheel);

    // 렌더링 루프
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    currentMount.appendChild(renderer.domElement);
    animate();
    setIsLoaded(true);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      if (currentMount) {
        currentMount.removeEventListener('mousedown', onMouseDown);
        currentMount.removeEventListener('mouseup', onMouseUp);
        currentMount.removeEventListener('mousemove', onMouseMove);
        currentMount.removeEventListener('wheel', onWheel);
      }
      renderer.dispose();
    };
  }, [buildingHeight, buildingWidth, buildingDepth, solarBuildingHeight, solarBuildingWidth, solarBuildingDepth, buildingDistance, panelTilt, panelAzimuth, currentTime, viewMode]);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  const startAnimation = useCallback(() => {
    if (!isAnimating) {
      setIsAnimating(true);
      let currentTime = 6;
      
      const animate = () => {
        setAnimationTime(prevTime => {
          currentTime = prevTime + 0.1;
          if (currentTime > 18) {
            setIsAnimating(false);
            return 6;
          }
          
          if (sunLightRef.current && sunRef.current) {
            const sunAngle = (currentTime - 12) * 15 * Math.PI / 180;
            const newPosition = new THREE.Vector3(
              Math.sin(sunAngle) * 100,
              Math.cos(sunAngle) * 50 + 30,
              0
            );
            
            sunLightRef.current.position.copy(newPosition);
            sunRef.current.position.copy(newPosition);
            sunRef.current.position.multiplyScalar(0.3);
          }
          
          return currentTime;
        });
        
        if (currentTime <= 18) {
          setTimeout(animate, 100);
        }
      };
      
      animate();
    }
  }, [isAnimating]);

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
          ⏰ 시간별 애니메이션
        </button>
        
        {/* 애니메이션 컨트롤 */}
        {viewMode === 'animation' && (
          <div className="flex items-center gap-2 ml-4">
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
            {isAnimating && (
              <span className="text-white text-sm">
                시간: {animationTime.toFixed(1)}시
              </span>
            )}
          </div>
        )}
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
              <div className="w-4 h-3 bg-yellow-500 mr-2"></div>
              <span>보통 (30-70%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-3 bg-green-500 mr-2"></div>
              <span>낮음 (0-30%)</span>
            </div>
          </div>
        )}

        {/* 현재 설정 표시 */}
        <div className="absolute top-4 left-4 bg-black/70 text-white text-xs p-3 rounded max-w-xs">
          <p className="font-semibold mb-2">🏢 건물 정보</p>
          <div className="mb-2">
            <p className="text-orange-300 font-medium">그림자 건물:</p>
            <p>• 크기: {buildingWidth}×{buildingDepth}×{buildingHeight}m</p>
            <p>• 거리: {buildingDistance}m</p>
          </div>
          <div className="mb-2">
            <p className="text-blue-300 font-medium">태양광 건물:</p>
            <p>• 크기: {solarBuildingWidth}×{solarBuildingDepth}×{solarBuildingHeight}m</p>
          </div>
          <div>
            <p className="text-yellow-300 font-medium">시뮬레이션:</p>
            <p>• 현재 시간: {currentTime}시</p>
            <p>• 패널 각도: {panelTilt}°</p>
            <p>• 예상 손실률: {shadowLoss.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShadowViewer3D;
