import React, { useState, useEffect } from 'react';
import { Sun, Building, Info, Compass } from 'lucide-react';

const SolarShadowCalculator = () => {
  // 입력 값들 상태 관리
  const [inputs, setInputs] = useState({
    buildingHeight: 15, // 높은 건물 높이 (m)
    solarBuildingHeight: 10, // 태양광 설치 건물 높이 (m)
    distance: 20, // 건물 간 거리 (m)
    panelWidth: 10, // 태양광 패널 폭 (m)
    panelDepth: 8, // 태양광 패널 깊이 (m)
    latitude: 37.5665, // 위도 (서울 기준)
    month: 6, // 월
    hour: 12, // 시간
    buildingOrientation: 180, // 높은 건물이 태양광 건물에서 보는 방향 (도, 0=북, 90=동, 180=남, 270=서)
    panelOrientation: 180, // 태양광 패널 방향 (도, 180=남향)
    panelTilt: 30, // 태양광 패널 기울기 (도)
    terrainSlope: 0 // 지형 경사도 (도)
  });

  const [results, setResults] = useState({});
  const [yearlyData, setYearlyData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);

  // 태양 고도각 계산
  const calculateSolarElevation = (latitude, month, hour) => {
    const dayOfYear = month * 30.44;
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear)) / 365 * Math.PI / 180);
    const hourAngle = (hour - 12) * 15;
    
    const elevation = Math.asin(
      Math.sin(declination * Math.PI / 180) * Math.sin(latitude * Math.PI / 180) +
      Math.cos(declination * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * Math.cos(hourAngle * Math.PI / 180)
    ) * 180 / Math.PI;
    
    return Math.max(0, elevation);
  };

  // 태양 방위각 계산 (남쪽 기준 0도)
  const calculateSolarAzimuth = (latitude, month, hour) => {
    const dayOfYear = month * 30.44;
    const declination = 23.45 * Math.sin((360 * (284 + dayOfYear)) / 365 * Math.PI / 180);
    const hourAngle = (hour - 12) * 15;
    
    let azimuth = Math.atan2(
      Math.sin(hourAngle * Math.PI / 180),
      Math.cos(hourAngle * Math.PI / 180) * Math.sin(latitude * Math.PI / 180) - 
      Math.tan(declination * Math.PI / 180) * Math.cos(latitude * Math.PI / 180)
    ) * 180 / Math.PI;
    
    // 남쪽을 0도로 조정
    azimuth = 180 + azimuth;
    if (azimuth >= 360) azimuth -= 360;
    if (azimuth < 0) azimuth += 360;
    
    return azimuth;
  };

  // 방향각 차이 계산 (최단 각도 차이)
  const getAngleDifference = (angle1, angle2) => {
    let diff = Math.abs(angle1 - angle2);
    if (diff > 180) diff = 360 - diff;
    return diff;
  };

  // 3D 그림자 계산 (건물 방향과 태양 방위각 고려)
  const calculate3DShadow = (buildingHeight, solarHeight, elevation, solarAzimuth, buildingOrientation, distance) => {
    const heightDiff = buildingHeight - solarHeight;
    if (heightDiff <= 0 || elevation <= 0) return { shadowLength: 0, effectiveShadow: 0, angleDiff: 0 };
    
    // 태양과 건물 방향의 각도 차이
    const angleDiff = getAngleDifference(solarAzimuth, buildingOrientation);
    
    // 기본 그림자 길이
    const baseShadowLength = heightDiff / Math.tan(elevation * Math.PI / 180);
    
    // 방향각 차이에 따른 실제 그림자 영향 계산
    const shadowProjection = Math.cos(angleDiff * Math.PI / 180);
    const effectiveShadow = baseShadowLength * Math.abs(shadowProjection);
    
    return {
      shadowLength: baseShadowLength,
      effectiveShadow: Math.max(0, effectiveShadow),
      angleDiff: angleDiff,
      shadowProjection: shadowProjection
    };
  };

  // 패널 차폐율 계산 (패널 방향과 기울기 고려)
  const calculateAdvancedShading = (shadowData, distance, panelDepth, panelOrientation, solarAzimuth, panelTilt) => {
    const { effectiveShadow, angleDiff } = shadowData;
    
    if (effectiveShadow <= distance) return { shadingPercentage: 0, directImpact: false };
    
    // 패널에 도달하는 그림자 길이
    const shadowOnPanel = effectiveShadow - distance;
    
    // 패널 방향과 태양 방위각의 차이
    const panelAngleDiff = getAngleDifference(solarAzimuth, panelOrientation);
    
    // 패널 기울기에 따른 그림자 보정
    const tiltFactor = Math.cos(panelTilt * Math.PI / 180);
    const adjustedShadowDepth = shadowOnPanel * tiltFactor;
    
    // 패널 방향에 따른 그림자 영향 보정
    const orientationFactor = Math.max(0, Math.cos(panelAngleDiff * Math.PI / 180));
    
    // 최종 차폐율 계산
    const baseShadingRatio = Math.min(adjustedShadowDepth / panelDepth, 1);
    const finalShadingRatio = baseShadingRatio * orientationFactor;
    
    return {
      shadingPercentage: finalShadingRatio * 100,
      directImpact: angleDiff < 90,
      orientationFactor: orientationFactor,
      tiltFactor: tiltFactor
    };
  };

  // 발전량 손실 계산 (개선된 모델)
  const calculateAdvancedPowerLoss = (shadingData, elevation) => {
    const { shadingPercentage, directImpact } = shadingData;
    
    if (shadingPercentage === 0) return 0;
    
    // 직접 영향 여부에 따른 손실 계수
    const impactMultiplier = directImpact ? 1.0 : 0.7;
    
    // 태양 고도각에 따른 손실 보정 (고도각이 낮을수록 영향 큼)
    const elevationFactor = 1 + (1 - Math.sin(elevation * Math.PI / 180)) * 0.5;
    
    let baseLoss;
    if (shadingPercentage < 10) {
      baseLoss = shadingPercentage * 0.8;
    } else if (shadingPercentage < 30) {
      baseLoss = 8 + (shadingPercentage - 10) * 1.2;
    } else if (shadingPercentage < 70) {
      baseLoss = 32 + (shadingPercentage - 30) * 1.5;
    } else {
      baseLoss = 92 + (shadingPercentage - 70) * 0.3;
    }
    
    return Math.min(100, baseLoss * impactMultiplier * elevationFactor);
  };

  // 계산 실행
  const calculate = () => {
    const elevation = calculateSolarElevation(inputs.latitude, inputs.month, inputs.hour);
    const azimuth = calculateSolarAzimuth(inputs.latitude, inputs.month, inputs.hour);
    const shadowData = calculate3DShadow(
      inputs.buildingHeight, 
      inputs.solarBuildingHeight, 
      elevation, 
      azimuth, 
      inputs.buildingOrientation, 
      inputs.distance
    );
    const shadingData = calculateAdvancedShading(
      shadowData, 
      inputs.distance, 
      inputs.panelDepth, 
      inputs.panelOrientation, 
      azimuth, 
      inputs.panelTilt
    );
    const powerLoss = calculateAdvancedPowerLoss(shadingData, elevation);

    setResults({
      elevation: elevation.toFixed(1),
      azimuth: azimuth.toFixed(1),
      shadowLength: shadowData.shadowLength.toFixed(1),
      effectiveShadow: shadowData.effectiveShadow.toFixed(1),
      angleDiff: shadowData.angleDiff.toFixed(1),
      shadingPercentage: shadingData.shadingPercentage.toFixed(1),
      powerLoss: powerLoss.toFixed(1),
      directImpact: shadingData.directImpact,
      orientationFactor: (shadingData.orientationFactor * 100).toFixed(1)
    });
  };

  // 시간별 데이터 계산
  const calculateHourlyData = () => {
    const hours = Array.from({length: 13}, (_, i) => i + 6); // 6시~18시
    
    const data = hours.map(hour => {
      const elevation = calculateSolarElevation(inputs.latitude, inputs.month, hour);
      const azimuth = calculateSolarAzimuth(inputs.latitude, inputs.month, hour);
      const shadowData = calculate3DShadow(
        inputs.buildingHeight, 
        inputs.solarBuildingHeight, 
        elevation, 
        azimuth, 
        inputs.buildingOrientation, 
        inputs.distance
      );
      const shadingData = calculateAdvancedShading(
        shadowData, 
        inputs.distance, 
        inputs.panelDepth, 
        inputs.panelOrientation, 
        azimuth, 
        inputs.panelTilt
      );
      const powerLoss = calculateAdvancedPowerLoss(shadingData, elevation);
      
      return { 
        hour, 
        elevation: elevation.toFixed(1), 
        azimuth: azimuth.toFixed(1),
        shadowLength: shadowData.effectiveShadow.toFixed(1),
        shadingPercentage: shadingData.shadingPercentage.toFixed(1),
        powerLoss: powerLoss.toFixed(1),
        directImpact: shadingData.directImpact
      };
    });
    
    setHourlyData(data);
  };

  // 연간 데이터 계산
  const calculateYearlyData = () => {
    const months = Array.from({length: 12}, (_, i) => i + 1);
    const hours = [9, 12, 15];
    
    const data = months.map(month => {
      const monthData = hours.map(hour => {
        const elevation = calculateSolarElevation(inputs.latitude, month, hour);
        const azimuth = calculateSolarAzimuth(inputs.latitude, month, hour);
        const shadowData = calculate3DShadow(
          inputs.buildingHeight, 
          inputs.solarBuildingHeight, 
          elevation, 
          azimuth, 
          inputs.buildingOrientation, 
          inputs.distance
        );
        const shadingData = calculateAdvancedShading(
          shadowData, 
          inputs.distance, 
          inputs.panelDepth, 
          inputs.panelOrientation, 
          azimuth, 
          inputs.panelTilt
        );
        const powerLoss = calculateAdvancedPowerLoss(shadingData, elevation);
        
        return { hour, elevation, shadowLength: shadowData.effectiveShadow, shadingPercentage: shadingData.shadingPercentage, powerLoss };
      });
      
      const avgLoss = monthData.reduce((sum, data) => sum + data.powerLoss, 0) / monthData.length;
      return { month, avgLoss: avgLoss.toFixed(1), details: monthData };
    });
    
    setYearlyData(data);
  };

  useEffect(() => {
    calculate();
    calculateHourlyData();
    calculateYearlyData();
  }, [inputs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  
  const getDirectionName = (angle) => {
    if (angle >= 337.5 || angle < 22.5) return '북';
    if (angle >= 22.5 && angle < 67.5) return '북동';
    if (angle >= 67.5 && angle < 112.5) return '동';
    if (angle >= 112.5 && angle < 157.5) return '남동';
    if (angle >= 157.5 && angle < 202.5) return '남';
    if (angle >= 202.5 && angle < 247.5) return '남서';
    if (angle >= 247.5 && angle < 292.5) return '서';
    if (angle >= 292.5 && angle < 337.5) return '북서';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-orange-50 min-h-screen">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
          <Sun className="text-orange-500" />
          3D 태양광 패널 그림자 영향 계산기
          <Building className="text-blue-500" />
        </h1>
        <p className="text-gray-600">건물 방향, 패널 각도를 고려한 정밀 그림자 분석</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 기본 설정 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Building className="text-blue-500" />
            기본 설정
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">높은 건물 높이 (m)</label>
                <input
                  type="number"
                  value={inputs.buildingHeight}
                  onChange={(e) => handleInputChange('buildingHeight', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태양광 건물 높이 (m)</label>
                <input
                  type="number"
                  value={inputs.solarBuildingHeight}
                  onChange={(e) => handleInputChange('solarBuildingHeight', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">건물 간 거리 (m)</label>
                <input
                  type="number"
                  value={inputs.distance}
                  onChange={(e) => handleInputChange('distance', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">위도</label>
                <input
                  type="number"
                  step="0.1"
                  value={inputs.latitude}
                  onChange={(e) => handleInputChange('latitude', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">패널 폭 (m)</label>
                <input
                  type="number"
                  value={inputs.panelWidth}
                  onChange={(e) => handleInputChange('panelWidth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">패널 깊이 (m)</label>
                <input
                  type="number"
                  value={inputs.panelDepth}
                  onChange={(e) => handleInputChange('panelDepth', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">월</label>
                <select
                  value={inputs.month}
                  onChange={(e) => handleInputChange('month', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {monthNames.map((month, index) => (
                    <option key={index} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
                <input
                  type="number"
                  min="6"
                  max="18"
                  value={inputs.hour}
                  onChange={(e) => handleInputChange('hour', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 방향 및 각도 설정 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Compass className="text-green-500" />
            방향 및 각도
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                높은 건물 방향 ({getDirectionName(inputs.buildingOrientation)})
              </label>
              <input
                type="range"
                min="0"
                max="359"
                value={inputs.buildingOrientation}
                onChange={(e) => handleInputChange('buildingOrientation', e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>북(0°)</span>
                <span>동(90°)</span>
                <span>남(180°)</span>
                <span>서(270°)</span>
              </div>
              <div className="text-center text-sm font-medium text-blue-600 mt-2">
                {inputs.buildingOrientation}°
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                패널 방향 ({getDirectionName(inputs.panelOrientation)})
              </label>
              <input
                type="range"
                min="0"
                max="359"
                value={inputs.panelOrientation}
                onChange={(e) => handleInputChange('panelOrientation', e.target.value)}
                className="w-full"
              />
              <div className="text-center text-sm font-medium text-green-600 mt-2">
                {inputs.panelOrientation}°
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                패널 기울기: {inputs.panelTilt}°
              </label>
              <input
                type="range"
                min="0"
                max="60"
                value={inputs.panelTilt}
                onChange={(e) => handleInputChange('panelTilt', e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>수평(0°)</span>
                <span>최적(30°)</span>
                <span>수직(60°)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지형 경사: {inputs.terrainSlope}°
              </label>
              <input
                type="range"
                min="-15"
                max="15"
                value={inputs.terrainSlope}
                onChange={(e) => handleInputChange('terrainSlope', e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>하향(-15°)</span>
                <span>평지(0°)</span>
                <span>상향(15°)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 계산 결과 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Info className="text-orange-500" />
            계산 결과
          </h2>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">태양 고도각</div>
                <div className="text-lg font-bold text-blue-600">{results.elevation}°</div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600">태양 방위각</div>
                <div className="text-lg font-bold text-orange-600">{results.azimuth}°</div>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600">실제 그림자 길이</div>
              <div className="text-lg font-bold text-gray-700">{results.effectiveShadow} m</div>
              <div className="text-xs text-gray-500">기하학적: {results.shadowLength}m</div>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600">방향각 차이</div>
              <div className="text-lg font-bold text-purple-600">{results.angleDiff}°</div>
              <div className="text-xs text-gray-500">
                {results.directImpact ? '직접 영향' : '간접 영향'}
              </div>
            </div>

            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600">패널 차폐율</div>
              <div className="text-lg font-bold text-yellow-600">{results.shadingPercentage}%</div>
              <div className="text-xs text-gray-500">
                방향 보정: {results.orientationFactor}%
              </div>
            </div>

            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600">예상 발전량 손실</div>
              <div className="text-lg font-bold text-red-600">{results.powerLoss}%</div>
              <div className="text-xs text-gray-500">
                {parseFloat(results.powerLoss) < 5 ? '미미한 손실' : 
                 parseFloat(results.powerLoss) < 20 ? '경미한 손실' : '상당한 손실'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 시간별 분석 */}
      <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">시간별 그림자 영향 ({monthNames[inputs.month - 1]})</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-13 gap-2">
          {hourlyData.map((data, index) => (
            <div key={index} className="border rounded-lg p-2 text-center">
              <div className="font-semibold text-sm mb-1">{data.hour}시</div>
              <div className="text-xs space-y-1">
                <div>고도: {data.elevation}°</div>
                <div>방위: {data.azimuth}°</div>
                <div>그림자: {data.shadowLength}m</div>
                <div className={`font-semibold ${
                  parseFloat(data.powerLoss) < 5 ? 'text-green-600' : 
                  parseFloat(data.powerLoss) < 20 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  손실: {data.powerLoss}%
                </div>
                <div className="text-xs">
                  {data.directImpact ? '🔴 직접' : '🟡 간접'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 연간 분석 */}
      <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">연간 그림자 영향 분석</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {yearlyData.map((data, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="font-semibold text-center mb-2">{monthNames[data.month - 1]}</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{data.avgLoss}%</div>
                <div className="text-xs text-gray-500">평균 손실</div>
              </div>
              <div className="mt-2 space-y-1">
                {data.details.map((detail, i) => (
                  <div key={i} className="text-xs flex justify-between">
                    <span>{detail.hour}시</span>
                    <span className={`font-semibold ${
                      detail.powerLoss < 5 ? 'text-green-600' : 
                      detail.powerLoss < 20 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {detail.powerLoss.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 개선 권장사항 */}
      <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">💡 3D 분석 기반 개선 권장사항</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <strong>🧭 방향 최적화:</strong>
            <ul className="mt-1 space-y-1 text-gray-700">
              <li>• 현재 건물-태양 각도차: {results.angleDiff}°</li>
              <li>• {parseFloat(results.angleDiff) > 90 ? '간접 영향으로 손실 감소' : '직접 영향으로 주의 필요'}</li>
              <li>• 패널을 {inputs.panelOrientation < 180 ? '서쪽' : '동쪽'}으로 {Math.abs(180 - inputs.panelOrientation) > 30 ? '크게 ' : ''}조정 고려</li>
            </ul>
          </div>
          <div>
            <strong>📐 각도 조정:</strong>
            <ul className="mt-1 space-y-1 text-gray-700">
              <li>• 현재 패널 기울기: {inputs.panelTilt}°</li>
              <li>• {inputs.panelTilt < 25 ? '기울기 증가로 그림자 회피 가능' : inputs.panelTilt > 40 ? '기울기 감소로 효율 향상' : '적정 기울기 유지'}</li>
              <li>• 계절별 최적 각도 추적 시스템 검토</li>
            </ul>
          </div>
          <div>
            <strong>🏗️ 구조적 개선:</strong>
            <ul className="mt-1 space-y-1 text-gray-700">
              <li>• 설치 높이 {Math.max(0, Math.ceil(parseFloat(results.effectiveShadow || 0) - inputs.distance)).toFixed(0)}m 상승 고려</li>
              <li>• 그림자 영향 시간: {hourlyData.filter(h => parseFloat(h.powerLoss) > 10).length}시간/일</li>
              <li>• 최악 손실 시간대: {hourlyData.reduce((max, h) => parseFloat(h.powerLoss) > parseFloat(max.powerLoss) ? h : max, {powerLoss: 0}).hour || 'N/A'}시</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">📊 종합 분석 결과</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">연평균 손실:</span>
              <span className="ml-2 font-bold text-red-600">
                {yearlyData.length > 0 ? (yearlyData.reduce((sum, d) => sum + parseFloat(d.avgLoss), 0) / yearlyData.length).toFixed(1) : 0}%
              </span>
            </div>
            <div>
              <span className="font-medium">최대 월 손실:</span>
              <span className="ml-2 font-bold text-red-600">
                {yearlyData.length > 0 ? Math.max(...yearlyData.map(d => parseFloat(d.avgLoss))).toFixed(1) : 0}%
              </span>
            </div>
            <div>
              <span className="font-medium">영향 등급:</span>
              <span className={`ml-2 font-bold ${
                parseFloat(results.powerLoss) < 5 ? 'text-green-600' : 
                parseFloat(results.powerLoss) < 20 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {parseFloat(results.powerLoss) < 5 ? '낮음' : 
                 parseFloat(results.powerLoss) < 20 ? '보통' : '높음'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolarShadowCalculator;
