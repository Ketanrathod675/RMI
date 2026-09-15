import { useMutation, type UseMutationOptions, type UseMutationResult } from "@tanstack/react-query";

export function useNetworkAwareMutation<
	TData = unknown,
	TError = Error,
	TVariables = void,
	TContext = unknown,
>(
	options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
	return useMutation(options);
}

export default useNetworkAwareMutation;
