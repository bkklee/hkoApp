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
  locationStatus?: 'granted' | 'foreground' | 'denied';
  suggestUmbrellaLongTerm?: boolean;
  longTermLabel?: string;
}

export const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ 
  station, temp, time, condition, forecast, rainfall = [], isUserLocation, locationStatus = 'granted', suggestUmbrellaLongTerm, longTermLabel = '今日' 
}) => {
  
  const { width, height } = useWindowDimensions();
  const isPad = Platform.OS === 'ios' && Platform.isPad && (width >= 768 || height >= 768);
  const isLandscape = width > height;
  const contentWidth = isPad ? Math.min(width * 0.85, 800) : width;
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getWarningStatus = (data: RainfallNowcast[]) => {
    if (!data || data.length === 0) return { color: '#4CAF50', label: '天氣良好' };
    const amounts = data.map(d => d.amount);
    const any30m = Math.max(...amounts);
    const sum60m = (amounts[0] || 0) + (amounts[1] || 0);
    const sum120m = amounts.reduce((a, b) => a + b, 0);

    if (any30m > 45 || sum60m > 70 || sum120m > 100) return { color: '#000000', label: '預測：達黑雨標準', textColor: '#FFF', borderColor: '#FFF' };
    if (any30m > 35 || sum60m > 50 || sum120m > 70) return { color: '#FF5252', label: '預測：達紅雨標準' };
    if (any30m > 20 || sum60m > 30 || sum120m > 50) return { color: '#FFEB3B', label: '預測：達黃雨標準' };
    if (any30m >= 0.05) return { color: '#40C4FF', label: '預測：有雨' };
    return { color: '#4CAF50', label: '天氣良好' };
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

  const chartPadding = isPad ? 20 : 10;
  const gapSize = isPad ? 16 : 8;
  const numBars = 4;
  const chartWidth = contentWidth - (isPad ? chartPadding * 2 : 40 + chartPadding * 2);
  const barWidth = (chartWidth - (numBars - 1) * gapSize) / numBars;

  const renderForecastItem = (day: ForecastData, i: number) => (
    <View key={i} style={isPad ? styles.forecastDayPad : styles.forecastDay}>
      <Text style={styles.dayName}>{day.week.replace('星期', '')}</Text>
      <Text style={styles.dayDateText}>{day.forecastDate.slice(6, 8)}/{day.forecastDate.slice(4, 6)}</Text>
      <Image source={{ uri: `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${day.ForecastIcon}.png` }} style={isPad && isLandscape ? styles.dayIconPadSmall : styles.dayIcon} />
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.maxTemp}>{day.forecastMaxtemp.value}°</Text>
        <Text style={styles.minTempText}>{day.forecastMintemp.value}°</Text>
      </View>
    </View>
  );

  const renderContent = () => (
    <>
      <View style={isPad ? styles.headerPad : styles.header}>
        <View style={styles.locationRow}>
          {isUserLocation && <Ionicons name="navigate-sharp" size={isPad ? 18 : 14} color={mainColor === '#000000' ? '#FFF' : mainColor} style={{ marginRight: 6 }} />}
          <Text style={isPad ? styles.stationNamePad : styles.stationName}>{station}</Text>
          
          {locationStatus === 'denied' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
              <Ionicons name="alert-circle" size={14} color="#FF5252" />
              <Text style={{ color: '#FF5252', fontSize: 11, marginLeft: 4, fontWeight: '600' }}>無權限 (無通知)</Text>
            </View>
          )}
          {locationStatus === 'foreground' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
              <Ionicons name="location" size={14} color="#FFEB3B" />
              <Text style={{ color: '#FFEB3B', fontSize: 11, marginLeft: 4, fontWeight: '600' }}>僅限使用中 (位置或不準)</Text>
            </View>
          )}
        </View>
        {status.label !== '天氣良好' && status.label !== '預測：有雨' && (
          <View style={[styles.warningBadge, { backgroundColor: mainColor, borderColor: status.borderColor || mainColor }]}>
            <Text style={[styles.warningBadgeText, { color: status.textColor || '#000' }]}>{status.label}</Text>
          </View>
        )}
      </View>

      <View style={isPad ? (isLandscape ? styles.tempHeroPadSmall : styles.tempHeroPad) : styles.tempHero}>
        <Text style={isPad ? (isLandscape ? styles.mainTempPadSmall : styles.mainTempPad) : styles.mainTemp}>{Math.round(temp)}<Text style={styles.degreeUnit}>°C</Text></Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: isPad ? 'center' : 'flex-start' }}>
          <Text style={isPad ? (isLandscape ? styles.conditionTextPadSmall : styles.conditionTextPad) : styles.conditionText}>{condition}</Text>
          <Text style={styles.dataTimeText}>  •  {formatShortTime(time)} 更新</Text>
        </View>
      </View>

      <View style={isPad ? (isLandscape ? styles.umbrellaSectionPadSmall : styles.umbrellaSectionPad) : styles.umbrellaSection}>
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

      <View style={isPad ? (isLandscape ? styles.rainSectionPadSmall : styles.rainSectionPad) : styles.rainSection}>
        <Text style={styles.sectionLabel}>未來兩小時降雨預測 (mm)</Text>
        <View style={[styles.timelineContainer, { paddingHorizontal: chartPadding }]}>
           <View style={[styles.barsContainer, { width: chartWidth, height: isPad ? (isLandscape ? 80 : 90) : 70 }]}>
            {rainfall.slice(0,4).map((item, i) => (
              <View key={i} style={{ width: barWidth, alignItems: 'center' }}>
                <Text style={styles.barValueText}>{item.amount >= 0.05 ? item.amount.toFixed(1) : '0'}</Text>
                <View style={[styles.continuousBar, { 
                  width: barWidth, 
                  height: Math.max(4, Math.min(item.amount * (isLandscape ? 30 : 35), isPad ? (isLandscape ? 80 : 90) : 70)), 
                  backgroundColor: item.amount >= 0.05 ? (mainColor === '#000000' ? '#FFF' : mainColor) : 'rgba(255,255,255,0.05)' 
                }]} />
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

      <View style={isLandscape ? styles.forecastSectionSmall : styles.forecastSection}>
        <Text style={styles.forecastTitle}>九日天氣預報</Text>
        {isPad ? (
          <View style={styles.forecastContainerPad}>
            {forecast?.slice(0, 9).map((day, i) => renderForecastItem(day, i))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {forecast?.map((day, i) => renderForecastItem(day, i))}
          </ScrollView>
        )}
      </View>

      <View style={isLandscape ? styles.footerSmall : styles.footer}>
        <Text style={styles.creditText}>Data by Hong Kong Observatory</Text>
      </View>
    </>
  );

  return (
    <View style={styles.outerContainer}>
      <StatusBar style="light" />
      {isPad ? (
        <View style={[styles.padFitContainer, { width: contentWidth, paddingTop: isLandscape ? 40 : 80 }]}>
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
  padFitContainer: { flex: 1, paddingBottom: 40, justifyContent: 'space-around' }, // Changed to space-around for balanced gaps
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerPad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  stationName: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  stationNamePad: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  warningBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  warningBadgeText: { fontSize: 10, fontWeight: '900' },
  
  permissionWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 10, marginBottom: 15 },
  permissionWarningText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 6 },

  tempHero: { marginBottom: 25 },
  tempHeroPad: { marginBottom: 20, alignItems: 'center' },
  tempHeroPadSmall: { marginBottom: 5, alignItems: 'center' },
  mainTemp: { color: '#FFF', fontSize: 72, fontWeight: '200' },
  mainTempPad: { color: '#FFF', fontSize: 90, fontWeight: '100' },
  mainTempPadSmall: { color: '#FFF', fontSize: 80, fontWeight: '100' },
  degreeUnit: { fontSize: 28 },
  conditionText: { color: 'rgba(255,255,255,0.8)', fontSize: 22 },
  conditionTextPad: { color: 'rgba(255,255,255,0.8)', fontSize: 24 },
  conditionTextPadSmall: { color: 'rgba(255,255,255,0.8)', fontSize: 22 },
  dataTimeText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: '400' },
  
  umbrellaSection: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 25, alignItems: 'center' },
  umbrellaSectionPad: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 24, marginBottom: 30, alignItems: 'center' },
  umbrellaSectionPadSmall: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 24, marginBottom: 10, alignItems: 'center' },
  umbrellaItem: { flex: 1, alignItems: 'center' },
  dividerVertical: { width: 1, height: 35, backgroundColor: 'rgba(255,255,255,0.1)' },
  umbrellaLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  umbrellaValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  
  rainSection: { marginBottom: 35 },
  rainSectionPad: { marginBottom: 30 },
  rainSectionPadSmall: { marginBottom: 15 },
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
  forecastSectionSmall: { marginBottom: 15 },
  forecastTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  forecastDay: { alignItems: 'center', marginRight: 28 },
  forecastDayPad: { alignItems: 'center', flex: 1 },
  forecastContainerPad: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  dayName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  dayDateText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  dayIcon: { width: 44, height: 44, marginVertical: 10 },
  dayIconPadSmall: { width: 36, height: 32, marginVertical: 5 },
  maxTemp: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  minTempText: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '600' },
  
  footer: { marginTop: 'auto', paddingBottom: 30, alignItems: 'center' },
  footerSmall: { marginTop: 0, paddingBottom: 10, alignItems: 'center' },
  creditText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
});
