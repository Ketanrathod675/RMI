import { useMutation, type MutateOptions, type UseMutationOptions, type UseMutationResult } from "@tanstack/react-query";
import { createOfflineError, isDeviceConnected } from "@/hooks/useNetworkStatus";
import { useRef } from "react";

export function useNetworkAwareMutation<
	TData = unknown,
	TError = Error,
	TVariables = void,
	TContext = unknown,
>(
	options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
	const inFlightPromiseRef = useRef<Promise<TData | undefined> | null>(null);

	const mutation = useMutation({
		...options,
		networkMode: "always",
		mutationFn: async (variables, context) => {
			if (!isDeviceConnected()) throw createOfflineError();
			if (!options.mutationFn) throw createOfflineError();
			return options.mutationFn(variables, context);
		},
		onSettled: async (...args) => {
			try {
				await options.onSettled?.(...args);
			} finally {
				inFlightPromiseRef.current = null;
			}
		},
	});

	const mutate = (variables: TVariables, mutateOptions?: MutateOptions<TData, TError, TVariables, TContext>) => {
		if (inFlightPromiseRef.current) return;
		mutation.mutate(variables, mutateOptions);
	};


	const mutateAsync = async (variables: TVariables, mutateOptions?: MutateOptions<TData, TError, TVariables, TContext>): Promise<TData> => {
		// Second tap while in-flight is silently ignored: return the pending promise
		if (inFlightPromiseRef.current) {
			return inFlightPromiseRef.current as Promise<TData>;
		}
		if (!isDeviceConnected()) throw createOfflineError();
		const promise = (async () => {
			try {
				return await mutation.mutateAsync(variables, mutateOptions);
			} finally {
				inFlightPromiseRef.current = null;
			}
		})();
		inFlightPromiseRef.current = promise;
		return promise;
	};

	return { ...mutation, mutate, mutateAsync } as UseMutationResult<TData, TError, TVariables, TContext>;
}

export default useNetworkAwareMutation;

