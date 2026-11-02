import React from 'react';
import logoImg from '../../assets/logo.png';

interface AppLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AppLogo: React.FC<AppLogoProps> = ({ size = 40, className, style }) => {
  return (
    <img
      src={logoImg}
      alt="Zukaping"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style,
      }}
      onError={(e) => {
        // Fallback to public root path if bundled asset fails
        (e.currentTarget as HTMLImageElement).src = '/logo.png';
      }}
    />
  );
};
