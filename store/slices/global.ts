import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { z } from "zod";

export const languageSchema = z.enum(["english", "hindi"]);
export const mpinSchema = z.enum(["true", "false"]);

export type Languages = z.infer<typeof languageSchema>;
export type Mpin = z.infer<typeof mpinSchema>;

export type GlobalState = {
	languageSet: boolean;
	language: Languages;
	notificationsChecked: boolean;
	isOnline: boolean;
	hasCompletedStartup: boolean;
};

const initialState: GlobalState = {
	languageSet: false,
	language: "english",
	notificationsChecked: false,
	isOnline: true,
	hasCompletedStartup: false,
};

const globalSlice = createSlice({
	name: "global",
	initialState,
	reducers: {
		toggleLanguageSet: (
			state,
			payload: PayloadAction<GlobalState["languageSet"]>,
		) => {
			state.languageSet = payload.payload;
		},
		setLanguage: (state, payload: PayloadAction<GlobalState["language"]>) => {
			state.language = payload.payload;
			state.languageSet = true;
		},
		setNotificationsChecked: (
			state,
			payload: PayloadAction<GlobalState["notificationsChecked"]>,
		) => {
			state.notificationsChecked = payload.payload;
		},
		setOnlineStatus: (state, action: PayloadAction<boolean>) => {
			state.isOnline = action.payload;
		},
		setStartupCompleted: (state, action: PayloadAction<boolean>) => {
			state.hasCompletedStartup = action.payload;
		},
	},
});

export const {
	toggleLanguageSet,
	setLanguage,
	setNotificationsChecked,
	setOnlineStatus,
	setStartupCompleted,
} = globalSlice.actions;

export const globalReducer = globalSlice.reducer;
