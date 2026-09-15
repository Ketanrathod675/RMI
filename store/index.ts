import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { authReducer } from "./slices/auth";
import { globalReducer, type Languages } from "./slices/global";
import { signinReducer } from "./slices/signin";
import { userReducer } from "./slices/user";

export const LANGUAGES: { key: Languages; label: string; sub: string; disabled?: boolean }[] = [
	{ key: "english", label: "English", sub: "English" },
	{ key: "hindi", label: "Hindi", sub: "हिंदी", disabled: false },
];

export const store = configureStore({
	reducer: {
		auth: authReducer,
		global: globalReducer,
		signin: signinReducer,
		user: userReducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: false,
		}),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export { useDispatch, useSelector } from "react-redux";

export * from "./slices/auth";
export * from "./slices/global";
export * from "./slices/signin";
export * from "./slices/user";
