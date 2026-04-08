export interface WeatherData {
  station: string;
  temp: number;
  time: string;
  condition?: string;
  suggestUmbrellaLongTerm?: boolean;
  longTermLabel?: string;
}

export interface ForecastData {
  forecastDate: string;
  week: string;
  forecastWeather: string;
  forecastMaxtemp: { value: number, unit: string };
  forecastMintemp: { value: number, unit: string };
  ForecastIcon: number;
}

export interface RainfallNowcast {
  updateTime: string;
  startTime: string;
  endTime: string;
  amount: number;
}

const HKO_CSV_URL = 'https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_1min_temperature_uc.csv';
const HKO_RSS_URL = 'https://res.data.gov.hk/api/get-download-file?name=https%3A%2F%2Frss.weather.gov.hk%2Frss%2FCurrentWeather.xml';
const HKO_FORECAST_RSS_URL = 'https://res.data.gov.hk/api/get-download-file?name=https%3A%2F%2Frss.weather.gov.hk%2Frss%2FLocalWeatherForecast_uc.xml';
const HKO_9DAY_URL = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=tc';
const HKO_RAINFALL_NOWCAST_URL = 'https://data.weather.gov.hk/weatherAPI/hko_data/F3/Gridded_rainfall_nowcast.csv';
const NOWCAST_API_URL = (lat: number, lon: number) => `https://kklee.dev/api/nowcast?lat=${lat}&lon=${lon}`;

const ICON_MAP: { [key: string]: string } = {
  '50': '天晴', '51': '間中有陽光', '52': '短暫有陽光', '53': '間中有陽光及幾陣驟雨',
  '54': '短暫陽光有幾陣驟雨', '60': '多雲', '61': '密雲', '62': '微雨', '63': '雨',
  '64': '大雨', '65': '雷暴', '70': '天色良好', '71': '天色良好', '72': '天色良好',
  '73': '天色良好', '74': '天色良好', '75': '天色良好', '76': '大致多雲',
  '77': '天色大致良好', '80': '大風', '81': '乾燥', '82': '潮濕', '83': '霧',
  '84': '薄霧', '85': '煙霞', '90': '熱', '91': '暖', '92': '涼', '93': '冷',
};

export async function fetchWeatherData(): Promise<{ data: WeatherData[], condition: string, suggestUmbrellaLongTerm: boolean, longTermLabel: string }> {
  try {
    const csvResponse = await fetch(HKO_CSV_URL);
    const csvData = await csvResponse.text();
    
    let condition = '天晴'; 
    try {
      const rssResponse = await fetch(HKO_RSS_URL);
      const rssText = await rssResponse.text();
      const match = rssText.match(/pic(\d+)\.png/);
      if (match && match[1]) condition = ICON_MAP[match[1]] || '晴';
    } catch (e) {}

    let suggestUmbrellaLongTerm = false;
    let longTermLabel = '今日';
    try {
      const forecastResponse = await fetch(HKO_FORECAST_RSS_URL);
      const forecastText = await forecastResponse.text();
      const immediateSection = forecastText.split('展望')[0] || forecastText;
      const rainKeywords = ['雨', '驟雨', '雷暴', '微雨'];
      suggestUmbrellaLongTerm = rainKeywords.some(keyword => immediateSection.includes(keyword));
      const currentHour = new Date().getHours();
      longTermLabel = (forecastText.includes('今晚及明日') || currentHour >= 18) ? '明日' : '今日';
    } catch (e) {}

    const lines = csvData.trim().split('\n');
    const data = lines.slice(1).map(line => {
      const [time, station, tempStr] = line.split(',');
      return { time, station, temp: parseFloat(tempStr) };
    }).filter(d => !isNaN(d.temp));

    return { data, condition, suggestUmbrellaLongTerm, longTermLabel };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return { data: [], condition: 'Fine', suggestUmbrellaLongTerm: false, longTermLabel: '今日' };
  }
}

export async function fetch9DayForecast(): Promise<ForecastData[]> {
  try {
    const response = await fetch(HKO_9DAY_URL);
    const jsonData = await response.json();
    return jsonData.weatherForecast || [];
  } catch (error) {
    console.error('Error fetching 9-day forecast:', error);
    return [];
  }
}

export function addMinutesToHKOTime(hkoTime: string, minsToAdd: number): string {
  const year = parseInt(hkoTime.slice(0, 4));
  const month = parseInt(hkoTime.slice(4, 6)) - 1;
  const day = parseInt(hkoTime.slice(6, 8));
  const hours = parseInt(hkoTime.slice(8, 10));
  const mins = parseInt(hkoTime.slice(10, 12));
  const date = new Date(year, month, day, hours, mins);
  date.setMinutes(date.getMinutes() + minsToAdd);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${y}${m}${d}${hh}${mm}`;
}

async function fetchHKORainfallFallback(userLat: number, userLon: number): Promise<RainfallNowcast[]> {
  try {
    const response = await fetch(HKO_RAINFALL_NOWCAST_URL);
    if (!response.ok) throw new Error('HKO fallback failed');
    const csvData = await response.text();
    const lines = csvData.trim().split('\n');
    let minDistance = Infinity;
    let closestLat = 0, closestLon = 0;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 5) continue;
      const gridLat = parseFloat(parts[2]), gridLon = parseFloat(parts[3]);
      const distance = Math.sqrt(Math.pow(gridLat - userLat, 2) + Math.pow(gridLon - userLon, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestLat = gridLat; closestLon = gridLon;
      }
      if (distance < 0.005) break; 
    }

    const results: RainfallNowcast[] = [];
    const targetLatStr = closestLat.toFixed(3), targetLonStr = closestLon.toFixed(3);
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 5) continue;
      const lat = parseFloat(parts[2]).toFixed(3), lon = parseFloat(parts[3]).toFixed(3);
      if (lat === targetLatStr && lon === targetLonStr) {
        results.push({ 
          updateTime: parts[0], 
          startTime: addMinutesToHKOTime(parts[1], -30),
          endTime: parts[1], 
          amount: parseFloat(parts[4]) 
        });
      }
      if (results.length === 4) break;
    }
    return results;
  } catch (e) {
    return [];
  }
}

export async function fetchRainfallNowcast(userLat: number, userLon: number): Promise<RainfallNowcast[]> {
  try {
    const response = await fetch(NOWCAST_API_URL(userLat, userLon));
    if (!response.ok) return fetchHKORainfallFallback(userLat, userLon);
    const data = await response.json();
    if (!data || !data.rainfallNowcast) return fetchHKORainfallFallback(userLat, userLon);
    const updatedTime = data.updatedTime;
    return data.rainfallNowcast.map((amount: number, index: number) => ({
      updateTime: updatedTime,
      startTime: addMinutesToHKOTime(updatedTime, index * 30),
      endTime: addMinutesToHKOTime(updatedTime, (index + 1) * 30),
      amount: amount
    }));
  } catch (error) {
    return fetchHKORainfallFallback(userLat, userLon);
  }
}
