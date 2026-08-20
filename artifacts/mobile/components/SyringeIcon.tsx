import React from 'react';
import Svg, { Line, Path } from 'react-native-svg';

interface SyringeIconProps {
  size?: number;
  color: string;
}

export function SyringeIcon({ size = 24, color }: SyringeIconProps) {
  const strokeWidth = 1.9;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.2 15.4 14.8 7.8l2.8 2.8-7.6 7.6-2.8-2.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Line x1="5.6" y1="20.4" x2="8.7" y2="17.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="3.5" y1="20.5" x2="5.5" y2="20.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="8.6" y1="14" x2="11.8" y2="17.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="11" y1="11.6" x2="14.2" y2="14.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="16.2" y1="6.4" x2="19.6" y2="3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="17.8" y1="4.8" x2="21" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}