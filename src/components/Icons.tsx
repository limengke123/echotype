type IconProps = {
  size?: number;
  className?: string;
};

function base(size: number, className: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    className,
    "aria-hidden": true as const,
  };
}

export function IconPlay({ size = 22, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M8.5 5.6v12.8L19 12 8.5 5.6Z" fill="currentColor" />
    </svg>
  );
}

export function IconSpeaker({ size = 22, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
      <path
        d="M15.5 8.6a4.6 4.6 0 0 1 0 6.8M18.2 6.2a8 8 0 0 1 0 11.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconGear({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 14.2a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSparkles({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M12 3.5 13.6 8 18 9.6 13.6 11.2 12 15.7 10.4 11.2 6 9.6 10.4 8 12 3.5Z"
        fill="currentColor"
      />
      <path
        d="M18.6 14.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z"
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}

export function IconCheck({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClose({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconRefresh({ size = 16, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconWave({ size = 28, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M3 12h1.6M8 7.5v9M12.5 4v16M17 8.5v7M21.5 11v2"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconHistory({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M12 7v5l3.2 2M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.5 4.5V9H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrash({ size = 16, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M4.5 7h15M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconArrowLeft({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
