import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthState = {
	isLoggedIn: boolean | undefined;
	isMpinSet: boolean | undefined;
	mpinSignedIn: boolean | undefined;
	phoneNumber: string | undefined;
	countryCode: string | undefined;
	userId: string | undefined;
	access_token: string | undefined;
	refresh_token: string | undefined;
	token_type: string | undefined;
	applicantFrom: string | undefined;
};

const initialState: AuthState = {
	isLoggedIn: undefined,
	isMpinSet: undefined,
	mpinSignedIn: undefined,
	phoneNumber: undefined,
	countryCode: undefined,
	userId: undefined,
	access_token: undefined,
	refresh_token: undefined,
	token_type: undefined,
	applicantFrom: undefined,
};

const authSlice = createSlice({
	name: "auth",
	initialState,
	reducers: {
		toggleIsLoggedIn: (state, action: PayloadAction<boolean>) => {
			state.isLoggedIn = action.payload;
		},
		toggleIsMpinSet: (state, action: PayloadAction<boolean>) => {
			state.isMpinSet = action.payload;
		},
		toggleMpinSignedIn: (state, action: PayloadAction<boolean>) => {
			state.mpinSignedIn = action.payload;
		},
		setAuthPhoneNumber: (state, action: PayloadAction<string>) => {
			state.phoneNumber = action.payload;
		},
		setAuthCountryCode: (state, action: PayloadAction<string>) => {
			state.countryCode = action.payload;
		},
		setAuthUserId: (state, action: PayloadAction<string>) => {
			state.userId = action.payload;
		},
		setAuthAccessToken: (state, action: PayloadAction<string>) => {
			state.access_token = action.payload;
		},
		setAuthRefreshToken: (state, action: PayloadAction<string>) => {
			state.refresh_token = action.payload;
		},
		setAuthTokenType: (state, action: PayloadAction<string>) => {
			state.token_type = action.payload;
		},
		setAuthApplicantFrom: (state, action: PayloadAction<string>) => {
			state.applicantFrom = action.payload;
		},
		clearAuth: (state) => {
			state.isLoggedIn = false;
			state.isMpinSet = false;
			state.mpinSignedIn = false;
			state.phoneNumber = undefined;
			state.countryCode = undefined;
			state.userId = undefined;
			state.access_token = undefined;
			state.refresh_token = undefined;
			state.token_type = undefined;
			state.applicantFrom = undefined;
		},
	},
});

export const {
	toggleIsLoggedIn,
	toggleIsMpinSet,
	toggleMpinSignedIn,
	setAuthPhoneNumber,
	setAuthCountryCode,
	setAuthUserId,
	setAuthAccessToken,
	setAuthRefreshToken,
	setAuthTokenType,
	setAuthApplicantFrom,
	clearAuth,
} = authSlice.actions;

export const authReducer = authSlice.reducer;
