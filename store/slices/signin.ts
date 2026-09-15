import type { CountryCodeSchemaType, PhoneNumberSchemaType } from "@/hooks/useAuth";
import type { LoginResponseType, VerifyOtpResponseType } from "@/utils/api";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type SigninState = {
	countryCode: CountryCodeSchemaType | undefined;
	phoneNumber: PhoneNumberSchemaType | undefined;
	loginResponse: LoginResponseType | undefined;
	otpVerifyResponse: VerifyOtpResponseType | undefined;
};

const initialState: SigninState = {
	countryCode: undefined,
	phoneNumber: undefined,
	loginResponse: undefined,
	otpVerifyResponse: undefined,
};

const signinSlice = createSlice({
	name: "signin",
	initialState,
	reducers: {
		setCountryCode: (
			state,
			payload: NonNullable<PayloadAction<SigninState["countryCode"]>>,
		) => {
			state.countryCode = payload.payload;
		},
		clearCountryCode: (state) => {
			state.countryCode = undefined;
		},
		setPhoneNumber: (
			state,
			payload: NonNullable<PayloadAction<SigninState["phoneNumber"]>>,
		) => {
			state.phoneNumber = payload.payload;
		},
		clearPhoneNumber: (state) => {
			state.phoneNumber = undefined;
		},
		setLoginResponse: (
			state,
			payload: NonNullable<PayloadAction<SigninState["loginResponse"]>>,
		) => {
			state.loginResponse = payload.payload;
		},
		clearLoginResponse: (state) => {
			state.loginResponse = undefined;
		},
		setOtpVerifyResponse: (
			state,
			payload: NonNullable<PayloadAction<SigninState["otpVerifyResponse"]>>,
		) => {
			state.otpVerifyResponse = payload.payload;
		},
		clearOtpVerifyResponse: (state) => {
			state.otpVerifyResponse = undefined;
		},
	},
});

export const {
	setCountryCode,
	clearCountryCode,
	setPhoneNumber,
	clearPhoneNumber,
	setLoginResponse,
	clearLoginResponse,
	setOtpVerifyResponse,
	clearOtpVerifyResponse,
} = signinSlice.actions;

export const signinReducer = signinSlice.reducer;
