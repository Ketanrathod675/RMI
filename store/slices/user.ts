import type { Notifications } from "@/utils/api";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type UserSliceType = {
	notifications: Notifications | undefined;
	transactionId: string | undefined;
	applicationComplete: boolean;
};

const initialState: UserSliceType = {
	notifications: undefined,
	transactionId: undefined,
	applicationComplete: false,
};

const userSlice = createSlice({
	name: "user",
	initialState,
	reducers: {
		setNotifications: (
			state,
			action: PayloadAction<NonNullable<UserSliceType["notifications"]>>,
		) => {
			state.notifications = action.payload;
		},
		clearNotifications: (state) => {
			state.notifications = undefined;
		},
		setTransactionId: (
			state,
			action: PayloadAction<NonNullable<UserSliceType["transactionId"]>>,
		) => {
			state.transactionId = action.payload;
		},
		clearTransactionId: (state) => {
			state.transactionId = undefined;
		},
		setApplicationComplete: (
			state,
			action: PayloadAction<NonNullable<UserSliceType["applicationComplete"]>>,
		) => {
			state.applicationComplete = action.payload;
		},
		clearApplicationComplete: (state) => {
			state.applicationComplete = false;
		},
	},
});

export const {
	setNotifications,
	clearNotifications,
	setTransactionId,
	clearTransactionId,
	setApplicationComplete,
	clearApplicationComplete,
} = userSlice.actions;

export const userReducer = userSlice.reducer;
