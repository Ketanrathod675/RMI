import { checkPaymentStatus } from "@/utils/api";
import Logger from "@/utils/logger";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/utils/storage";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export const usePendingPaymentRecovery = () => {
	const queryClient = useQueryClient();
	useEffect(() => {
		(async () => {
			const txnId = await getStorageItem(STORAGE_KEYS["@transaction-id"]);
			if (!txnId) return;
			try {
				const res = await checkPaymentStatus(txnId);
				const s = res?.data?.status?.toUpperCase();
				if (s === "COMPLETED" || s === "FAILED" || s === "CANCELLED") {
					await removeStorageItem(STORAGE_KEYS["@transaction-id"]);
					await removeStorageItem(STORAGE_KEYS["@payment-timer-start"]);
				}
				if (s === "COMPLETED") {
					queryClient.invalidateQueries({ queryKey: ["user", "dashboard"] });
				}
				// PENDING: leave the stored id so the next launch checks again
			} catch (err) {
				Logger.warn("Pending payment check failed", err);
			}
		})();
	}, []);
};
