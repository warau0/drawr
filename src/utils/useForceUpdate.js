import { useState } from 'react';

export default () => {
  const [, setValue] = useState(0);
  return () => setValue(value => ++value); 
};
