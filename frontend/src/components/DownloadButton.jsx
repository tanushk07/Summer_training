import React from 'react';

function DownloadButton({ url, label = 'Download', className = '' }) {
  return (
    <a href={url} className={className} target="_blank" rel="noopener noreferrer" download>
      {label}
    </a>
  );
}

export default DownloadButton;
