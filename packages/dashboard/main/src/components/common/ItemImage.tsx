'use client';

import { useState } from 'react';

interface ItemImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ItemImage({ src, alt, className = '' }: ItemImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc('/images/no-image.svg');
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
