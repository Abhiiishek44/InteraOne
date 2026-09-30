interface IntegrationIconProps {
  className?: string;
}

export function FacebookLogo({ className = "" }: IntegrationIconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#1877F2" />
      <path
        fill="#fff"
        d="M32.6 30.4 33.7 24h-6.1v-4.2c0-1.8.9-3.5 3.6-3.5H34v-5.5s-2.5-.4-4.9-.4c-5 0-8.3 3-8.3 8.6v5h-5.6v6.4h5.6V46a22.4 22.4 0 0 0 6.8 0V30.4h5Z"
      />
    </svg>
  );
}

export function GoogleFormsLogo({ className = "" }: IntegrationIconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#7248B9" d="M10 3h19l10 10v32H10z" />
      <path fill="#A487D5" d="M29 3v10h10z" />
      <g fill="#fff">
        <rect x="16" y="21" width="4" height="4" rx="1" />
        <rect x="23" y="21" width="10" height="3" rx="1.5" />
        <rect x="16" y="29" width="4" height="4" rx="1" />
        <rect x="23" y="29" width="10" height="3" rx="1.5" />
        <rect x="16" y="37" width="4" height="4" rx="1" />
        <rect x="23" y="37" width="10" height="3" rx="1.5" />
      </g>
    </svg>
  );
}

export function GoogleCalendarLogo({ className = "" }: IntegrationIconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#fff" d="M8 6h32v36H8z" />
      <path fill="#4285F4" d="M40 18H8V6h32z" />
      <path fill="#34A853" d="M8 18h9v24H8z" />
      <path fill="#FBBC04" d="M17 33h23v9H17z" />
      <path fill="#EA4335" d="M31 18h9v15h-9z" />
      <path
        fill="#4285F4"
        d="M19.5 28.5c0-4.3 3-7.4 7.2-7.4 2.5 0 4.3 1 5.5 2.2l-2 2c-.8-.8-2-1.4-3.5-1.4-2.4 0-4.3 2-4.3 4.6s1.9 4.6 4.3 4.6c1.6 0 2.5-.6 3.1-1.2.5-.5.8-1.2.9-2.2h-4v-2.7h6.7c.1.4.1.9.1 1.5 0 1.6-.4 3.6-1.9 5.1-1.4 1.5-3.2 2.3-5.5 2.3-4 0-6.6-3.3-6.6-7.4Z"
      />
    </svg>
  );
}

export function GoogleTasksLogo({ className = "" }: IntegrationIconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="#4285F4" />
      <path
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
        d="m14 24 6 6 14-14"
      />
    </svg>
  );
}
