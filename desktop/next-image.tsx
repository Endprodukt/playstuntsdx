import type { CSSProperties, ImgHTMLAttributes } from 'react';

type DesktopImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  unoptimized?: boolean;
  priority?: boolean;
  fill?: boolean;
  quality?: number;
};

export default function Image({
  unoptimized: _unoptimized,
  priority: _priority,
  fill = false,
  quality: _quality,
  style,
  width,
  height,
  ...props
}: DesktopImageProps) {
  const fillStyle: CSSProperties | undefined = fill
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }
    : style;

  return (
    <img
      {...props}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={fillStyle}
    />
  );
}
