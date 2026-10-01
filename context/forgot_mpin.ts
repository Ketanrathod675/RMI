import { createContext, type Dispatch, type SetStateAction } from "react";

export const ForgotMpinContext = createContext<{
	countryCode: string;
	setCountryCode: Dispatch<SetStateAction<string>>;
	phoneNumber: string;
	setPhoneNumber: Dispatch<SetStateAction<string>>;
	otpVerified: boolean;
	setOtpVerified: Dispatch<SetStateAction<boolean>>;
}>({
	countryCode: "+91",
	setCountryCode: () => {},
	phoneNumber: "",
	setPhoneNumber: () => {},
	otpVerified: false,
	setOtpVerified: () => {},
});
