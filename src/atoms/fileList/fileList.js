import React from 'react';

import Label from '../label/label';

import './fileList.css';

const FileList = ({ files }) => (
  <div>
    {files.map((file) => (
      <div key={file.name} className='fileLine'>
        <span className='statusContainer'>
          <Label text={file.status} brand={file.status} />
        </span>
        {file.name}
      </div>
    ))}
  </div>
);

export default FileList;
