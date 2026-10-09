import { useCallback, useEffect, useRef } from "react";
import {
	Keyboard,
	Platform,
	type KeyboardEvent,
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	type ScrollView,
} from "react-native";

export interface RegisterFieldOptions {
	parentOffset?: number;
}

export function useFormScroll() {
	const scrollRef = useRef<ScrollView>(null);
	const fieldOffsets = useRef<Record<string, number>>({});
	const fieldElements = useRef<Record<string, any>>({});
	const fieldInputRefs = useRef<Record<string, React.RefObject<any> | any>>({});

	// Scroll threshold tracking for dismissing keyboard when scrolling a lot
	const dragStartY = useRef(0);
	const isDragging = useRef(false);
	const currentScrollY = useRef(0);
	const activeFieldKey = useRef<string | null>(null);

	const registerField = useCallback(
		(
			key: string,
			inputRefOrOptions?: React.RefObject<any> | any | RegisterFieldOptions,
			options?: RegisterFieldOptions,
		) => {
			let inputRef: React.RefObject<any> | any | undefined;
			let resolvedOptions: RegisterFieldOptions | undefined = options;

			if (inputRefOrOptions) {
				if ("current" in inputRefOrOptions) {
					inputRef = inputRefOrOptions;
				} else if ("parentOffset" in inputRefOrOptions) {
					resolvedOptions = inputRefOrOptions as RegisterFieldOptions;
				}
			}

			if (inputRef) {
				fieldInputRefs.current[key] = inputRef;
			}

			return {
				ref: (node: any) => {
					if (node) {
						fieldElements.current[key] = node;
					}
				},
				collapsable: false,
				onLayout: (event: LayoutChangeEvent) => {
					const y = event.nativeEvent.layout.y + (resolvedOptions?.parentOffset ?? 0);
					fieldOffsets.current[key] = y;
				},
			};
		},
		[],
	);

	const scrollToField = useCallback(
		(
			key: string,
			inputRef?: React.RefObject<any> | any,
			shouldFocus: boolean = false,
		) => {
			activeFieldKey.current = key;
			const targetRef = inputRef || fieldInputRefs.current[key];
			const targetElement = fieldElements.current[key];
			const scrollNode = scrollRef.current;

			const focusIfNeeded = () => {
				if (
					shouldFocus &&
					targetRef?.current &&
					typeof targetRef.current.focus === "function"
				) {
					setTimeout(() => {
						try {
							targetRef.current?.focus();
						} catch {
							// Ignore focus errors
						}
					}, 250);
				}
			};

			const performScroll = (targetY: number) => {
				scrollRef.current?.scrollTo({
					y: Math.max(0, targetY - 24),
					animated: true,
				});
				focusIfNeeded();
			};

			const fallbackMeasureLayout = () => {
				if (targetElement && scrollNode && typeof targetElement.measureLayout === "function") {
					try {
						targetElement.measureLayout(
							scrollNode,
							(_left: number, top: number) => {
								fieldOffsets.current[key] = top;
								performScroll(top);
							},
							() => {
								const fallbackY = fieldOffsets.current[key] ?? 0;
								performScroll(fallbackY);
							},
						);
						return;
					} catch {
						// Fallback to recorded layout y
					}
				}

				const fallbackY = fieldOffsets.current[key] ?? 0;
				performScroll(fallbackY);
			};

			const anyScrollNode = scrollNode as any;
			if (
				targetElement &&
				typeof targetElement.measure === "function" &&
				anyScrollNode &&
				typeof anyScrollNode.measure === "function"
			) {
				try {
					targetElement.measure(
						(_x: number, _y: number, _w: number, _h: number, _px: number, pageY: number) => {
							if (typeof pageY !== "number" || pageY <= 0) {
								fallbackMeasureLayout();
								return;
							}
							anyScrollNode.measure(
								(
									_sx: number,
									_sy: number,
									_sw: number,
									_sh: number,
									_spx: number,
									scrollPageY: number,
								) => {
									if (typeof scrollPageY !== "number") {
										fallbackMeasureLayout();
										return;
									}
									const distanceInView = pageY - scrollPageY;
									const targetScrollY = currentScrollY.current + distanceInView;
									performScroll(targetScrollY);
								},
							);
						},
					);
					return;
				} catch {
					fallbackMeasureLayout();
					return;
				}
			}

			fallbackMeasureLayout();
		},
		[],
	);

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const sub = Keyboard.addListener(showEvent, (_e: KeyboardEvent) => {
			if (activeFieldKey.current) {
				const currentKey = activeFieldKey.current;
				setTimeout(() => {
					if (activeFieldKey.current === currentKey) {
						scrollToField(currentKey);
					}
				}, 100);
			}
		});

		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
		const hideSub = Keyboard.addListener(hideEvent, () => {
			activeFieldKey.current = null;
		});

		return () => {
			sub.remove();
			hideSub.remove();
		};
	}, [scrollToField]);

	const scrollToFirstError = useCallback(
		(
			errors: Record<string, any>,
			orderedKeys: string[],
			inputRefs?: Record<string, React.RefObject<any> | any>,
		) => {
			for (const key of orderedKeys) {
				const errorVal = errors[key];
				const hasError =
					typeof errorVal === "string" ? errorVal.trim().length > 0 : Boolean(errorVal);

				if (hasError) {
					const refToFocus = inputRefs?.[key] || fieldInputRefs.current[key];
					const isTextInput =
						refToFocus?.current && typeof refToFocus.current.focus === "function";

					if (!isTextInput) {
						Keyboard.dismiss();
					}

					scrollToField(key, refToFocus, true);
					return key;
				}
			}
			return null;
		},
		[scrollToField],
	);

	const onScrollBeginDrag = useCallback(
		(e: NativeSyntheticEvent<NativeScrollEvent>) => {
			dragStartY.current = e.nativeEvent?.contentOffset?.y ?? 0;
			isDragging.current = true;
		},
		[],
	);

	const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
		const currentY = e.nativeEvent?.contentOffset?.y ?? 0;
		currentScrollY.current = currentY;

		if (isDragging.current) {
			const delta = Math.abs(currentY - dragStartY.current);
			// Dismiss keyboard only if user scrolls significantly (> 75px)
			if (delta > 75) {
				Keyboard.dismiss();
				isDragging.current = false;
			}
		}
	}, []);

	const onScrollEndDrag = useCallback(() => {
		isDragging.current = false;
	}, []);

	const scrollProps = {
		scrollEventThrottle: 16,
		onScrollBeginDrag,
		onScroll,
		onScrollEndDrag,
		keyboardShouldPersistTaps: "handled" as const,
		keyboardDismissMode: "none" as const,
	};

	return {
		scrollRef,
		scrollProps,
		registerField,
		scrollToField,
		scrollToFirstError,
	};
}

export default useFormScroll;
