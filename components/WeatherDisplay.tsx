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
  const contentWidth = isPad ? Math.min(width * 0.85, 800) : width;
  
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
    if (diffMins >= 60) {
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return m > 0 ? `${h}h${m}m` : `${h}h`;
    }
    return `${diffMins}m`;
  };

  const chartPadding = isPad ? 20 : 10;
  const gapSize = isPad ? 16 : 8;
  const numBars = 4;
  const chartWidth = contentWidth - (isPad ? chartPadding * 2 : 40 + chartPadding * 2);
  const barWidth = (chartWidth - (numBars - 1) * gapSize) / numBars;

  const renderContent = () => (
    <>
      <View style={isPad ? styles.headerPad : styles.header}>
        <View style={styles.locationRow}>
          {isUserLocation && <Ionicons name="navigate-sharp" size={isPad ? 18 : 14} color={mainColor === '#000000' ? '#FFF' : mainColor} style={{ marginRight: 6 }} />}
          <Text style={isPad ? styles.stationNamePad : styles.stationName}>{station}</Text>
        </View>
        {status.label !== 'ALL CLEAR' && status.label !== 'RAINING' && (
          <View style={[styles.warningBadge, { backgroundColor: mainColor, borderColor: status.borderColor || mainColor }]}>
            <Text style={[styles.warningBadgeText, { color: status.textColor || '#000' }]}>{status.label}</Text>
          </View>
        )}
      </View>

      <View style={isPad ? styles.tempHeroPad : styles.tempHero}>
        <Text style={isPad ? styles.mainTempPad : styles.mainTemp}>{Math.round(temp)}<Text style={styles.degreeUnit}>°C</Text></Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: isPad ? 'center' : 'flex-start' }}>
          <Text style={isPad ? styles.conditionTextPad : styles.conditionText}>{condition}</Text>
          <Text style={styles.dataTimeText}>  •  {formatShortTime(time)} 更新</Text>
        </View>
      </View>

      <View style={isPad ? styles.umbrellaSectionPad : styles.umbrellaSection}>
        <View style={styles.umbrellaItem}>
           <Ionicons name="umbrella" size={isPad ? 24 : 20} color={anyRainInTwoHours ? "#40C4FF" : "rgba(255,255,255,0.15)"} />
           <Text style={styles.umbrellaLabel}>兩小時內</Text>
           <Text style={[styles.umbrellaValue, { color: anyRainInTwoHours ? "#40C4FF" : "rgba(255,255,255,0.3)" }]}>{anyRainInTwoHours ? "建議帶傘" : "無須帶傘"}</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.umbrellaItem}>
           <Ionicons name="umbrella" size={isPad ? 24 : 20} color={suggestUmbrellaLongTerm ? "#40C4FF" : "rgba(255,255,255,0.15)"} />
           <Text style={styles.umbrellaLabel}>{longTermLabel}</Text>
           <Text style={[styles.umbrellaValue, { color: suggestUmbrellaLongTerm ? "#40C4FF" : "rgba(255,255,255,0.3)" }]}>{suggestUmbrellaLongTerm ? "建議帶傘" : "無須帶傘"}</Text>
        </View>
      </View>

      <View style={isPad ? styles.rainSectionPad : styles.rainSection}>
        <Text style={styles.sectionLabel}>未來兩小時降雨預測 (mm)</Text>
        <View style={[styles.timelineContainer, { paddingHorizontal: chartPadding }]}>
           <View style={[styles.barsContainer, { width: chartWidth, height: isPad ? 90 : 70 }]}>
            {rainfall.slice(0,4).map((item, i) => (
              <View key={i} style={{ width: barWidth, alignItems: 'center' }}>
                <Text style={styles.barValueText}>{item.amount >= 0.05 ? item.amount.toFixed(1) : '0'}</Text>
                <View style={[styles.continuousBar, { width: barWidth, height: Math.max(4, Math.min(item.amount * (isPad ? 35 : 35), isPad ? 90 : 70)), backgroundColor: item.amount >= 0.05 ? mainColor : 'rgba(255,255,255,0.05)' }]} />
              </View>
            ))}
          </View>

          <View style={[styles.boundaryContainer, { width: chartWidth }]}>
             <View style={[styles.boundaryMark, { left: 0, alignItems: 'flex-start' }]}>
                <Text style={styles.boundaryTimeHighlight}>{formatNowTime(now)}</Text>
                <Text style={styles.boundaryLabelHighlight}>現在</Text>
             </View>
             {rainfall.slice(0,4).map((item, i) => {
               const isLast = i === 3;
               const pos = isLast ? chartWidth : (i + 1) * barWidth + (i + 0.5) * gapSize;
               return (
                 <View key={i} style={[styles.boundaryMark, { 
                   left: isLast ? undefined : pos - 30,
                   right: isLast ? 0 : undefined,
                   alignItems: isLast ? 'flex-end' : 'center'
                 }]}>
                    <Text style={styles.boundaryTime}>{formatShortTime(item.endTime)}</Text>
                    <Text style={styles.boundaryLabel}>{getRelativeMins(item.endTime)}</Text>
                 </View>
               );
             })}
          </View>
        </View>
      </View>

      <View style={styles.forecastSection}>
        <Text style={styles.forecastTitle}>九日天氣預報</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {forecast?.map((day, i) => (
            <View key={i} style={styles.forecastDay}>
              <Text style={styles.dayName}>{day.week.replace('星期', '')}</Text>
              <Text style={styles.dayDateText}>{day.forecastDate.slice(6, 8)}/{day.forecastDate.slice(4, 6)}</Text>
              <Image source={{ uri: `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${day.ForecastIcon}.png` }} style={styles.dayIcon} />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.maxTemp}>{day.forecastMaxtemp.value}°</Text>
                <Text style={styles.minTempText}>{day.forecastMintemp.value}°</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Text style={styles.creditText}>Data by Hong Kong Observatory</Text>
      </View>
    </>
  );

  return (
    <View style={styles.outerContainer}>
      <StatusBar style="light" />
      {isPad ? (
        <View style={[styles.padFitContainer, { width: contentWidth }]}>
          {renderContent()}
        </View>
      ) : (
        <ScrollView style={styles.iphoneContainer} showsVerticalScrollIndicator={false}>
          {renderContent()}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  iphoneContainer: { flex: 1, width: '100%', paddingTop: 90, paddingHorizontal: 20 },
  padFitContainer: { flex: 1, paddingTop: 80, paddingBottom: 60, justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerPad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  stationName: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  stationNamePad: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  warningBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  warningBadgeText: { fontSize: 10, fontWeight: '900' },
  tempHero: { marginBottom: 25 },
  tempHeroPad: { marginBottom: 20, alignItems: 'center' },
  mainTemp: { color: '#FFF', fontSize: 72, fontWeight: '200' },
  mainTempPad: { color: '#FFF', fontSize: 90, fontWeight: '100' },
  degreeUnit: { fontSize: 28 },
  conditionText: { color: 'rgba(255,255,255,0.8)', fontSize: 22 },
  conditionTextPad: { color: 'rgba(255,255,255,0.8)', fontSize: 24 },
  dataTimeText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '400' },
  umbrellaSection: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 25, alignItems: 'center' },
  umbrellaSectionPad: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 24, marginBottom: 30, alignItems: 'center' },
  umbrellaItem: { flex: 1, alignItems: 'center' },
  dividerVertical: { width: 1, height: 35, backgroundColor: 'rgba(255,255,255,0.1)' },
  umbrellaLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  umbrellaValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  rainSection: { marginBottom: 35 },
  rainSectionPad: { marginBottom: 30 },
  sectionLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  timelineContainer: { marginTop: 15 },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  barValueText: { fontSize: 10, marginBottom: 4, color: '#666' },
  continuousBar: { borderRadius: 4 },
  boundaryContainer: { flexDirection: 'row', height: 45, position: 'relative' },
  boundaryMark: { position: 'absolute', width: 60 },
  boundaryTime: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  boundaryLabel: { color: 'rgba(255,255,255,0.2)', fontSize: 10 },
  boundaryTimeHighlight: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  boundaryLabelHighlight: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' },
  forecastSection: { marginBottom: 35 },
  forecastTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  forecastDay: { alignItems: 'center', marginRight: 28 },
  dayName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  dayDateText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  dayIcon: { width: 44, height: 44, marginVertical: 10 },
  maxTemp: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  minTempText: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 'auto', paddingBottom: 30, alignItems: 'center' },
  creditText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
});
