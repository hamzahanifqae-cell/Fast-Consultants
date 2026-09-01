import { type ThemePreference, useThemeStore } from '@/stores/theme-store';
import './theme-toggle.css';

type Props = {
  /** Use on dark surfaces such as the profile menu panel. */
  variant?: 'default' | 'onDark';
};

const OPTIONS: Array<{ value: ThemePreference; label: string; emoji: string }> = [
  { value: 'light', label: 'Light', emoji: '☀️' },
  { value: 'dark', label: 'Dark', emoji: '🌙' },
  { value: 'system', label: 'System', emoji: '💻' },
];

export function ThemeToggle({ variant = 'default' }: Props) {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const onDark = variant === 'onDark';

  return (
    <div className={`theme-toggle${onDark ? ' on-dark' : ''}`}>
      <span className="theme-toggle-label">Appearance</span>
      <div className="theme-toggle-row" role="group" aria-label="Theme">
        {OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`theme-toggle-chip${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => setPreference(option.value)}>
              <span className="theme-toggle-emoji" aria-hidden>
                {option.emoji}
              </span>
              <span className="theme-toggle-chip-label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
