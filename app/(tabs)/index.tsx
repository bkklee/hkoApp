import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import * as Location from 'expo-location';
import { fetchWeatherData, fetch9DayForecast, fetchRainfallNowcast, WeatherData, ForecastData, RainfallNowcast } from '../../services/weather';
import { updateRainNotification } from '../../services/notifications';
import { WeatherDisplay } from '../../components/WeatherDisplay';
import { STATIONS } from '../../constants/stations';

// Rough HK Boundary check (Lat: 22.1 - 22.6, Lon: 113.8 - 114.5)
const isPointInHK = (lat: number, lon: number) => {
  return lat >= 22.1 && lat <= 22.6 && lon >= 113.8 && lon <= 114.5;
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeather, setCurrentWeather] = useState<(WeatherData & { rainfall?: RainfallNowcast[] }) | null>(null);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [rainfall, setRainfall] = useState<RainfallNowcast[]>([]);
  const [isUserLocation, setIsUserLocation] = useState(false);

  const lastTargetStationRef = useRef<string | null>(null);
  const lastForecastUpdateRef = useRef<number>(0);
  const lastConditionUpdateRef = useRef<number>(0);
  
  const [cachedCondition, setCachedCondition] = useState<{condition: string, suggestUmbrellaLongTerm: boolean, longTermLabel: string}>({
    condition: '天晴',
    suggestUmbrellaLongTerm: false,
    longTermLabel: '今日'
  });

  const loadWeather = useCallback(async (forceForecast = false) => {
    if (!refreshing && !currentWeather) setLoading(true);

    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
    }, 5000);

    try {
      const now = Date.now();
      const shouldUpdateForecast = forceForecast || (now - lastForecastUpdateRef.current > 60 * 60 * 1000);
      const shouldUpdateCondition = forceForecast || (now - lastConditionUpdateRef.current > 30 * 60 * 1000);

      const [weatherRes, forecastRes] = await Promise.all([
        fetchWeatherData().catch(() => null),
        shouldUpdateForecast ? fetch9DayForecast().catch(() => null) : Promise.resolve(null),
      ]);

      if (!weatherRes) throw new Error('無法連線至天文台');

      let { data: allWeatherData, condition, suggestUmbrellaLongTerm, longTermLabel } = weatherRes;
      
      if (shouldUpdateCondition) {
        setCachedCondition({ condition, suggestUmbrellaLongTerm, longTermLabel });
        lastConditionUpdateRef.current = now;
      } else {
        setCachedCondition(prev => {
          condition = prev.condition;
          suggestUmbrellaLongTerm = prev.suggestUmbrellaLongTerm;
          longTermLabel = prev.longTermLabel;
          return prev;
        });
      }

      if (forecastRes) {
        setForecast(forecastRes);
        lastForecastUpdateRef.current = now;
      }

      const defaultStation = STATIONS[0];
      const targetStationName = lastTargetStationRef.current || defaultStation.name;
      const initialMatchedData = allWeatherData.find(d => d.station === targetStationName) || allWeatherData[0];
      
      setCurrentWeather({ ...initialMatchedData, condition, suggestUmbrellaLongTerm, longTermLabel });
      setLoading(false);
      clearTimeout(safetyTimeout);

      const fetchLocationAndRefine = async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') {
            const req = await Location.requestForegroundPermissionsAsync();
            if (req.status !== 'granted') {
              const rain = await fetchRainfallNowcast(defaultStation.lat, defaultStation.lon).catch(() => []);
              setRainfall(rain);
              await updateRainNotification(rain);
              return;
            }
          }

          const location = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('GPS Timeout')), 2500))
          ]);

          let targetStation = STATIONS.find(s => s.name === targetStationName) || defaultStation;
          let targetLat = targetStation.lat;
          let targetLon = targetStation.lon;

          if (location) {
            const { latitude, longitude } = location.coords;
            
            // --- GEOFENCING CHECK ---
            if (isPointInHK(latitude, longitude)) {
                setIsUserLocation(true);
                let minDistance = Infinity;
                STATIONS.forEach(station => {
                  const distance = Math.sqrt(Math.pow(station.lat - latitude, 2) + Math.pow(station.lon - longitude, 2));
                  if (distance < minDistance) {
                    minDistance = distance;
                    targetStation = station;
                    targetLat = latitude;
                    targetLon = longitude;
                  }
                });
                lastTargetStationRef.current = targetStation.name;
                const refinedMatchedData = allWeatherData.find(d => d.station === targetStation.name) || initialMatchedData;
                setCurrentWeather({ ...refinedMatchedData, condition, suggestUmbrellaLongTerm, longTermLabel });
            } else {
                // User is outside HK - Switch back to default (HK Observatory)
                console.log('User is outside HK, skipping local refinement.');
                setIsUserLocation(false);
                lastTargetStationRef.current = defaultStation.name;
                const hkoData = allWeatherData.find(d => d.station === defaultStation.name) || allWeatherData[0];
                setCurrentWeather({ ...hkoData, condition, suggestUmbrellaLongTerm, longTermLabel });
                targetLat = defaultStation.lat;
                targetLon = defaultStation.lon;
            }
          }

          const rain = await fetchRainfallNowcast(targetLat, targetLon).catch(() => []);
          setRainfall(rain);
          await updateRainNotification(rain);
        } catch (e) {
          const rain = await fetchRainfallNowcast(defaultStation.lat, defaultStation.lon).catch(() => []);
          setRainfall(rain);
        } finally {
          setRefreshing(false);
        }
      };

      fetchLocationAndRefine();
      setError(null);
    } catch (err: any) {
      setError('天氣更新失敗，請檢查網路。');
      setLoading(false);
      setRefreshing(false);
      clearTimeout(safetyTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing]);

  useEffect(() => {
    loadWeather(true);
    const intervalId = setInterval(() => loadWeather(false), 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [loadWeather]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWeather(true);
  }, [loadWeather]);

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  if (error && !currentWeather) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
    >
      {currentWeather && (
        <WeatherDisplay 
          station={currentWeather.station}
          temp={currentWeather.temp}
          time={currentWeather.time}
          condition={currentWeather.condition}
          forecast={forecast}
          rainfall={rainfall}
          isUserLocation={isUserLocation}
          suggestUmbrellaLongTerm={currentWeather.suggestUmbrellaLongTerm}
          longTermLabel={currentWeather.longTermLabel}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  text: { color: '#FFF' },
});
