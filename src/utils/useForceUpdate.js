import { useState } from 'react';

/**
 * Force a component to re-render.
 * Use sparingly.
 */
export default () => {
  const [, setValue] = useState(0);
  return () => setValue(value => ++value); 
};
