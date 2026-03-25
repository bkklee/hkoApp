import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Animated, useWindowDimensions, Platform } from 'react-native';
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
  const anyRainInTwoHours = rainfall.some(r => r.amount >= 0.05);

  const formatShortTime = (timeStr: string) => {
    if (!timeStr || timeStr.length < 12) return '--:--';
    return `${timeStr.slice(8, 10)}:${timeStr.slice(10, 12)}`;
  };

  const formatNowTime = (d: Date) => {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getRelativeMins = (targetStr: string) => {
    if (!targetStr) return null;
    const year = parseInt(targetStr.slice(0, 4)), month = parseInt(targetStr.slice(4, 6)) - 1, day = parseInt(targetStr.slice(6, 8));
    const hours = parseInt(targetStr.slice(8, 10)), mins = parseInt(targetStr.slice(10, 12));
    const targetDate = new Date(year, month, day, hours, mins);
    const diffMins = Math.ceil((targetDate.getTime() - now.getTime()) / 60000);
    if (diffMins <= 0) return '已過';
    if (diffMins >= 60) return `${Math.floor(diffMins / 60)}h${diffMins % 60 || ''}m`;
    return `${diffMins}m`;
  };

  // --- Layout Calculations ---
  const chartPadding = isPad ? 24 : 10;
  const numBars = 4;
  const gapSize = isPad ? 20 : 8;
  const totalContentWidth = isPad ? width - 80 : width - 40;
  const rainChartWidth = isPad ? (totalContentWidth * 0.55) - chartPadding * 2 : totalContentWidth - chartPadding * 2;
  const barWidth = (rainChartWidth - (numBars - 1) * gapSize) / numBars;

  // --- iPhone Render (Original Simple Scroll) ---
  if (!isPad) {
    return (
      <View style={styles.iphoneContainer}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View style={styles.locationRow}>
            {isUserLocation && <Ionicons name="navigate-sharp" size={14} color={mainColor === '#000000' ? '#FFF' : mainColor} style={{ marginRight: 6 }} />}
            <Text style={styles.stationName}>{station}</Text>
          </View>
          {status.label !== 'ALL CLEAR' && status.label !== 'RAINING' && (
            <View style={[styles.warningBadge, { backgroundColor: mainColor, borderColor: status.borderColor || mainColor }]}>
              <Text style={[styles.warningBadgeText, { color: status.textColor || '#000' }]}>{status.label}</Text>
            </View>
          )}
        </View>

        <View style={styles.tempHero}>
          <Text style={styles.mainTemp}>{Math.round(temp)}<Text style={styles.degreeUnit}>°C</Text></Text>
          <Text style={styles.conditionText}>{condition}</Text>
        </View>

        <View style={styles.umbrellaSection}>
          <View style={styles.umbrellaItem}>
             <Ionicons name="umbrella" size={20} color={anyRainInTwoHours ? "#40C4FF" : "rgba(255,255,255,0.15)"} />
             <Text style={styles.umbrellaLabel}>兩小時內</Text>
             <Text style={[styles.umbrellaValue, { color: anyRainInTwoHours ? "#40C4FF" : "rgba(255,255,255,0.3)" }]}>{anyRainInTwoHours ? "建議帶傘" : "無須帶傘"}</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.umbrellaItem}>
             <Ionicons name="umbrella" size={20} color={suggestUmbrellaLongTerm ? "#40C4FF" : "rgba(255,255,255,0.15)"} />
             <Text style={styles.umbrellaLabel}>{longTermLabel}</Text>
             <Text style={[styles.umbrellaValue, { color: suggestUmbrellaLongTerm ? "#40C4FF" : "rgba(255,255,255,0.3)" }]}>{suggestUmbrellaLongTerm ? "建議帶傘" : "無須帶傘"}</Text>
          </View>
        </View>

        <View style={styles.rainSection}>
          <Text style={styles.sectionLabel}>未來兩小時降雨預測 (mm)</Text>
          <View style={[styles.barsContainer, { width: rainChartWidth, height: 70, marginTop: 15 }]}>
            {rainfall.slice(0,4).map((item, i) => (
              <View key={i} style={{ width: barWidth, alignItems: 'center' }}>
                <Text style={styles.barValueText}>{item.amount >= 0.05 ? item.amount.toFixed(1) : '0'}</Text>
                <View style={[styles.continuousBar, { width: barWidth, height: Math.max(4, Math.min(item.amount * 35, 70)), backgroundColor: item.amount >= 0.05 ? mainColor : 'rgba(255,255,255,0.05)' }]} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.forecastSection}>
          <Text style={styles.forecastTitle}>九日天氣預報</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {forecast?.map((day, i) => (
              <View key={i} style={styles.forecastDay}>
                <Text style={styles.dayName}>{day.week.replace('星期', '')}</Text>
                <Image source={{ uri: `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${day.ForecastIcon}.png` }} style={styles.dayIcon} />
                <Text style={styles.maxTemp}>{day.forecastMaxtemp.value}°</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  // --- iPad Dashboard Render (Everything on one page) ---
  return (
    <View style={styles.padOuterContainer}>
      <StatusBar style="light" />
      <View style={styles.padLayout}>
        
        {/* Top Row: Hero & Summary */}
        <View style={styles.padTopRow}>
          <View style={styles.padHeroCol}>
            <View style={styles.locationRow}>
              {isUserLocation && <Ionicons name="navigate-sharp" size={24} color={mainColor} style={{ marginRight: 10 }} />}
              <Text style={styles.stationNamePad}>{station}</Text>
            </View>
            <Text style={styles.mainTempPad}>{Math.round(temp)}<Text style={styles.degreeUnitPad}>°C</Text></Text>
            <Text style={styles.conditionTextPad}>{condition}</Text>
          </View>

          <View style={styles.padUmbrellaCard}>
            <View style={styles.padUmbrellaItem}>
               <Ionicons name="umbrella" size={40} color={anyRainInTwoHours ? "#40C4FF" : "rgba(255,255,255,0.1)"} />
               <View style={{ marginLeft: 20 }}>
                 <Text style={styles.padLabel}>兩小時內</Text>
                 <Text style={[styles.padValue, { color: anyRainInTwoHours ? "#40C4FF" : "#666" }]}>{anyRainInTwoHours ? "建議帶傘" : "無須帶傘"}</Text>
               </View>
            </View>
            <View style={styles.padUmbrellaItem}>
               <Ionicons name="umbrella" size={40} color={suggestUmbrellaLongTerm ? "#40C4FF" : "rgba(255,255,255,0.1)"} />
               <View style={{ marginLeft: 20 }}>
                 <Text style={styles.padLabel}>{longTermLabel}預報</Text>
                 <Text style={[styles.padValue, { color: suggestUmbrellaLongTerm ? "#40C4FF" : "#666" }]}>{suggestUmbrellaLongTerm ? "建議帶傘" : "無須帶傘"}</Text>
               </View>
            </View>
          </View>
        </View>

        {/* Bottom Row: Charts & Forecast Grid */}
        <View style={styles.padBottomRow}>
          {/* Rain Chart Box */}
          <View style={styles.padRainCard}>
            <Text style={styles.padSectionTitle}>即時降雨預測 (mm)</Text>
            <View style={[styles.barsContainer, { height: 150, marginTop: 30 }]}>
              {rainfall.slice(0,4).map((item, i) => (
                <View key={i} style={{ width: barWidth, alignItems: 'center' }}>
                  <Text style={styles.padBarValue}>{item.amount >= 0.05 ? item.amount.toFixed(1) : '0'}</Text>
                  <View style={[styles.continuousBar, { width: barWidth, borderRadius: 8, height: Math.max(10, Math.min(item.amount * 50, 150)), backgroundColor: item.amount >= 0.05 ? mainColor : 'rgba(255,255,255,0.05)' }]} />
                  <Text style={styles.padBarTime}>{formatShortTime(item.endTime)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Forecast Grid Box */}
          <View style={styles.padForecastCard}>
            <Text style={styles.padSectionTitle}>九日預報</Text>
            <View style={styles.padGrid}>
              {forecast?.slice(0, 9).map((day, i) => (
                <View key={i} style={styles.padGridItem}>
                  <Text style={styles.padGridDay}>{day.week.replace('星期', '')}</Text>
                  <Image source={{ uri: `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${day.ForecastIcon}.png` }} style={styles.padGridIcon} />
                  <Text style={styles.padGridTemp}>{day.forecastMaxtemp.value}°</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.padFooter}>Data by Hong Kong Observatory • {time}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // iPhone Original Styles
  iphoneContainer: { flex: 1, backgroundColor: '#000', paddingTop: 90, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  stationName: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  warningBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  warningBadgeText: { fontSize: 10, fontWeight: '900' },
  tempHero: { marginBottom: 25 },
  mainTemp: { color: '#FFF', fontSize: 72, fontWeight: '200' },
  degreeUnit: { fontSize: 28 },
  conditionText: { color: 'rgba(255,255,255,0.7)', fontSize: 22 },
  umbrellaSection: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 25, alignItems: 'center' },
  umbrellaItem: { flex: 1, alignItems: 'center' },
  dividerVertical: { width: 1, height: 35, backgroundColor: 'rgba(255,255,255,0.1)' },
  umbrellaLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  umbrellaValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  rainSection: { marginBottom: 35 },
  sectionLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barValueText: { fontSize: 10, marginBottom: 4, color: '#666' },
  continuousBar: { borderRadius: 4 },
  forecastSection: { marginBottom: 35 },
  forecastTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  forecastDay: { alignItems: 'center', marginRight: 28 },
  dayName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  dayIcon: { width: 44, height: 44, marginVertical: 10 },
  maxTemp: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // iPad Dashboard Styles
  padOuterContainer: { flex: 1, backgroundColor: '#000', padding: 40, justifyContent: 'center' },
  padLayout: { flex: 1, justifyContent: 'space-between' },
  padTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  padHeroCol: { flex: 1 },
  stationNamePad: { color: '#FFF', fontSize: 48, fontWeight: '900' },
  mainTempPad: { color: '#FFF', fontSize: 160, fontWeight: '100', marginVertical: -10 },
  degreeUnitPad: { fontSize: 60 },
  conditionTextPad: { color: 'rgba(255,255,255,0.6)', fontSize: 40, fontWeight: '300' },
  padUmbrellaCard: { backgroundColor: '#111', borderRadius: 30, padding: 40, width: 350, justifyContent: 'center' },
  padUmbrellaItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  padLabel: { color: '#555', fontSize: 18, fontWeight: '600' },
  padValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  padBottomRow: { flexDirection: 'row', gap: 30, flex: 1 },
  padRainCard: { flex: 1.2, backgroundColor: '#111', borderRadius: 30, padding: 30 },
  padForecastCard: { flex: 1, backgroundColor: '#111', borderRadius: 30, padding: 30 },
  padSectionTitle: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  padBarValue: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  padBarTime: { color: '#444', fontSize: 14, marginTop: 15 },
  padGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 20 },
  padGridItem: { width: '30%', backgroundColor: '#1a1a11', borderRadius: 15, padding: 15, alignItems: 'center' },
  padGridDay: { color: '#888', fontSize: 14, fontWeight: '700' },
  padGridIcon: { width: 50, height: 50, marginVertical: 5 },
  padGridTemp: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  padFooter: { color: '#222', textAlign: 'center', marginTop: 20, fontSize: 12 },
});
