let navigationTimer = null;

/**
 * Throttle a function call.
 */
export default (func, delay) => {
	if (navigationTimer) return; // Already firing.
  func();

	navigationTimer = setTimeout(() => {
		navigationTimer = null;
	}, delay);
};
