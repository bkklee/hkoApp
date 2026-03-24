import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { fetchWeatherData, fetch9DayForecast, fetchRainfallNowcast, WeatherData, ForecastData, RainfallNowcast } from '../../services/weather';
import { updateRainNotification } from '../../services/notifications';
import { WeatherDisplay } from '../../components/WeatherDisplay';
import { STATIONS } from '../../constants/stations';
import { LAST_BG_SYNC_KEY } from '../../services/background';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeather, setCurrentWeather] = useState<(WeatherData & { rainfall?: RainfallNowcast[] }) | null>(null);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [rainfall, setRainfall] = useState<RainfallNowcast[]>([]);
  const [isUserLocation, setIsUserLocation] = useState(false);
  const [lastBgSync, setLastBgSync] = useState<string | null>(null);

  const lastForecastUpdateRef = useRef<number>(0);
  const lastConditionUpdateRef = useRef<number>(0);
  const [cachedCondition, setCachedCondition] = useState<{condition: string, suggestUmbrellaLongTerm: boolean, longTermLabel: string}>({
    condition: '天晴',
    suggestUmbrellaLongTerm: false,
    longTermLabel: '今日'
  });

  const loadWeather = useCallback(async (forceForecast = false) => {
    // Check background sync
    try {
      const stored = await AsyncStorage.getItem(LAST_BG_SYNC_KEY);
      if (stored) setLastBgSync(stored);
    } catch (e) {}

    // Only show full-screen loading on initial load
    if (!refreshing && !currentWeather) {
      setLoading(true);
    }

    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
    }, 5000);

    try {
      const now = Date.now();
      const shouldUpdateForecast = forceForecast || (now - lastForecastUpdateRef.current > 60 * 60 * 1000);
      const shouldUpdateCondition = forceForecast || (now - lastConditionUpdateRef.current > 30 * 60 * 1000);

      // --- PHASE 1: Fetch Weather Data IMMEDIATELY with default/fallback station ---
      // We don't wait for GPS here to ensure near-instant loading
      const [weatherRes, forecastRes] = await Promise.all([
        fetchWeatherData().catch(() => null),
        shouldUpdateForecast ? fetch9DayForecast().catch(() => null) : Promise.resolve(null),
      ]);

      if (!weatherRes) throw new Error('無法連線至天文台');

      // Update state with weather data first
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

      // Initial render with default station while we wait for GPS
      const defaultStation = STATIONS[0];
      const initialMatchedData = allWeatherData.find(d => d.station === defaultStation.name) || allWeatherData[0];
      setCurrentWeather({ ...initialMatchedData, condition, suggestUmbrellaLongTerm, longTermLabel });
      
      // We can stop initial loading now because we have data to show!
      setLoading(false);
      clearTimeout(safetyTimeout);

      // --- PHASE 2: Background Location Fetching ---
      // This happens while the user is already looking at the app
      const fetchLocationAndRefine = async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') {
            const req = await Location.requestForegroundPermissionsAsync();
            if (req.status !== 'granted') {
              // No permission, just fetch rainfall for default station
              const rain = await fetchRainfallNowcast(defaultStation.lat, defaultStation.lon).catch(() => []);
              setRainfall(rain);
              updateRainNotification(rain);
              return;
            }
          }

          // We wait only up to 2.5 seconds for GPS
          const location = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('GPS Timeout')), 2500))
          ]);

          let targetStation = defaultStation;
          let targetLat = defaultStation.lat;
          let targetLon = defaultStation.lon;

          if (location) {
            setIsUserLocation(true);
            let minDistance = Infinity;
            STATIONS.forEach(station => {
              const distance = Math.sqrt(
                Math.pow(station.lat - location.coords.latitude, 2) + 
                Math.pow(station.lon - location.coords.longitude, 2)
              );
              if (distance < minDistance) {
                minDistance = distance;
                targetStation = station;
                targetLat = location.coords.latitude;
                targetLon = location.coords.longitude;
              }
            });

            // Update with refined station data
            const refinedMatchedData = allWeatherData.find(d => d.station === targetStation.name) || initialMatchedData;
            setCurrentWeather({ ...refinedMatchedData, condition, suggestUmbrellaLongTerm, longTermLabel });
          }

          const rain = await fetchRainfallNowcast(targetLat, targetLon).catch(() => []);
          setRainfall(rain);
          updateRainNotification(rain);
        } catch (e) {
          console.log('Background location refinement skipped:', e);
          // Still fetch rainfall for whatever we have
          const rain = await fetchRainfallNowcast(defaultStation.lat, defaultStation.lon).catch(() => []);
          setRainfall(rain);
        } finally {
          setRefreshing(false);
        }
      };

      fetchLocationAndRefine();
      setError(null);
    } catch (err: any) {
      console.error('loadWeather Error:', err);
      setError('天氣更新失敗，請檢查網路。');
      setLoading(false);
      setRefreshing(false);
      clearTimeout(safetyTimeout);
    }
  }, [refreshing]);
 // Removed currentWeather dependency to prevent re-fetch loops
 // Stable but aware of initial state
 // <-- Dependencies set to empty to keep identity stable

  useEffect(() => {
    loadWeather(true);
    
    // Auto-refresh weather every 5 minutes
    const intervalId = setInterval(() => {
      loadWeather(false);
    }, 5 * 60 * 1000);

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
      {lastBgSync && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>背景監測中: 最後執行於 {lastBgSync}</Text>
        </View>
      )}
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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  debugInfo: {
    backgroundColor: '#111',
    padding: 6,
    alignItems: 'center',
  },
  debugText: {
    color: '#666',
    fontSize: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#FFF',
  },
});
