export type CountryOption = {
  name: string;
  iso: string;
  dial: string;
  flag: string;
};

export const COUNTRIES: CountryOption[] = [
  { name: 'Afghanistan', iso: 'AF', dial: '+93', flag: '🇦🇫' },
  { name: 'Albania', iso: 'AL', dial: '+355', flag: '🇦🇱' },
  { name: 'Algeria', iso: 'DZ', dial: '+213', flag: '🇩🇿' },
  { name: 'Argentina', iso: 'AR', dial: '+54', flag: '🇦🇷' },
  { name: 'Armenia', iso: 'AM', dial: '+374', flag: '🇦🇲' },
  { name: 'Australia', iso: 'AU', dial: '+61', flag: '🇦🇺' },
  { name: 'Austria', iso: 'AT', dial: '+43', flag: '🇦🇹' },
  { name: 'Azerbaijan', iso: 'AZ', dial: '+994', flag: '🇦🇿' },
  { name: 'Bahrain', iso: 'BH', dial: '+973', flag: '🇧🇭' },
  { name: 'Bangladesh', iso: 'BD', dial: '+880', flag: '🇧🇩' },
  { name: 'Belarus', iso: 'BY', dial: '+375', flag: '🇧🇾' },
  { name: 'Belgium', iso: 'BE', dial: '+32', flag: '🇧🇪' },
  { name: 'Bhutan', iso: 'BT', dial: '+975', flag: '🇧🇹' },
  { name: 'Bolivia', iso: 'BO', dial: '+591', flag: '🇧🇴' },
  { name: 'Bosnia and Herzegovina', iso: 'BA', dial: '+387', flag: '🇧🇦' },
  { name: 'Brazil', iso: 'BR', dial: '+55', flag: '🇧🇷' },
  { name: 'Brunei', iso: 'BN', dial: '+673', flag: '🇧🇳' },
  { name: 'Bulgaria', iso: 'BG', dial: '+359', flag: '🇧🇬' },
  { name: 'Cambodia', iso: 'KH', dial: '+855', flag: '🇰🇭' },
  { name: 'Cameroon', iso: 'CM', dial: '+237', flag: '🇨🇲' },
  { name: 'Canada', iso: 'CA', dial: '+1', flag: '🇨🇦' },
  { name: 'Chile', iso: 'CL', dial: '+56', flag: '🇨🇱' },
  { name: 'China', iso: 'CN', dial: '+86', flag: '🇨🇳' },
  { name: 'Colombia', iso: 'CO', dial: '+57', flag: '🇨🇴' },
  { name: 'Croatia', iso: 'HR', dial: '+385', flag: '🇭🇷' },
  { name: 'Cyprus', iso: 'CY', dial: '+357', flag: '🇨🇾' },
  { name: 'Czech Republic', iso: 'CZ', dial: '+420', flag: '🇨🇿' },
  { name: 'Denmark', iso: 'DK', dial: '+45', flag: '🇩🇰' },
  { name: 'Egypt', iso: 'EG', dial: '+20', flag: '🇪🇬' },
  { name: 'Estonia', iso: 'EE', dial: '+372', flag: '🇪🇪' },
  { name: 'Ethiopia', iso: 'ET', dial: '+251', flag: '🇪🇹' },
  { name: 'Finland', iso: 'FI', dial: '+358', flag: '🇫🇮' },
  { name: 'France', iso: 'FR', dial: '+33', flag: '🇫🇷' },
  { name: 'Georgia', iso: 'GE', dial: '+995', flag: '🇬🇪' },
  { name: 'Germany', iso: 'DE', dial: '+49', flag: '🇩🇪' },
  { name: 'Ghana', iso: 'GH', dial: '+233', flag: '🇬🇭' },
  { name: 'Greece', iso: 'GR', dial: '+30', flag: '🇬🇷' },
  { name: 'Hong Kong', iso: 'HK', dial: '+852', flag: '🇭🇰' },
  { name: 'Hungary', iso: 'HU', dial: '+36', flag: '🇭🇺' },
  { name: 'Iceland', iso: 'IS', dial: '+354', flag: '🇮🇸' },
  { name: 'India', iso: 'IN', dial: '+91', flag: '🇮🇳' },
  { name: 'Indonesia', iso: 'ID', dial: '+62', flag: '🇮🇩' },
  { name: 'Iran', iso: 'IR', dial: '+98', flag: '🇮🇷' },
  { name: 'Iraq', iso: 'IQ', dial: '+964', flag: '🇮🇶' },
  { name: 'Ireland', iso: 'IE', dial: '+353', flag: '🇮🇪' },
  { name: 'Italy', iso: 'IT', dial: '+39', flag: '🇮🇹' },
  { name: 'Japan', iso: 'JP', dial: '+81', flag: '🇯🇵' },
  { name: 'Jordan', iso: 'JO', dial: '+962', flag: '🇯🇴' },
  { name: 'Kazakhstan', iso: 'KZ', dial: '+7', flag: '🇰🇿' },
  { name: 'Kenya', iso: 'KE', dial: '+254', flag: '🇰🇪' },
  { name: 'Kuwait', iso: 'KW', dial: '+965', flag: '🇰🇼' },
  { name: 'Kyrgyzstan', iso: 'KG', dial: '+996', flag: '🇰🇬' },
  { name: 'Latvia', iso: 'LV', dial: '+371', flag: '🇱🇻' },
  { name: 'Lebanon', iso: 'LB', dial: '+961', flag: '🇱🇧' },
  { name: 'Libya', iso: 'LY', dial: '+218', flag: '🇱🇾' },
  { name: 'Lithuania', iso: 'LT', dial: '+370', flag: '🇱🇹' },
  { name: 'Luxembourg', iso: 'LU', dial: '+352', flag: '🇱🇺' },
  { name: 'Malaysia', iso: 'MY', dial: '+60', flag: '🇲🇾' },
  { name: 'Maldives', iso: 'MV', dial: '+960', flag: '🇲🇻' },
  { name: 'Malta', iso: 'MT', dial: '+356', flag: '🇲🇹' },
  { name: 'Mexico', iso: 'MX', dial: '+52', flag: '🇲🇽' },
  { name: 'Morocco', iso: 'MA', dial: '+212', flag: '🇲🇦' },
  { name: 'Nepal', iso: 'NP', dial: '+977', flag: '🇳🇵' },
  { name: 'Netherlands', iso: 'NL', dial: '+31', flag: '🇳🇱' },
  { name: 'New Zealand', iso: 'NZ', dial: '+64', flag: '🇳🇿' },
  { name: 'Nigeria', iso: 'NG', dial: '+234', flag: '🇳🇬' },
  { name: 'Norway', iso: 'NO', dial: '+47', flag: '🇳🇴' },
  { name: 'Oman', iso: 'OM', dial: '+968', flag: '🇴🇲' },
  { name: 'Pakistan', iso: 'PK', dial: '+92', flag: '🇵🇰' },
  { name: 'Palestine', iso: 'PS', dial: '+970', flag: '🇵🇸' },
  { name: 'Philippines', iso: 'PH', dial: '+63', flag: '🇵🇭' },
  { name: 'Poland', iso: 'PL', dial: '+48', flag: '🇵🇱' },
  { name: 'Portugal', iso: 'PT', dial: '+351', flag: '🇵🇹' },
  { name: 'Qatar', iso: 'QA', dial: '+974', flag: '🇶🇦' },
  { name: 'Romania', iso: 'RO', dial: '+40', flag: '🇷🇴' },
  { name: 'Russia', iso: 'RU', dial: '+7', flag: '🇷🇺' },
  { name: 'Saudi Arabia', iso: 'SA', dial: '+966', flag: '🇸🇦' },
  { name: 'Serbia', iso: 'RS', dial: '+381', flag: '🇷🇸' },
  { name: 'Singapore', iso: 'SG', dial: '+65', flag: '🇸🇬' },
  { name: 'Slovakia', iso: 'SK', dial: '+421', flag: '🇸🇰' },
  { name: 'Slovenia', iso: 'SI', dial: '+386', flag: '🇸🇮' },
  { name: 'South Africa', iso: 'ZA', dial: '+27', flag: '🇿🇦' },
  { name: 'South Korea', iso: 'KR', dial: '+82', flag: '🇰🇷' },
  { name: 'Spain', iso: 'ES', dial: '+34', flag: '🇪🇸' },
  { name: 'Sri Lanka', iso: 'LK', dial: '+94', flag: '🇱🇰' },
  { name: 'Sweden', iso: 'SE', dial: '+46', flag: '🇸🇪' },
  { name: 'Switzerland', iso: 'CH', dial: '+41', flag: '🇨🇭' },
  { name: 'Syria', iso: 'SY', dial: '+963', flag: '🇸🇾' },
  { name: 'Taiwan', iso: 'TW', dial: '+886', flag: '🇹🇼' },
  { name: 'Tajikistan', iso: 'TJ', dial: '+992', flag: '🇹🇯' },
  { name: 'Thailand', iso: 'TH', dial: '+66', flag: '🇹🇭' },
  { name: 'Tunisia', iso: 'TN', dial: '+216', flag: '🇹🇳' },
  { name: 'Turkey', iso: 'TR', dial: '+90', flag: '🇹🇷' },
  { name: 'Turkmenistan', iso: 'TM', dial: '+993', flag: '🇹🇲' },
  { name: 'Ukraine', iso: 'UA', dial: '+380', flag: '🇺🇦' },
  { name: 'United Arab Emirates', iso: 'AE', dial: '+971', flag: '🇦🇪' },
  { name: 'United Kingdom', iso: 'GB', dial: '+44', flag: '🇬🇧' },
  { name: 'United States', iso: 'US', dial: '+1', flag: '🇺🇸' },
  { name: 'Uzbekistan', iso: 'UZ', dial: '+998', flag: '🇺🇿' },
  { name: 'Vietnam', iso: 'VN', dial: '+84', flag: '🇻🇳' },
  { name: 'Yemen', iso: 'YE', dial: '+967', flag: '🇾🇪' },
];

export const DEFAULT_DIAL = '+92';

const DIAL_SORTED = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function findCountryByDial(dial: string) {
  return COUNTRIES.find((country) => country.dial === dial) ?? COUNTRIES.find((country) => country.iso === 'PK');
}

export function splitPhone(phone: string | null | undefined): { dial: string; number: string } {
  const raw = (phone ?? '').replace(/\s+/g, '');
  if (!raw) {
    return { dial: DEFAULT_DIAL, number: '' };
  }

  const withPlus = raw.startsWith('+') ? raw : `+${raw}`;
  const match = DIAL_SORTED.find((country) => withPlus.startsWith(country.dial));
  if (match) {
    return { dial: match.dial, number: withPlus.slice(match.dial.length) };
  }

  return { dial: DEFAULT_DIAL, number: raw.replace(/^\+/, '') };
}

export function joinPhone(dial: string, number: string) {
  const digits = number.replace(/[^\d]/g, '');
  if (!digits) {
    return '';
  }

  return `${dial}${digits}`;
}
