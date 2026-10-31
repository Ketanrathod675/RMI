import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { createOfflineError, isDeviceConnected } from "@/hooks/useNetworkStatus";

export function useNetworkAwareQuery<
	TQueryFnData = unknown,
	TError = Error,
	TData = TQueryFnData,
	TQueryKey extends readonly unknown[] = readonly unknown[],
>(options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>): UseQueryResult<TData, TError> {
	return useQuery({
		...options,
		networkMode: "always",
		queryFn: async (context) => {
			if (!isDeviceConnected()) throw createOfflineError();
			if (typeof options.queryFn !== "function") throw createOfflineError();
			return options.queryFn(context);
		},
	});
}

export default useNetworkAwareQuery;

