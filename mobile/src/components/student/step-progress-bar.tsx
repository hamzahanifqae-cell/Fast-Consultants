import { FluidProgressBar } from '@/components/student/fluid-progress-bar';

type StepProgressBarProps = {
  label: string;
  percent: number;
  loading?: boolean;
};

export function StepProgressBar({ label, percent, loading = false }: StepProgressBarProps) {
  return (
    <FluidProgressBar
      label={label}
      loading={loading}
      minFillPercent={8}
      percent={percent}
      variant="on-red"
    />
  );
}
