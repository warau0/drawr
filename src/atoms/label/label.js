import React, { memo } from 'react';

import './label.css';

const Label = memo(({ text, brand }) => (
  <span className={`label ${brand}`}>{text}</span>
));

export default Label;
