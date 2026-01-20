'use client';

import { useState } from 'react';

interface ItemImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ItemImage({ src, alt, className = '' }: ItemImageProps) {
  const defaultImage = '/images/no-image.png';
  const [imgSrc, setImgSrc] = useState(src || defaultImage);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(defaultImage);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
