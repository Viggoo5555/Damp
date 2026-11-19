import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ScissorsIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <path d="M8.1 7.6 19.5 18M8.1 16.4 19.5 6" />
  </Svg>
);

export const UploadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 15V4m0 0 4 4m-4-4L8 8" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Svg>
);

export const ChartIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 19h16" />
    <path d="M7 19v-6M12 19V6M17 19v-9" />
  </Svg>
);

export const SparkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 15.5 19.2 18l2.3.8-2.3.8-.7 2.4" />
  </Svg>
);

export const PlayIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const CloseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const DownloadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 4v11m0 0 4.2-4.2M12 15l-4.2-4.2" />
    <path d="M5 19h14" />
  </Svg>
);

export const FolderIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h3.2l1.8 2.2h8A1.5 1.5 0 0 1 20 9.7v7.8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-10Z" />
  </Svg>
);

export const CpuIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M10 3.5v2M14 3.5v2M10 18.5v2M14 18.5v2M3.5 10h2M3.5 14h2M18.5 10h2M18.5 14h2" />
  </Svg>
);

export const BoltIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M13.2 2.5 5 13.4h5.3L9.8 21.5 18 10.6h-5.3l.5-8.1Z" />
  </Svg>
);

export const EyeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M2.6 12S5.8 6.3 12 6.3 21.4 12 21.4 12 18.2 17.7 12 17.7 2.6 12 2.6 12Z" />
    <circle cx="12" cy="12" r="2.7" />
  </Svg>
);

export const UsersIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9.5" cy="8.5" r="3.2" />
    <path d="M3.6 19.5c.6-3 3-4.7 5.9-4.7s5.3 1.7 5.9 4.7" />
    <path d="M16.4 5.7a3 3 0 0 1 0 5.7M17.8 15.2c1.7.5 2.9 2 3.3 4.1" />
  </Svg>
);

export const WalletIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M3 10h18M16.5 14.8h1.6" />
  </Svg>
);

export const TrendUpIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 16.5 9.5 11l3.6 3.6L20 7" />
    <path d="M15 7h5v5" />
  </Svg>
);

export const TrendDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7.5 9.5 13l3.6-3.6L20 17" />
    <path d="M15 17h5v-5" />
  </Svg>
);

export const CaptionsIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M7 11h3.2M7 15h6M13.6 11H17" />
  </Svg>
);

export const CropIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 3v12a2 2 0 0 0 2 2h12" />
    <path d="M3 7h12a2 2 0 0 1 2 2v12" />
  </Svg>
);

export const ClockIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12h13m0 0-5.2-5.2M18 12l-5.2 5.2" />
  </Svg>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19 12H6m0 0 5.2-5.2M6 12l5.2 5.2" />
  </Svg>
);

export const ChipIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
    <path d="M12 9.5v5M9.5 12h5" />
  </Svg>
);

export const YoutubeMark = (props: IconProps) => (
  <Svg {...props} strokeWidth={1.5}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="M10.4 9.4v5.2l4.4-2.6-4.4-2.6Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const TwitchMark = (props: IconProps) => (
  <Svg {...props} strokeWidth={1.5}>
    <path d="M5 3.5h14v10.4l-3.8 3.8h-3.4L9.4 20H7.2v-2.3H4V6.6l1-3.1Z" />
    <path d="M10.5 8v4M14.6 8v4" />
  </Svg>
);

export const TiktokMark = (props: IconProps) => (
  <Svg {...props} strokeWidth={1.6}>
    <path d="M14.2 3.5v10.6a3.6 3.6 0 1 1-3.6-3.6c.3 0 .6 0 .9.1" />
    <path d="M14.2 5.4c.6 2 2.2 3.4 4.3 3.6" />
  </Svg>
);

export const InstagramMark = (props: IconProps) => (
  <Svg {...props} strokeWidth={1.5}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);

export const CompassIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m14.8 9.2-1.6 4.2-4.2 1.6 1.6-4.2 4.2-1.6Z" />
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="m15.4 15.4 4 4" />
  </Svg>
);

export const RadarIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <path d="M12 12 18 6" />
  </Svg>
);

export const SettingsIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
  </Svg>
);
