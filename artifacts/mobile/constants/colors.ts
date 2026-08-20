/**
 * PeptidePro design tokens — deep navy + teal pharmaceutical aesthetic.
 * Dark mode is fully supported via the `dark` key.
 */
const colors = {
  light: {
    text: '#0A1628',
    tint: '#00B4D8',
    background: '#F0F4F8',
    foreground: '#0A1628',
    card: '#FFFFFF',
    cardForeground: '#0A1628',
    primary: '#00B4D8',
    primaryForeground: '#FFFFFF',
    secondary: '#E1EFF6',
    secondaryForeground: '#0A1628',
    muted: '#EDF2F7',
    mutedForeground: '#64748B',
    accent: '#0096B4',
    accentForeground: '#FFFFFF',
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
    border: '#E2E8F0',
    input: '#E2E8F0',
    success: '#10B981',
    successForeground: '#FFFFFF',
    warning: '#F59E0B',
    warningForeground: '#FFFFFF',
  },
  dark: {
    text: '#F0F4F8',
    tint: '#00B4D8',
    background: '#0A1628',
    foreground: '#F0F4F8',
    card: '#132238',
    cardForeground: '#F0F4F8',
    primary: '#00B4D8',
    primaryForeground: '#0A1628',
    secondary: '#1E3A5F',
    secondaryForeground: '#F0F4F8',
    muted: '#1E3A5F',
    mutedForeground: '#8A9BB8',
    accent: '#00B4D8',
    accentForeground: '#0A1628',
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',
    border: '#1E3A5F',
    input: '#1E3A5F',
    success: '#10B981',
    successForeground: '#FFFFFF',
    warning: '#F59E0B',
    warningForeground: '#FFFFFF',
  },
  radius: 14,
};

export const CYCLE_COLORS = [
  { value: 'teal', label: 'Teal', color: '#00B4D8' },
  { value: 'violet', label: 'Violet', color: '#8B5CF6' },
  { value: 'rose', label: 'Rose', color: '#F43F5E' },
  { value: 'amber', label: 'Amber', color: '#F59E0B' },
  { value: 'emerald', label: 'Emerald', color: '#10B981' },
  { value: 'blue', label: 'Blue', color: '#3B82F6' },
] as const;

export const CYCLE_COLOR_FOREGROUND = '#FFFFFF';

export type CycleColor = typeof CYCLE_COLORS[number]['value'];

export function getCycleColor(value?: string | null): string {
  return CYCLE_COLORS.find((option) => option.value === value)?.color ?? CYCLE_COLORS[0].color;
}

export default colors;
