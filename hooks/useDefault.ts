import {
	languageSchema,
	setLanguage as setLang,
	toggleLanguageSet,
	useDispatch,
	type Languages,
	type RootState,
} from "@/store";
import { changeLanguage } from "@/utils/api";
import Logger from "@/utils/logger";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useCallback, useEffect } from "react";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";
import { useTranslation } from "./useTranslation";

// Backend has no users/change-language endpoint (new backend). Language is a local UI setting.
// Flip to true only after a backend endpoint exists and is wired into changeLanguage().
const SYNC_LANGUAGE_TO_BACKEND = false;

export const useDefault = () => {
	const languageSet = useSelector((state: RootState) => state.global.languageSet);
	const language = useSelector((state: RootState) => state.global.language);
	const dispatch = useDispatch();
	const { t } = useTranslation();

	const setLanguage = useCallback(
		async (lang: Languages, _callApi = false) => {
			try {
				await setStorageItem(STORAGE_KEYS["@set-language"], lang);
				dispatch(setLang(lang));
				dispatch(toggleLanguageSet(true));

				if (SYNC_LANGUAGE_TO_BACKEND) {
					changeLanguage(lang === "english" ? "English" : "Hindi").catch((err) => {
						Logger.warn("Background language sync failed", { error: err });
					});
				}
			} catch (error) {
				Logger.warn("Language update failed", { code: "language_update_failed" });
				Toast.show({
					type: "error",
					text1: t("failedToUpdateLanguage"),
					text2: t("pleaseRetryLanguageUpdate"),
				});
			}
		},
		[dispatch, t],
	);

	const loadLanguage = useCallback(async () => {
		const language = await getStorageItem(STORAGE_KEYS["@set-language"]);

		if (!language) {
			dispatch(toggleLanguageSet(false));
			dispatch(setLang("english"));
			return;
		}

		const validLanguage = languageSchema.safeParse(language);

		dispatch(toggleLanguageSet(true));

		if (validLanguage.success) {
			dispatch(setLang(validLanguage.data));
			return;
		}

		dispatch(setLang("english"));
	}, [dispatch]);

	useEffect(() => {
		loadLanguage();
	}, [loadLanguage]);

	return {
		languageSet,
		loadLanguage,
		setLanguage,
		language,
	};
};
