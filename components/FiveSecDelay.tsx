/**
 * @deprecated FiveSecDelay is deprecated. Use VerificationLoader or useJourneyLoader() instead.
 */
import VerificationLoader, {
	VerificationLoaderProps,
	VerificationLoaderStep,
} from "./VerificationLoader";

if (__DEV__) {
	console.warn(
		"⚠️ [DEPRECATION] FiveSecDelay is deprecated. Please migrate to useJourneyLoader() or VerificationLoader."
	);
}

export type { VerificationLoaderProps as FiveSecDelayProps, VerificationLoaderStep };
export { VerificationLoader };
export default VerificationLoader;
