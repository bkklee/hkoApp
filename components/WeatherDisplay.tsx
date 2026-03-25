import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ScrollView, Animated, useWindowDimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ForecastData, RainfallNowcast } from '../services/weather';

interface WeatherDisplayProps {
  station: string;
  temp: number;
  time: string;
  condition?: string;
  forecast?: ForecastData[];
  rainfall?: RainfallNowcast[];
  isUserLocation?: boolean;
  suggestUmbrellaLongTerm?: boolean;
  longTermLabel?: string;
}

export const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ 
  station, temp, time, condition, forecast, rainfall = [], isUserLocation, suggestUmbrellaLongTerm, longTermLabel = '今日' 
}) => {
  
  const { width, height } = useWindowDimensions();
  const isPad = Platform.OS === 'ios' && Platform.isPad && (width >= 768 || height >= 768);
  const contentWidth = isPad ? Math.min(width * 0.85, 800) : width - 40;
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getWarningStatus = (data: RainfallNowcast[]) => {
    if (!data || data.length === 0) return { color: '#4CAF50', label: 'ALL CLEAR' };
    const amounts = data.map(d => d.amount);
    const any30m = Math.max(...amounts);
    const sum60m = (amounts[0] || 0) + (amounts[1] || 0);
    const sum120m = amounts.reduce((a, b) => a + b, 0);

    if (any30m > 45 || sum60m > 70 || sum120m > 100) return { color: '#000000', label: 'BLACK RAIN', textColor: '#FFF', borderColor: '#FFF' };
    if (any30m > 35 || sum60m > 50 || sum120m > 70) return { color: '#FF5252', label: 'RED RAIN' };
    if (any30m > 20 || sum60m > 30 || sum120m > 50) return { color: '#FFEB3B', label: 'YELLOW RAIN' };
    if (any30m >= 0.05) return { color: '#40C4FF', label: 'RAINING' };
    return { color: '#4CAF50', label: 'ALL CLEAR' };
  };

  const status = getWarningStatus(rainfall);
  const mainColor = status.color;
  const currentRain = rainfall[0]?.amount || 0;
  const anyRainInTwoHours = rainfall.some(r => r.amount >= 0.05);

  useEffect(() => {
    if (currentRain >= 0.05) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [currentRain]);

  const dataTime = rainfall[0]?.updateTime || time;
  const todayStr = dataTime.slice(0, 8);
  const getDayLabel = (dateStr: string, week: string) => {
    if (dateStr === todayStr) return '今天';
    return week.replace('星期', '');
  };

  const formatShortTime = (timeStr: string) => {
    if (!timeStr || timeStr.length < 12) return '--:--';
    return `${timeStr.slice(8, 10)}:${timeStr.slice(10, 12)}`;
  };

  const formatNowTime = (d: Date) => {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getRelativeMins = (targetStr: string) => {
    if (!targetStr) return null;
    const year = parseInt(targetStr.slice(0, 4));
    const month = parseInt(targetStr.slice(4, 6)) - 1;
    const day = parseInt(targetStr.slice(6, 8));
    const hours = parseInt(targetStr.slice(8, 10));
    const mins = parseInt(targetStr.slice(10, 12));
    const targetDate = new Date(year, month, day, hours, mins);
    const diffMs = targetDate.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins <= 0) return '已過';
    if (diffMins >= 60) {
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    return `${diffMins}m`;
  };

  const chartPadding = isPad ? 20 : 10;
  const numBars = rainfall.length || 4;
  const gapSize = isPad ? 16 : 8;
  const chartWidth = contentWidth - (chartPadding * 2);
  const barWidth = (chartWidth - (numBars - 1) * gapSize) / numBars;

  return (
    <View style={styles.outerContainer}>
      <StatusBar style="light" />
      <View style={[styles.container, { width: contentWidth }]}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.locationRow}>
            {isUserLocation && <Ionicons name="navigate-sharp" size={isPad ? 18 : 14} color={mainColor === '#000000' ? '#FFF' : mainColor} style={{ marginRight: 6 }} />}
            <Text style={[styles.stationName, isPad && styles.stationNamePad]}>{station}</Text>
          </View>
          {status.label !== 'ALL CLEAR' && status.label !== 'RAINING' && (
            <View style={[styles.warningBadge, { backgroundColor: mainColor, borderColor: status.borderColor || mainColor }, isPad && styles.warningBadgePad]}>
              <Text style={[styles.warningBadgeText, { color: status.textColor || '#000' }, isPad && styles.warningBadgeTextPad]}>{status.label}</Text>
            </View>
          )}
        </View>

        {/* Hero Section */}
        <View style={[styles.heroLayout, isPad && styles.heroLayoutPad]}>
          <View style={styles.tempHero}>
            <Text style={[styles.mainTemp, isPad && styles.mainTempPad]}>
              {Math.round(temp)}
              <Text style={[styles.degreeUnit, isPad && styles.degreeUnitPad]}>°C</Text>
            </Text>
            <Text style={[styles.conditionText, isPad && styles.conditionTextPad]}>{condition}</Text>
          </View>

          {/* Umbrella Advice Section */}
          <View style={[styles.umbrellaSection, isPad && styles.umbrellaSectionPad]}>
            <View style={styles.umbrellaItem}>
               <Ionicons name="umbrella" size={isPad ? 32 : 20} color={anyRainInTwoHours ? "#40C4FF" : "rgba(255,255,255,0.15)"} />
               <Text style={[styles.umbrellaLabel, isPad && styles.umbrellaLabelPad]}>兩小時內</Text>
               <Text style={[styles.umbrellaValue, { color: anyRainInTwoHours ? "#40C4FF" : "rgba(255,255,255,0.3)" }, isPad && styles.umbrellaValuePad]}>
                 {anyRainInTwoHours ? "建議帶傘" : "無須帶傘"}
               </Text>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.umbrellaItem}>
               <Ionicons name="umbrella" size={isPad ? 32 : 20} color={suggestUmbrellaLongTerm ? "#40C4FF" : "rgba(255,255,255,0.15)"} />
               <Text style={[styles.umbrellaLabel, isPad && styles.umbrellaLabelPad]}>{longTermLabel}</Text>
               <Text style={[styles.umbrellaValue, { color: suggestUmbrellaLongTerm ? "#40C4FF" : "rgba(255,255,255,0.3)" }, isPad && styles.umbrellaValuePad]}>
                 {suggestUmbrellaLongTerm ? "建議帶傘" : "無須帶傘"}
               </Text>
            </View>
          </View>
        </View>

        <View style={styles.bodyContainer}>
          {/* Rain Timeline */}
          <View style={[styles.rainSection, isPad && styles.rainSectionPad]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, isPad && styles.sectionLabelPad]}>未來兩小時降雨預測 (mm)</Text>
            </View>
            
            <View style={[styles.timelineContainer, { paddingHorizontal: chartPadding }]}>
               <View style={[styles.barsContainer, { width: chartWidth, height: isPad ? 120 : 70 }]}>
                {rainfall.map((item, i) => (
                  <View key={i} style={{ width: barWidth, alignItems: 'center' }}>
                    <Text style={[styles.barValueText, { color: item.amount >= 0.05 ? (mainColor === '#000000' ? '#FFF' : mainColor) : 'rgba(255,255,255,0.2)' }, isPad && styles.barValueTextPad]}>
                      {item.amount >= 0.05 ? `${item.amount.toFixed(1)}` : '0'}
                    </Text>
                    <Animated.View 
                      style={[
                        styles.continuousBar, 
                        { 
                          width: barWidth,
                          height: Math.max(4, Math.min(item.amount * (isPad ? 60 : 35), isPad ? 120 : 70)),
                          backgroundColor: item.amount >= 0.05 ? (mainColor === '#000000' ? '#FFF' : mainColor) : 'rgba(255,255,255,0.05)',
                          transform: i === 0 && item.amount >= 0.05 ? [{ scaleY: pulseAnim }] : []
                        }
                      ]} 
                    />
                  </View>
                ))}
              </View>

              <View style={[styles.boundaryContainer, { width: chartWidth }]}>
                 <View style={[styles.boundaryMark, { left: 0, width: 80, alignItems: 'flex-start' }]}>
                    <Text style={[styles.boundaryTimeHighlight, isPad && styles.boundaryTimePad]}>{formatNowTime(now)}</Text>
                    <Text style={[styles.boundaryLabelHighlight, isPad && styles.boundaryLabelPad]}>現在</Text>
                 </View>
                 {rainfall.map((item, i) => {
                   const isLast = i === rainfall.length - 1;
                   const pos = isLast ? chartWidth : (i + 1) * barWidth + (i + 0.5) * gapSize;
                   return (
                     <View key={i} style={[styles.boundaryMark, { 
                       left: isLast ? undefined : pos - 40,
                       right: isLast ? 0 : undefined,
                       width: 80,
                       alignItems: isLast ? 'flex-end' : 'center'
                     }]}>
                        <Text style={[styles.boundaryTime, isPad && styles.boundaryTimePad]}>{formatShortTime(item.endTime)}</Text>
                        <Text style={[styles.boundaryLabel, isPad && styles.boundaryLabelPad]}>{getRelativeMins(item.endTime)}</Text>
                     </View>
                   );
                 })}
              </View>
            </View>
          </View>

          {/* Forecast */}
          <View style={styles.forecastSection}>
            <Text style={[styles.forecastTitle, isPad && styles.forecastTitlePad]}>九日天氣預報</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.forecastScroll}>
              {forecast?.map((day, i) => (
                <View key={i} style={[styles.forecastDay, isPad && styles.forecastDayPad]}>
                  <Text style={[styles.dayName, isPad && styles.dayNamePad]}>{getDayLabel(day.forecastDate, day.week)}</Text>
                  <Text style={[styles.dayDate, isPad && styles.dayDatePad]}>{day.forecastDate.slice(6, 8)}/{day.forecastDate.slice(4, 6)}</Text>
                  <Image 
                    source={{ uri: `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${day.ForecastIcon}.png` }} 
                    style={[styles.dayIcon, isPad && styles.dayIconPad]}
                  />
                  <View style={styles.dayTempCol}>
                       <Text style={[styles.maxTemp, isPad && styles.dayTempPad]}>{day.forecastMaxtemp.value}°</Text>
                       <Text style={[styles.minTemp, isPad && styles.dayTempPad]}>{day.forecastMintemp.value}°</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.creditText, isPad && styles.creditTextPad]}>Data by Hong Kong Observatory</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingTop: 90, // REVERTED TO ORIGINAL
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20, // REVERTED TO ORIGINAL
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  stationNamePad: {
    fontSize: 32,
  },
  warningBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  warningBadgePad: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  warningBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  warningBadgeTextPad: {
    fontSize: 18,
  },
  heroLayout: {
    marginBottom: 25, // REVERTED TO ORIGINAL
  },
  heroLayoutPad: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 50,
  },
  tempHero: {
    marginBottom: 10,
  },
  mainTemp: {
    color: '#FFF',
    fontSize: 72, 
    fontWeight: '200',
  },
  mainTempPad: {
    fontSize: 120,
  },
  degreeUnit: {
    fontSize: 28,
  },
  degreeUnitPad: {
    fontSize: 48,
  },
  conditionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 22,
    fontWeight: '400',
  },
  conditionTextPad: {
    fontSize: 36,
  },
  umbrellaSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 25, // REVERTED TO ORIGINAL
    alignItems: 'center',
  },
  umbrellaSectionPad: {
    padding: 30,
    minWidth: 400,
    borderRadius: 20,
    marginBottom: 50,
  },
  umbrellaItem: {
    flex: 1,
    alignItems: 'center',
  },
  dividerVertical: {
    width: 1,
    height: 35,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  umbrellaLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
  },
  umbrellaLabelPad: {
    fontSize: 18,
  },
  umbrellaValue: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  umbrellaValuePad: {
    fontSize: 22,
  },
  bodyContainer: {
    flex: 1,
  },
  rainSection: {
    marginBottom: 35, // REVERTED TO ORIGINAL
  },
  rainSectionPad: {
    marginBottom: 60,
  },
  sectionHeader: {
    marginBottom: 15, // REVERTED TO ORIGINAL
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabelPad: {
    fontSize: 20,
  },
  timelineContainer: {
    marginTop: 10,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  barValueText: {
    fontSize: 10,
    marginBottom: 4,
  },
  barValueTextPad: {
    fontSize: 16,
  },
  continuousBar: {
    borderRadius: 4,
  },
  boundaryContainer: {
    flexDirection: 'row',
    height: 45,
  },
  boundaryMark: {
    position: 'absolute',
  },
  boundaryTime: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
  },
  boundaryLabel: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
  },
  boundaryTimePad: {
    fontSize: 15,
  },
  boundaryLabelPad: {
    fontSize: 15,
  },
  boundaryTimeHighlight: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  boundaryLabelHighlight: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
  },
  forecastSection: {
    marginBottom: 35, // REVERTED TO ORIGINAL
  },
  forecastTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20, // REVERTED TO ORIGINAL
  },
  forecastTitlePad: {
    fontSize: 28,
  },
  forecastScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  forecastDay: {
    alignItems: 'center',
    marginRight: 28, // REVERTED TO ORIGINAL
  },
  forecastDayPad: {
    marginRight: 50,
  },
  dayName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dayNamePad: {
    fontSize: 22,
  },
  dayDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  dayDatePad: {
    fontSize: 16,
  },
  dayIcon: {
    width: 44,
    height: 44,
    marginVertical: 10,
  },
  dayIconPad: {
    width: 80,
    height: 80,
  },
  dayTempCol: {
    alignItems: 'center',
  },
  maxTemp: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  maxTempPad: {
    fontSize: 22,
  },
  minTemp: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontWeight: '600',
  },
  minTempPad: {
    fontSize: 22,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 30, // REVERTED TO ORIGINAL
    alignItems: 'center',
  },
  creditText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },
  creditTextPad: {
    fontSize: 16,
  },
});
