import React, { useState, useEffect } from 'react';
import axios from 'axios';

const WeatherWidget = () => {
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast24h, setForecast24h] = useState([]);
  const [forecast7d, setForecast7d] = useState([]);
  const [selectedCity, setSelectedCity] = useState('서울');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_KEY = 'c13edceb6e5eb04636c5d6882ccc2f7f';
  
  const cities = [
    { name: '서울', lat: 37.5665, lon: 126.9780 },
    { name: '부산', lat: 35.1796, lon: 129.0756 },
    { name: '대구', lat: 35.8714, lon: 128.601 },
    { name: '인천', lat: 37.4563, lon: 126.7052 },
    { name: '광주', lat: 35.1595, lon: 126.8526 },
    { name: '대전', lat: 36.3504, lon: 127.3845 },
    { name: '울산', lat: 35.5384, lon: 129.3114 },
    { name: '세종', lat: 36.4875, lon: 127.2813 },
    { name: '수원', lat: 37.2636, lon: 127.0286 },
    { name: '창원', lat: 35.2281, lon: 128.6811 },
    { name: '고양', lat: 37.6584, lon: 126.8320 },
    { name: '용인', lat: 37.2410, lon: 127.1776 },
    { name: '성남', lat: 37.4200, lon: 127.1266 },
    { name: '청주', lat: 36.6424, lon: 127.4890 },
    { name: '안산', lat: 37.3218, lon: 126.8309 },
    { name: '전주', lat: 35.8242, lon: 127.1480 },
    { name: '안양', lat: 37.3943, lon: 126.9568 },
    { name: '포항', lat: 36.0190, lon: 129.3435 },
    { name: '시흥', lat: 37.3799, lon: 126.8030 },
    { name: '의정부', lat: 37.7381, lon: 127.0338 },
    { name: '원주', lat: 37.3422, lon: 127.9202 },
    { name: '춘천', lat: 37.8813, lon: 127.7298 },
    { name: '강릉', lat: 37.7519, lon: 128.8761 },
    { name: '제주', lat: 33.4996, lon: 126.5312 },
    { name: '서귀포', lat: 33.2511, lon: 126.5603 }
  ];

  const getWeatherIcon = (iconCode) => {
    const iconMap = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '🌨️', '13n': '🌨️',
      '50d': '🌫️', '50n': '🌫️'
    };
    return iconMap[iconCode] || '🌤️';
  };

  const getWindDirection = (degree) => {
    const directions = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
    return directions[Math.round(degree / 45) % 8];
  };

  const fetchWeatherData = async (cityData) => {
    setLoading(true);
    setError(null);
    
    try {
      // 현재 날씨
      const currentResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${cityData.lat}&lon=${cityData.lon}&appid=${API_KEY}&units=metric&lang=kr`
      );
      setCurrentWeather(currentResponse.data);

      // 24시간 예보 (5일 예보에서 첫 24시간 추출)
      const forecastResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${cityData.lat}&lon=${cityData.lon}&appid=${API_KEY}&units=metric&lang=kr`
      );
      setForecast24h(forecastResponse.data.list.slice(0, 8)); // 3시간 간격 8개 = 24시간

      // 7일 예보
      const weeklyResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/onecall?lat=${cityData.lat}&lon=${cityData.lon}&appid=${API_KEY}&units=metric&lang=kr&exclude=minutely,alerts`
      );
      setForecast7d(weeklyResponse.data.daily.slice(0, 7));

    } catch (err) {
      setError('날씨 정보를 가져오는데 실패했습니다.');
      console.error('Weather API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cityData = cities.find(city => city.name === selectedCity);
    if (cityData) {
      fetchWeatherData(cityData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity]); // cities는 컴포넌트 내부 상수이므로 의존성에서 제외

  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">날씨 정보를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-lg p-6">
        <div className="text-red-600 dark:text-red-400 text-center">
          <p className="text-lg font-medium">⚠️ {error}</p>
          <button 
            onClick={() => fetchWeatherData(cities.find(city => city.name === selectedCity))}
            className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-lg p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          🌤️ 실시간 날씨정보
        </h2>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {cities.map(city => (
            <option key={city.name} value={city.name}>{city.name}</option>
          ))}
        </select>
      </div>

      {/* 오늘의 날씨 */}
      {currentWeather && (
        <div className="bg-white dark:bg-gray-700 rounded-lg p-6 mb-6 shadow-md">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
            📍 {selectedCity} - 현재 날씨
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-6xl mb-2">{getWeatherIcon(currentWeather.weather[0].icon)}</div>
              <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
                {currentWeather.weather[0].description}
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {Math.round(currentWeather.main.temp)}°C
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                체감 {Math.round(currentWeather.main.feels_like)}°C
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">습도:</span>
                <span className="font-medium text-gray-800 dark:text-white">{currentWeather.main.humidity}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">풍속:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {currentWeather.wind.speed}m/s {getWindDirection(currentWeather.wind.deg)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">기압:</span>
                <span className="font-medium text-gray-800 dark:text-white">{currentWeather.main.pressure}hPa</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">일출/일몰:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {formatTime(currentWeather.sys.sunrise)} / {formatTime(currentWeather.sys.sunset)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">UV 지수:</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {currentWeather.uvi ? Math.round(currentWeather.uvi) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">운량:</span>
                <span className="font-medium text-gray-800 dark:text-white">{currentWeather.clouds?.all || 0}%</span>
              </div>
            </div>
          </div>
          
          {/* 태양광 발전 최적화 정보 */}
          <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
              ⚡ 태양광 발전 최적화 정보
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="text-center">
                <div className="text-yellow-600 dark:text-yellow-400 font-medium">발전량 예상</div>
                <div className="text-lg font-bold text-yellow-800 dark:text-yellow-300">
                  {currentWeather.clouds?.all <= 20 ? '최적' : 
                   currentWeather.clouds?.all <= 50 ? '양호' : 
                   currentWeather.clouds?.all <= 80 ? '보통' : '불량'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-yellow-600 dark:text-yellow-400 font-medium">일조시간</div>
                <div className="text-lg font-bold text-yellow-800 dark:text-yellow-300">
                  {Math.round((currentWeather.sys.sunset - currentWeather.sys.sunrise) / 3600)}시간
                </div>
              </div>
              <div className="text-center">
                <div className="text-yellow-600 dark:text-yellow-400 font-medium">효율성</div>
                <div className="text-lg font-bold text-yellow-800 dark:text-yellow-300">
                  {100 - (currentWeather.clouds?.all || 0)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 24시간 예보 */}
      <div className="bg-white dark:bg-gray-700 rounded-lg p-6 mb-6 shadow-md">
        <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
          🕐 24시간 예상 기상정보
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {forecast24h.map((item, index) => (
            <div key={index} className="text-center bg-gray-50 dark:bg-gray-600 rounded-lg p-3">
              <div className="text-sm text-gray-500 dark:text-gray-300 mb-2">
                {formatTime(item.dt)}
              </div>
              <div className="text-2xl mb-2">{getWeatherIcon(item.weather[0].icon)}</div>
              <div className="font-bold text-gray-800 dark:text-white">
                {Math.round(item.main.temp)}°C
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {item.pop > 0 && `💧${Math.round(item.pop * 100)}%`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7일 예보 */}
      <div className="bg-white dark:bg-gray-700 rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
          📅 일주간 예상 기후정보
        </h3>
        <div className="space-y-3">
          {forecast7d.map((day, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-600 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500 dark:text-gray-300 min-w-[60px]">
                  {index === 0 ? '오늘' : formatDate(day.dt)}
                </div>
                <div className="text-2xl">{getWeatherIcon(day.weather[0].icon)}</div>
                <div className="text-gray-700 dark:text-gray-200">
                  {day.weather[0].description}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  ☀️ {Math.round((day.sunrise && day.sunset) ? (day.sunset - day.sunrise) / 3600 : 0)}h
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  ☁️ {day.clouds || 0}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  💧 {Math.round(day.pop * 100)}%
                </div>
                <div className="font-bold text-gray-800 dark:text-white min-w-[80px] text-right">
                  {Math.round(day.temp.max)}° / {Math.round(day.temp.min)}°
                </div>
              </div>
              
              {/* 태양광 발전 예상 효율 */}
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">발전효율:</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        (100 - (day.clouds || 0)) >= 80 ? 'bg-green-500' :
                        (100 - (day.clouds || 0)) >= 60 ? 'bg-yellow-500' :
                        (100 - (day.clouds || 0)) >= 40 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${100 - (day.clouds || 0)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {100 - (day.clouds || 0)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
