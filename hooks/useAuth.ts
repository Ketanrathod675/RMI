import { useAppDispatch, useAppSelector } from "@/store";
import {
	clearAuth,
	setAuthAccessToken,
	setAuthApplicantFrom,
	setAuthCountryCode,
	setAuthPhoneNumber,
	setAuthRefreshToken,
	setAuthTokenType,
	setAuthUserId,
	toggleIsLoggedIn,
	toggleIsMpinSet,
	toggleMpinSignedIn,
} from "@/store/slices/auth";
import type { SigninState } from "@/store/slices/signin";
import { decode, encode } from "@/utils/encode_decode";
import SecureStorage from "@/utils/secure-storage";
import {
	AuthKeys,
	getStorageItem,
	RemovableKeys,
	removeMultipleStorageItems,
	setStorageItem,
	STORAGE_KEYS,
} from "@/utils/storage";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

export const PhoneNumberSchema = z.string().regex(/^[6-9]\d{9}$/);
export type PhoneNumberSchemaType = z.infer<typeof PhoneNumberSchema>;

export const CountryCodeSchema = z.string().regex(/^\+\d{1,3}$/);
export type CountryCodeSchemaType = z.infer<typeof CountryCodeSchema>;

let activeAuthPromise: Promise<boolean> | null = null;

