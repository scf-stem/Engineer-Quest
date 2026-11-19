import React from 'react';

export function StoryFigure({ asset, caption = asset.caption, variant = 'scene', className = '' }) {
  return <figure className={`eq-story-figure eq-story-figure--${variant} ${className}`}>
    <img src={asset.src} alt={asset.alt} width={asset.width} height={asset.height} loading="lazy" decoding="async"/>
    {caption && <figcaption>{caption}</figcaption>}
  </figure>;
}
