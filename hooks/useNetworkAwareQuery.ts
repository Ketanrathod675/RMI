import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

export function useNetworkAwareQuery<
	TQueryFnData = unknown,
	TError = Error,
	TData = TQueryFnData,
	TQueryKey extends readonly unknown[] = readonly unknown[],
>(options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>): UseQueryResult<TData, TError> {
	return useQuery(options);
}

export default useNetworkAwareQuery;
