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

  // const getWindDirection = (degree) => {
  //   const directions = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  //   return directions[Math.round(degree / 45) % 8];
  // };

  // const formatDate = (timestamp) => {
  //   return new Date(timestamp * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  // };

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

      // 7일 예보 - 5일 예보 데이터를 활용하여 일별로 그룹화
      const forecastList = forecastResponse.data.list;
      const dailyData = {};
      
      forecastList.forEach(item => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!dailyData[date]) {
          dailyData[date] = {
            dt: item.dt,
            temp: { min: item.main.temp, max: item.main.temp },
            weather: item.weather,
            clouds: item.clouds.all,
            pop: item.pop,
            sunrise: null,
            sunset: null
          };
        } else {
          dailyData[date].temp.min = Math.min(dailyData[date].temp.min, item.main.temp);
          dailyData[date].temp.max = Math.max(dailyData[date].temp.max, item.main.temp);
          dailyData[date].pop = Math.max(dailyData[date].pop, item.pop);
        }
      });

      const dailyForecast = Object.values(dailyData).slice(0, 5); // 5일간 데이터
      setForecast7d(dailyForecast);

    } catch (err) {
      console.error('Weather API Error Details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config
      });
      
      if (err.response?.status === 401) {
        setError('API 키가 유효하지 않습니다. 키를 확인해주세요.');
      } else if (err.response?.status === 429) {
        setError('API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      } else if (err.code === 'ENOTFOUND' || err.code === 'ENETUNREACH') {
        setError('인터넷 연결을 확인해주세요.');
      } else {
        setError(`날씨 정보를 가져오는데 실패했습니다. (${err.response?.status || err.code})`);
      }
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
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <p>• API 키가 유효한지 확인해주세요</p>
            <p>• 인터넷 연결을 확인해주세요</p>
            <p>• OpenWeather 서비스 상태를 확인해주세요</p>
          </div>
          <button 
            onClick={() => fetchWeatherData(cities.find(city => city.name === selectedCity))}
            className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            🔄 다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl">
      {/* 배경 이미지 */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(255,107,107,0.8) 0%, rgba(255,173,86,0.7) 50%, rgba(255,204,112,0.6) 100%), url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23ff6b6b;stop-opacity:0.8"/><stop offset="50%" style="stop-color:%23ffa726;stop-opacity:0.7"/><stop offset="100%" style="stop-color:%23ffcc70;stop-opacity:0.6"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23bg)"/><path d="M0,300 Q480,200 960,300 T1920,300 L1920,1080 L0,1080 Z" fill="rgba(0,0,0,0.3)"/><path d="M0,500 Q480,400 960,500 T1920,500 L1920,1080 L0,1080 Z" fill="rgba(0,0,0,0.2)"/><path d="M0,700 Q480,600 960,700 T1920,700 L1920,1080 L0,1080 Z" fill="rgba(0,0,0,0.1)"/></svg>')`
        }}
      />
      
      {/* 글래스모피즘 오버레이 */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/20" />
      
      {/* 메인 컨텐츠 */}
      <div className="relative z-10 p-8 text-white">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="text-4xl font-light">🌤️</div>
            <div>
              <h2 className="text-2xl font-light tracking-wide">WEATHER</h2>
              <p className="text-white/70 text-sm font-light">실시간 날씨정보</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-4 py-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 font-light"
            >
              {cities.map(city => (
                <option key={city.name} value={city.name} className="bg-gray-800 text-white">{city.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const cityData = cities.find(city => city.name === selectedCity);
                if (cityData) {
                  console.log('Manual refresh triggered for:', selectedCity);
                  fetchWeatherData(cityData);
                }
              }}
              className="p-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl hover:bg-white/30 transition-all duration-300 font-light"
              disabled={loading}
            >
              <div className={`text-white ${loading ? 'animate-spin' : ''}`}>
                {loading ? '🔄' : '↻'}
              </div>
            </button>
          </div>
        </div>

        {/* 현재 날씨 메인 섹션 */}
        {currentWeather && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-6">
                <div className="text-8xl drop-shadow-lg">
                  {getWeatherIcon(currentWeather.weather[0].icon)}
                </div>
                <div>
                  <div className="text-6xl font-thin mb-2">
                    +{Math.round(currentWeather.main.temp)}°C
                  </div>
                  <div className="text-white/80 text-lg font-light">
                    Feels like {Math.round(currentWeather.main.feels_like)}°
                  </div>
                  <div className="text-white/70 text-base font-light capitalize mt-1">
                    {currentWeather.weather[0].description}
                  </div>
                </div>
              </div>
              
              {/* 상세 정보 */}
              <div className="text-right space-y-2">
                <div className="text-white/80 text-sm font-light">
                  <div>Sunrise: {formatTime(currentWeather.sys.sunrise)}</div>
                  <div>Sunset: {formatTime(currentWeather.sys.sunset)}</div>
                </div>
                <div className="text-white/70 text-xs font-light">
                  <div>Wind speed: {currentWeather.wind.speed} m/s</div>
                  <div>Air humidity: {currentWeather.main.humidity}%</div>
                  <div>Pressure: {currentWeather.main.pressure} hPa</div>
                  <div>Precipitation probability: {Math.round((100 - (currentWeather.clouds?.all || 0)) * 0.1)}%</div>
                </div>
              </div>
            </div>

            {/* 태양광 발전 최적화 정보 */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-8">
              <h4 className="text-lg font-light mb-4 flex items-center gap-2">
                ⚡ 태양광 발전 최적화 정보
              </h4>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-white/70 text-sm font-light mb-1">발전량 예상</div>
                  <div className="text-2xl font-light">
                    {currentWeather.clouds?.all <= 20 ? '최적' : 
                     currentWeather.clouds?.all <= 50 ? '양호' : 
                     currentWeather.clouds?.all <= 80 ? '보통' : '불량'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/70 text-sm font-light mb-1">일조시간</div>
                  <div className="text-2xl font-light">
                    {Math.round((currentWeather.sys.sunset - currentWeather.sys.sunrise) / 3600)}시간
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/70 text-sm font-light mb-1">효율성</div>
                  <div className="text-2xl font-light">
                    {100 - (currentWeather.clouds?.all || 0)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 시간별 예보 */}
        <div className="mb-8">
          <h3 className="text-lg font-light mb-4 text-white/90">MORE DETAILS:</h3>
          <div className="grid grid-cols-8 gap-3">
            {forecast24h.slice(0, 8).map((item, index) => {
              const hour = new Date(item.dt * 1000).getHours();
              const timeLabel = hour === 0 ? 'NIGHT' : 
                               hour < 6 ? 'NIGHT' : 
                               hour < 12 ? 'MORNING' : 
                               hour < 18 ? 'DAY' : 'EVENING';
              
              return (
                <div key={index} className="text-center bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20">
                  <div className="text-xs text-white/70 font-light mb-2">{timeLabel}</div>
                  <div className="text-2xl mb-2">{getWeatherIcon(item.weather[0].icon)}</div>
                  <div className="text-sm font-light text-white">
                    +{Math.round(item.main.temp)}°
                  </div>
                  <div className="text-xs text-white/70 font-light mt-1">
                    {formatTime(item.dt)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5일 예보 */}
        <div className="space-y-3">
          <h3 className="text-lg font-light mb-4 text-white/90">SHOW FOR 5 DAYS</h3>
          {forecast7d.map((day, index) => {
            const dayName = index === 0 ? 'TODAY' : 
                           new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
            const dateStr = new Date(day.dt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            return (
              <div key={index} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="min-w-[80px]">
                      <div className="text-sm font-light text-white">{dayName}</div>
                      <div className="text-xs text-white/70 font-light">{dateStr}</div>
                    </div>
                    <div className="text-3xl">{getWeatherIcon(day.weather[0].icon)}</div>
                    <div className="flex-1">
                      <div className="text-white font-light capitalize">{day.weather[0].description}</div>
                      <div className="text-xs text-white/70 font-light">
                        강수확률: {Math.round(day.pop * 100)}% | 운량: {day.clouds || 0}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-light text-white">
                      +{Math.round(day.temp.max)}° / +{Math.round(day.temp.min)}°
                    </div>
                    <div className="text-xs text-white/70 font-light mt-1">
                      발전효율: {100 - (day.clouds || 0)}%
                    </div>
                  </div>
                </div>
                
                {/* 발전 효율 프로그레스 바 */}
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70 font-light">⚡</span>
                    <div className="flex-1 bg-white/20 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          (100 - (day.clouds || 0)) >= 80 ? 'bg-green-400' :
                          (100 - (day.clouds || 0)) >= 60 ? 'bg-yellow-400' :
                          (100 - (day.clouds || 0)) >= 40 ? 'bg-orange-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${100 - (day.clouds || 0)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-light text-white/90 min-w-[40px]">
                      {100 - (day.clouds || 0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
