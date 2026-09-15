import {
	languageSchema,
	setLanguage as setLang,
	toggleLanguageSet,
	useDispatch,
	type Languages,
	type RootState,
} from "@/store";
import { changeLanguage, errorHandler } from "@/utils/api";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useCallback, useEffect } from "react";
import Toast from "react-native-toast-message";
import { useSelector } from "react-redux";
import { useNetworkAwareMutation } from "./useNetworkAwareMutation";
import { useTranslation } from "./useTranslation";

export const useDefault = () => {
	const languageSet = useSelector((state: RootState) => state.global.languageSet);
	const language = useSelector((state: RootState) => state.global.language);

	const { mutate: updateLanguage } = useNetworkAwareMutation({
		mutationFn: changeLanguage,
	});

	const dispatch = useDispatch();
	const { t } = useTranslation();

	const setLanguage = useCallback(
		async (lang: Languages, call_api = true) => {
			console.log("lang", lang);

			const onSuccess = async () => {
				await setStorageItem(STORAGE_KEYS["@set-language"], lang);

				dispatch(setLang(lang));
				dispatch(toggleLanguageSet(true));
			};

			if (!call_api) {
				await onSuccess();
				return;
			}

			updateLanguage(lang === "english" ? "English" : "Hindi", {
				onSuccess,
				onError: (err, variables, ctx) => {
					const { error } = errorHandler(err, variables, ctx);

					setTimeout(() => {
						Toast.show({
							type: "error",
							text1: t("failedToUpdateLanguage"),
							text2: error?.message ?? t("pleaseRetryLanguageUpdate"),
						});
					}, 200);
				},
			});
		},
		[dispatch, updateLanguage, t],
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
