import React, { useState, useRef } from 'react';

import imagesIcon from './images.png';
import './dropzone.css';

export default ({
  disabled,
  onFilesAdded,
}) => {
  const [highlight, setHighlight] = useState(false);

  const fileInputRef = useRef(null);

  const _onChange = (event) => {
    if (disabled) return;

    onFilesAdded(event.target.files);
    fileInputRef.current.value = '';
  };

  const _onDragOver = (evt) => {
    evt.preventDefault();
    if (disabled) return;
    setHighlight(true);
  };

  const _onDragLeave = () => {
    setHighlight(false);
  };

  const _onDrop = (event) => {
    event.preventDefault();
    if (disabled) return;

    onFilesAdded(event.dataTransfer.files);
    setHighlight(false);
    fileInputRef.current.value = '';
  };

  const _openFileDialog = () => {
    if (disabled) return;
    fileInputRef.current.click();
  };

  return (
    <div
      role='presentation'
      className={`dropzone ${highlight ? 'highlight' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={_onDragOver}
      onDragLeave={_onDragLeave}
      onDrop={_onDrop}
      onClick={_openFileDialog}
    >
      <input
        ref={fileInputRef}
        className='fileInput'
        type='file'
        multiple
        onChange={_onChange}
      />
      <div className='dropIndicator'>
        <img
          alt='upload'
          className='dropIcon'
          src={imagesIcon}
        />
        <span>Select .gz files</span>
      </div>
    </div>
  );
};
