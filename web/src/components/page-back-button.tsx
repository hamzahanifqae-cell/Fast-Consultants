import { Link } from 'react-router-dom';

type LinkProps = {
  to: string;
  label?: string;
  onClick?: never;
};

type ButtonProps = {
  onClick: () => void;
  label?: string;
  to?: never;
};

type Props = (LinkProps | ButtonProps) & {
  className?: string;
};

export function PageBackButton({ label = 'Back', className, ...rest }: Props) {
  const classes = `page-back-btn${className ? ` ${className}` : ''}`;

  if ('to' in rest && rest.to) {
    return (
      <Link to={rest.to} className={classes}>
        ← {label}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} onClick={rest.onClick}>
      ← {label}
    </button>
  );
}