export const useAuth = (shouldAutoLoad = false) => {
	const [isLoading, setIsLoading] = useState(true);
	const dispatch = useAppDispatch();

	const isLoggedIn = useAppSelector((state) => state.auth.isLoggedIn);
	const isMpinSet = useAppSelector((state) => state.auth.isMpinSet);
	const mpinSignedIn = useAppSelector((state) => state.auth.mpinSignedIn);
	const phoneNumber = useAppSelector((state) => state.auth.phoneNumber);
	const countryCode = useAppSelector((state) => state.auth.countryCode);
	const userId = useAppSelector((state) => state.auth.userId);
	const accessToken = useAppSelector((state) => state.auth.access_token);
	const refreshToken = useAppSelector((state) => state.auth.refresh_token);
	const tokenType = useAppSelector((state) => state.auth.token_type);
	const applicantFrom = useAppSelector((state) => state.auth.applicantFrom);

	const loadAuth = useCallback(async (): Promise<boolean> => {
		if (isLoggedIn === true) {
			setIsLoading(false);
			return true;
		}

		if (activeAuthPromise) {
			try {
				return await activeAuthPromise;
			} catch {
				return false;
			}
		}

		activeAuthPromise = (async () => {
			try {
				setIsLoading(true);

				// 1. Fresh install check
				const appInstalledFlag = await getStorageItem(STORAGE_KEYS["@app-installed-flag"]);
				if (!appInstalledFlag) {
					await removeMultipleStorageItems(AuthKeys);
					dispatch(clearAuth());
					await setStorageItem(STORAGE_KEYS["@app-installed-flag"], encode("true"));
					await setStorageItem(STORAGE_KEYS["@app-version"], encode("1.0.0"));
					setIsLoading(false);
					return false;
				}

				// 2. Read stored auth session values (sanitized without logging sensitive data)
				const isLoggedInVal = await getStorageItem(STORAGE_KEYS["@is-logged-in"]);
				const refreshTokenVal = await SecureStorage.getSensitiveWithLegacyMigration(STORAGE_KEYS["@refresh-token"]);
				const countryCodeVal = await getStorageItem(STORAGE_KEYS["@country-code"]);
				const phoneNumberVal = await getStorageItem(STORAGE_KEYS["@phone-number"]);

				if (
					!isLoggedInVal ||
					decode(isLoggedInVal) !== "true" ||
					!refreshTokenVal ||
					!countryCodeVal ||
					!phoneNumberVal
				) {
					dispatch(clearAuth());
					setIsLoading(false);
					return false;
				}

				const decodedCountry = decode(countryCodeVal);
				const decodedPhone = decode(phoneNumberVal);

				const parsedCountry = CountryCodeSchema.safeParse(decodedCountry);
				const parsedPhone = PhoneNumberSchema.safeParse(decodedPhone);

				if (!parsedCountry.success || !parsedPhone.success) {
					dispatch(clearAuth());
					setIsLoading(false);
					return false;
				}

				const decodedRefreshToken = refreshTokenVal;
				const accessTokenVal = await SecureStorage.getSensitiveWithLegacyMigration(STORAGE_KEYS["@access-token"]);
				const tokenTypeVal = await getStorageItem(STORAGE_KEYS["@token-type"]);
				const userIdVal = await getStorageItem(STORAGE_KEYS["@user-id"]);
				const applicantFromVal = await getStorageItem(STORAGE_KEYS["@applicant-from"]);

				// Hydrate Redux state securely
				if (accessTokenVal) dispatch(setAuthAccessToken(accessTokenVal));
				if (decodedRefreshToken) dispatch(setAuthRefreshToken(decodedRefreshToken));
				if (tokenTypeVal) dispatch(setAuthTokenType(decode(tokenTypeVal)));
				if (userIdVal) dispatch(setAuthUserId(decode(userIdVal)));
				if (applicantFromVal) dispatch(setAuthApplicantFrom(decode(applicantFromVal)));

				dispatch(setAuthCountryCode(parsedCountry.data));
				dispatch(setAuthPhoneNumber(parsedPhone.data));
				dispatch(toggleIsMpinSet(true));
				dispatch(toggleIsLoggedIn(true));

				setIsLoading(false);
				return true;
			} catch (error) {
				await removeMultipleStorageItems(AuthKeys);
				dispatch(clearAuth());
				setIsLoading(false);
				return false;
			} finally {
				activeAuthPromise = null;
			}
		})();

		return await activeAuthPromise;
	}, [dispatch, isLoggedIn]);

	const validateMobileAndCountryCode = useCallback(
		(code: CountryCodeSchemaType, phone: PhoneNumberSchemaType) => {
			const parsedCountryCode = CountryCodeSchema.safeParse(code);
			const parsedPhoneNumber = PhoneNumberSchema.safeParse(phone);

			return {
				countryCode: parsedCountryCode,
				phoneNumber: parsedPhoneNumber,
			};
		},
		[]
	);

	const handleLoginAndSignup = useCallback(
		(
			countryCodeVal: NonNullable<SigninState["countryCode"]>,
			phoneNumberVal: NonNullable<SigninState["phoneNumber"]>,
			userIdVal: string
		) => {
			const parsedPhoneNumber = PhoneNumberSchema.safeParse(phoneNumberVal);
			if (!parsedPhoneNumber.success) {
				return false;
			}

			let parsedCountryCode = CountryCodeSchema.safeParse(countryCodeVal);
			if (!parsedCountryCode.success) {
				parsedCountryCode = CountryCodeSchema.safeParse("+91");
			}

			setStorageItem(STORAGE_KEYS["@country-code"], encode(parsedCountryCode.data!));
			setStorageItem(STORAGE_KEYS["@phone-number"], encode(parsedPhoneNumber.data!));
			setStorageItem(STORAGE_KEYS["@is-logged-in"], encode("true"));
			setStorageItem(STORAGE_KEYS["@user-id"], encode(userIdVal));

			dispatch(setAuthCountryCode(parsedCountryCode.data!));
			dispatch(setAuthPhoneNumber(parsedPhoneNumber.data!));
			dispatch(setAuthUserId(userIdVal));
			dispatch(toggleIsLoggedIn(true));

			return true;
		},
		[dispatch]
	);

	const handleSetTokens = useCallback(
		async (accessTokenVal?: string, refreshTokenVal?: string, tokenTypeVal?: string) => {
			if (!accessTokenVal || !refreshTokenVal || !tokenTypeVal) {
				return false;
			}

			await SecureStorage.setSensitive(STORAGE_KEYS["@access-token"], accessTokenVal);
			await SecureStorage.setSensitive(STORAGE_KEYS["@token"], accessTokenVal);
			await SecureStorage.setSensitive(STORAGE_KEYS["@refresh-token"], refreshTokenVal);
			await setStorageItem(STORAGE_KEYS["@token-type"], encode(tokenTypeVal));

			dispatch(setAuthAccessToken(accessTokenVal));
			dispatch(setAuthRefreshToken(refreshTokenVal));
			dispatch(setAuthTokenType(tokenTypeVal));

			return true;
		},
		[dispatch]
	);

	const handleMpinSet = useCallback(() => {
		setStorageItem(STORAGE_KEYS["@is-mpin-set"], encode("true"));
		dispatch(toggleIsMpinSet(true));
	}, [dispatch]);

	const logout = useCallback(() => {
		void Promise.all([SecureStorage.clearAllTokens(), removeMultipleStorageItems(RemovableKeys)]);
		dispatch(clearAuth());
	}, [dispatch]);

	useEffect(() => {
		if (shouldAutoLoad) {
			loadAuth();
		}
	}, [loadAuth, shouldAutoLoad]);

	return {
		isLoggedIn: isLoggedIn ?? false,
		isMpinSet: (isMpinSet && phoneNumber != null) ?? false,
		mpinSignedIn: mpinSignedIn ?? false,
		phoneNumber,
		countryCode,
		userId,
		accessToken,
		refreshToken,
		tokenType,
		applicantFrom,
		isLoading,
		loadAuth,
		validateMobileAndCountryCode,
		handleLoginAndSignup,
		handleSetTokens,
		handleMpinSet,
		logout,
	};
};

export default useAuth;
