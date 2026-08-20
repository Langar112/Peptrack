import React from 'react';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

interface TabIconProps {
  size?: number;
  color: string;
}

export function CalculatorIcon({ size = 24, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4.5" y="2.5" width="15" height="19" rx="2" stroke={color} strokeWidth="1.8" />
      <Rect x="7.5" y="5" width="9" height="3" rx="0.8" stroke={color} strokeWidth="1.5" />
      <Rect x="7.5" y="10.5" width="2.2" height="2.2" rx="0.5" fill={color} />
      <Rect x="10.9" y="10.5" width="2.2" height="2.2" rx="0.5" fill={color} />
      <Rect x="14.3" y="10.5" width="2.2" height="2.2" rx="0.5" fill={color} />
      <Rect x="7.5" y="14.4" width="2.2" height="2.2" rx="0.5" fill={color} />
      <Rect x="10.9" y="14.4" width="2.2" height="2.2" rx="0.5" fill={color} />
      <Rect x="14.3" y="14.4" width="2.2" height="4" rx="0.5" fill={color} />
    </Svg>
  );
}

export function CalendarNumberIcon({ size = 24, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="4.5" width="17" height="16" rx="2" stroke={color} strokeWidth="1.8" />
      <Line x1="7.5" y1="2.8" x2="7.5" y2="6.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="16.5" y1="2.8" x2="16.5" y2="6.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="3.8" y1="8.5" x2="20.2" y2="8.5" stroke={color} strokeWidth="1.5" />
      <SvgText x="12" y="16.6" fill={color} fontSize="6.5" fontWeight="700" textAnchor="middle">
        7
      </SvgText>
    </Svg>
  );
}

export function JournalIcon({ size = 24, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 5.2c2.5-.8 5.1-.3 7.5 1.2v13c-2.4-1.5-5-2-7.5-1.2V5.2Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path
        d="M19.5 5.2c-2.5-.8-5.1-.3-7.5 1.2v13c2.4-1.5 5-2 7.5-1.2V5.2Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Line x1="7" y1="9.5" x2="10" y2="10.3" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <Line x1="7" y1="12.2" x2="10" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <Line x1="14" y1="10.3" x2="17" y2="9.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <Line x1="14" y1="13" x2="17" y2="12.2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}

export function CycleIcon({ size = 20, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 9a5.8 5.8 0 0 1 9.7-3.8L18 7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14.8 7H18V3.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M17.5 15a5.8 5.8 0 0 1-9.7 3.8L6 17"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9.2 17H6v3.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}