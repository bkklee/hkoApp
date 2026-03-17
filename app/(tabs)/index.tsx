import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import * as Location from 'expo-location';
import { fetchWeatherData, fetch9DayForecast, fetchRainfallNowcast, WeatherData, ForecastData, RainfallNowcast } from '../../services/weather';
import { updateRainNotification } from '../../services/notifications';
import { WeatherDisplay } from '../../components/WeatherDisplay';
import { STATIONS } from '../../constants/stations';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeather, setCurrentWeather] = useState<(WeatherData & { rainfall?: RainfallNowcast[] }) | null>(null);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [rainfall, setRainfall] = useState<RainfallNowcast[]>([]);
  const [isUserLocation, setIsUserLocation] = useState(false);

  const [lastForecastUpdate, setLastForecastUpdate] = useState<number>(0);

  const loadWeather = useCallback(async (forceForecast = false) => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let location: Location.LocationObject | null = null;
      let nearestStation = STATIONS[0]; 

      if (status === 'granted') {
        location = await Location.getCurrentPositionAsync({});
        if (location) {
          setIsUserLocation(true);
          let minDistance = Infinity;
          STATIONS.forEach(station => {
            const distance = Math.sqrt(
              Math.pow(station.lat - location!.coords.latitude, 2) + 
              Math.pow(station.lon - location!.coords.longitude, 2)
            );
            if (distance < minDistance) {
              minDistance = distance;
              nearestStation = station;
            }
          });
        }
      }

      const now = Date.now();
      const shouldUpdateForecast = forceForecast || (now - lastForecastUpdate > 60 * 60 * 1000);

      const [weatherRes, forecastRes, rainfallRes] = await Promise.all([
        fetchWeatherData(),
        shouldUpdateForecast ? fetch9DayForecast() : Promise.resolve(null),
        location ? fetchRainfallNowcast(location.coords.latitude, location.coords.longitude) : fetchRainfallNowcast(nearestStation.lat, nearestStation.lon)
      ]);

      const { data: allWeatherData, condition, suggestUmbrellaLongTerm, longTermLabel } = weatherRes;
      
      if (forecastRes) {
        setForecast(forecastRes);
        setLastForecastUpdate(now);
      }
      
      setRainfall(rainfallRes);
      updateRainNotification(rainfallRes);

      const matchedData = allWeatherData.find(d => d.station === nearestStation.name);

      if (matchedData) {
        setCurrentWeather({ ...matchedData, condition, suggestUmbrellaLongTerm, longTermLabel });
      } else {
        const hkoFallback = allWeatherData.find(d => d.station === '天文台');
        if (hkoFallback) {
          setCurrentWeather({ ...hkoFallback, condition, suggestUmbrellaLongTerm, longTermLabel });
        } else if (allWeatherData.length > 0) {
          setCurrentWeather({ ...allWeatherData[0], condition, suggestUmbrellaLongTerm, longTermLabel });
        } else {
          setError('Could not find weather data');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lastForecastUpdate]);

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
