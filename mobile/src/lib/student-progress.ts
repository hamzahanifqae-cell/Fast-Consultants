export type StudentSectionKey =
  | 'personal'
  | 'documents'
  | 'universities'
  | 'fees'
  | 'interview'
  | 'visa'
  | 'status';

export type StudentSectionProgress = {
  percent: number;
  complete: boolean;
  report: string;
  meta: string;
};

export type StudentProgressRow = {
  id: number;
  name: string;
  email: string;
  current_status: string;
  overall_percent: number;
  sections: Record<StudentSectionKey, StudentSectionProgress>;
};

export const STUDENT_PROGRESS_SECTIONS: Array<{
  key: StudentSectionKey;
  label: string;
  color: string;
}> = [
  { key: 'personal', label: 'Personal', color: '#FFD6E8' },
  { key: 'documents', label: 'Documents', color: '#FFF3C1' },
  { key: 'universities', label: 'Universities', color: '#C1F2D0' },
  { key: 'fees', label: 'Fees', color: '#E0D7FF' },
  { key: 'interview', label: 'Interview', color: '#FFD6E8' },
  { key: 'visa', label: 'Visa', color: '#E0D7FF' },
  { key: 'status', label: 'Status', color: '#FFF3C1' },
];

type Rgb = { r: number; g: number; b: number };

const JOURNEY_COLOR_STOPS: Array<{ at: number; color: Rgb }> = [
  { at: 0, color: { r: 239, g: 68, b: 68 } },
  { at: 50, color: { r: 245, g: 158, b: 11 } },
  { at: 100, color: { r: 16, g: 185, b: 129 } },
];

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function shiftRgb(color: Rgb, amount: number): Rgb {
  return {
    r: Math.max(0, Math.min(255, Math.round(color.r + (255 - color.r) * amount))),
    g: Math.max(0, Math.min(255, Math.round(color.g + (255 - color.g) * amount))),
    b: Math.max(0, Math.min(255, Math.round(color.b + (255 - color.b) * amount))),
  };
}

function rgbToHex(color: Rgb): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function journeyBaseColor(percent: number): Rgb {
  const value = Math.max(0, Math.min(100, percent));

  for (let index = 0; index < JOURNEY_COLOR_STOPS.length - 1; index += 1) {
    const start = JOURNEY_COLOR_STOPS[index];
    const end = JOURNEY_COLOR_STOPS[index + 1];
    if (value >= start.at && value <= end.at) {
      const t = (value - start.at) / (end.at - start.at);
      return mixRgb(start.color, end.color, t);
    }
  }

  return JOURNEY_COLOR_STOPS[JOURNEY_COLOR_STOPS.length - 1].color;
}

export type JourneyProgressPalette = {
  fillStart: string;
  fillEnd: string;
  track: string;
};

export function journeyProgressPalette(percent: number): JourneyProgressPalette {
  const base = journeyBaseColor(percent);
  const fillStart = rgbToHex(shiftRgb(base, 0.28));
  const fillEnd = rgbToHex(base);

  return {
    fillStart,
    fillEnd,
    track: `${fillEnd}22`,
  };
}
