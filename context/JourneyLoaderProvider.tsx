import VerificationLoader, {
	VerificationLoaderStep,
} from "@/components/VerificationLoader";
import {
	JOURNEY_STEPS,
	JourneyStepId,
	getCompletedBefore,
	getJourneyStep,
	getProgressPercent,
	getStepIndex,
} from "@/constants/journeySteps";
import { useTranslation } from "@/hooks/useTranslation";
import { STORAGE_KEYS } from "@/utils/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export interface StepRunHelpers {
	advanceSubStep: (subStepId: string, customSubtitle?: string) => void;
	signal: AbortSignal;
}

export interface RunStepOptions {
	subSteps?: { id: string; title: string; subtitle?: string }[];
	timeoutMs?: number;
	keepOpen?: boolean;
	minDurationMs?: number;
	treatErrorAsAttention?: boolean;
	attentionBadgeLabel?: string;
}

export interface RunStepThenNavigateOptions extends RunStepOptions {
	navigate: () => void;
	hideDelayMs?: number;
	markAttentionIf?: (result: unknown) => boolean;
	attentionBadgeLabel?: string;
}

interface JourneyLoaderContextValue {
	runStep: <T>(
		stepId: JourneyStepId,
		task: (helpers: StepRunHelpers) => Promise<T>,
		options?: RunStepOptions
	) => Promise<T>;
	runStepThenNavigate: <T>(
		stepId: JourneyStepId,
		task: (helpers: StepRunHelpers) => Promise<T>,
		options: RunStepThenNavigateOptions
	) => Promise<T>;
	show: (stepId: JourneyStepId, customSubtitle?: string) => number;
	hide: (token?: number) => void;
	markCompleted: (stepId: JourneyStepId) => void;
	markFailed: (stepId: JourneyStepId) => void;
	markAttention: (stepId: JourneyStepId, label?: string) => void;
	resetJourney: () => Promise<void>;
	completedStepIds: JourneyStepId[];
}

const JourneyLoaderContext = createContext<JourneyLoaderContextValue | null>(null);

const COMPLETED_STEPS_STORAGE_KEY = STORAGE_KEYS["@completed-journey-steps"] || "@completed-journey-steps";

export function JourneyLoaderProvider({ children }: { children: React.ReactNode }) {
	const { t } = useTranslation();

	const [visible, setVisible] = useState(false);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [failedId, setFailedId] = useState<string | null>(null);
	const [attentionId, setAttentionId] = useState<string | null>(null);
	const [attentionBadgeLabel, setAttentionBadgeLabel] = useState<string | null>(null);
	const [completedStepIds, setCompletedStepIds] = useState<JourneyStepId[]>([]);
	const [dynamicSubtitle, setDynamicSubtitle] = useState<string | undefined>(undefined);

	const ownerTokenRef = useRef(0);
	const navigatedForTokenRef = useRef<number | null>(null);

	// Load previously saved completed steps from storage on mount
	useEffect(() => {
		let isMounted = true;
		AsyncStorage.getItem(COMPLETED_STEPS_STORAGE_KEY)
			.then((raw) => {
				if (raw && isMounted) {
					try {
						const parsed = JSON.parse(raw);
						if (Array.isArray(parsed)) {
							setCompletedStepIds(parsed);
						}
					} catch {
						// ignore parse error
					}
				}
			})
			.catch(() => {});

		return () => {
			isMounted = false;
		};
	}, []);

	const persistCompletedSteps = useCallback(async (steps: JourneyStepId[]) => {
		try {
			await AsyncStorage.setItem(
				COMPLETED_STEPS_STORAGE_KEY,
				JSON.stringify(steps)
			);
		} catch {
			// ignore storage error
		}
	}, []);

	// Convert JOURNEY_STEPS to display steps with translated titles
	const stepsForDisplay: VerificationLoaderStep[] = useMemo(() => {
		return JOURNEY_STEPS.map((s) => {
			const isCurrentActive = s.id === activeId;
			const isDone = completedStepIds.includes(s.id);
			const subtitle = isCurrentActive && dynamicSubtitle
				? dynamicSubtitle
				: s.activeSubtitleKey
				? t(s.activeSubtitleKey as any, s.activeSubtitle || "")
				: s.activeSubtitle;

			const title = isDone && s.completedTitleKey
				? t(s.completedTitleKey as any, "Payment received")
				: t(s.titleKey as any, s.title);

			return {
				id: s.id,
				title,
				subtitle: subtitle || undefined,
			};
		});
	}, [activeId, dynamicSubtitle, completedStepIds, t]);

	const progressPercent = useMemo(() => {
		return getProgressPercent(completedStepIds, activeId);
	}, [completedStepIds, activeId]);

	const show = useCallback((stepId: JourneyStepId, customSubtitle?: string): number => {
		const token = ++ownerTokenRef.current;
		const completedBefore = getCompletedBefore(stepId);
		setActiveId(stepId);
		setFailedId(null);
		setAttentionId(null);
		setAttentionBadgeLabel(null);
		setDynamicSubtitle(customSubtitle);
		setVisible(true);
		setCompletedStepIds(completedBefore);
		persistCompletedSteps(completedBefore).catch(() => {});
		return token;
	}, [persistCompletedSteps]);

	const hide = useCallback((token?: number) => {
		if (token !== undefined && token !== ownerTokenRef.current) {
			return;
		}
		setVisible(false);
		setActiveId(null);
		setFailedId(null);
		setAttentionId(null);
		setAttentionBadgeLabel(null);
		setDynamicSubtitle(undefined);
	}, []);

	const markCompleted = useCallback(
		(stepId: JourneyStepId) => {
			const completedBefore = getCompletedBefore(stepId);
			const updated = Array.from(new Set([...completedBefore, stepId]));
			setCompletedStepIds(updated);
			persistCompletedSteps(updated).catch(() => {});
		},
		[persistCompletedSteps]
	);

	const markFailed = useCallback((stepId: JourneyStepId) => {
		setFailedId(stepId);
		setAttentionId(null);
		setAttentionBadgeLabel(null);
	}, []);

	const markAttention = useCallback((stepId: JourneyStepId, label?: string) => {
		setAttentionId(stepId);
		setAttentionBadgeLabel(label || null);
		setFailedId(null);
	}, []);

	const resetJourney = useCallback(async () => {
		ownerTokenRef.current += 1;
		setCompletedStepIds([]);
		setActiveId(null);
		setFailedId(null);
		setAttentionId(null);
		setAttentionBadgeLabel(null);
		setDynamicSubtitle(undefined);
		await persistCompletedSteps([]);
	}, [persistCompletedSteps]);

	const runStep = useCallback(
		async <T,>(
			stepId: JourneyStepId,
			task: (helpers: StepRunHelpers) => Promise<T>,
			options?: RunStepOptions
		): Promise<T> => {
			const token = ++ownerTokenRef.current;

			// Set UI immediately without awaiting storage
			const initialCompleted = getCompletedBefore(stepId);
			setActiveId(stepId);
			setFailedId(null);
			setAttentionId(null);
			setAttentionBadgeLabel(null);
			setDynamicSubtitle(undefined);
			setVisible(true);
			setCompletedStepIds(initialCompleted);
			persistCompletedSteps(initialCompleted).catch(() => {});

			const startTime = Date.now();
			const minActiveTime = 600;

			const advanceSubStep = (id: string, customSubtitle?: string) => {
				if (ownerTokenRef.current === token && customSubtitle) {
					setDynamicSubtitle(customSubtitle);
				}
			};

			const abortController = new AbortController();
			const timeoutMs = options?.timeoutMs ?? 60000;

			let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => {
					abortController.abort();
					reject(new Error(`Operation timed out after ${timeoutMs}ms`));
				}, timeoutMs);
			});

			try {
				const taskPromise = task({ advanceSubStep, signal: abortController.signal });
				const result = await Promise.race([taskPromise, timeoutPromise]);

				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}

				if (ownerTokenRef.current !== token) {
					return result;
				}

				const completionAnimMs = 550;
				const requiredActiveTime =
					options?.minDurationMs !== undefined
						? Math.max(minActiveTime, options.minDurationMs - completionAnimMs)
						: minActiveTime;
				const elapsed = Date.now() - startTime;
				if (elapsed < requiredActiveTime) {
					await new Promise((resolve) =>
						setTimeout(resolve, requiredActiveTime - elapsed)
					);
				}

				if (ownerTokenRef.current !== token) {
					return result;
				}

				const nextCompleted = Array.from(new Set([...initialCompleted, stepId]));
				setCompletedStepIds(nextCompleted);
				persistCompletedSteps(nextCompleted).catch(() => {});

				// Wait for tick scale-in and strikethrough animation (550ms)
				await new Promise((resolve) => setTimeout(resolve, 550));

				if (ownerTokenRef.current === token && !options?.keepOpen) {
					setVisible(false);
					setActiveId(null);
					setDynamicSubtitle(undefined);
				}

				return result;
			} catch (error) {
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}
				if (ownerTokenRef.current === token) {
					if (options?.treatErrorAsAttention || stepId === "verifying_details") {
						setAttentionId(stepId);
						setAttentionBadgeLabel(options?.attentionBadgeLabel || t("stepTakingLonger", "Taking longer than usual"));
						await new Promise((resolve) => setTimeout(resolve, 800));
						if (ownerTokenRef.current === token) {
							setVisible(false);
							setActiveId(null);
							setAttentionId(null);
							setAttentionBadgeLabel(null);
							setDynamicSubtitle(undefined);
						}
					} else {
						setFailedId(stepId);
						await new Promise((resolve) => setTimeout(resolve, 800));
						if (ownerTokenRef.current === token) {
							setVisible(false);
							setActiveId(null);
							setFailedId(null);
							setDynamicSubtitle(undefined);
						}
					}
				}
				throw error;
			}
		},
		[persistCompletedSteps, t]
	);

	const runStepThenNavigate = useCallback(
		async <T,>(
			stepId: JourneyStepId,
			task: (helpers: StepRunHelpers) => Promise<T>,
			options: RunStepThenNavigateOptions
		): Promise<T> => {
			const token = ++ownerTokenRef.current;

			// Set UI immediately without awaiting storage
			const initialCompleted = getCompletedBefore(stepId);
			setActiveId(stepId);
			setFailedId(null);
			setAttentionId(null);
			setAttentionBadgeLabel(null);
			setDynamicSubtitle(undefined);
			setVisible(true);
			setCompletedStepIds(initialCompleted);
			persistCompletedSteps(initialCompleted).catch(() => {});

			const startTime = Date.now();
			const minActiveTime = 600;

			const advanceSubStep = (id: string, customSubtitle?: string) => {
				if (ownerTokenRef.current === token && customSubtitle) {
					setDynamicSubtitle(customSubtitle);
				}
			};

			const abortController = new AbortController();
			const timeoutMs = options?.timeoutMs ?? 60000;

			let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(() => {
					abortController.abort();
					reject(new Error(`Operation timed out after ${timeoutMs}ms`));
				}, timeoutMs);
			});

			try {
				const taskPromise = task({ advanceSubStep, signal: abortController.signal });
				const result = await Promise.race([taskPromise, timeoutPromise]);

				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}

				if (ownerTokenRef.current !== token) {
					return result;
				}

				const completionAnimMs = 550;
				const requiredActiveTime =
					options?.minDurationMs !== undefined
						? Math.max(minActiveTime, options.minDurationMs - completionAnimMs)
						: minActiveTime;
				const elapsed = Date.now() - startTime;
				if (elapsed < requiredActiveTime) {
					await new Promise((resolve) =>
						setTimeout(resolve, requiredActiveTime - elapsed)
					);
				}

				if (ownerTokenRef.current !== token) {
					return result;
				}

				const needsAttention = options.markAttentionIf?.(result) === true;
				if (needsAttention) {
					setAttentionId(stepId);
					setAttentionBadgeLabel(options.attentionBadgeLabel || t("actionNeeded"));
				} else {
					const nextCompleted = Array.from(new Set([...initialCompleted, stepId]));
					setCompletedStepIds(nextCompleted);
					persistCompletedSteps(nextCompleted).catch(() => {});
				}

				// Wait for tick scale-in and strikethrough animation (550ms)
				await new Promise((resolve) => setTimeout(resolve, 550));

				if (ownerTokenRef.current === token && navigatedForTokenRef.current !== token) {
					// Navigate while loader is still visible!
					navigatedForTokenRef.current = token;
					options.navigate();

					if (!options.keepOpen) {
						const hideDelayMs = options.hideDelayMs ?? 450;
						await new Promise((resolve) => setTimeout(resolve, hideDelayMs));
						if (ownerTokenRef.current === token) {
							setVisible(false);
							setActiveId(null);
							setDynamicSubtitle(undefined);
						}
					}
				}

				return result;
			} catch (error) {
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}
				if (ownerTokenRef.current === token) {
					if (options?.treatErrorAsAttention || stepId === "verifying_details") {
						setAttentionId(stepId);
						setAttentionBadgeLabel(options?.attentionBadgeLabel || t("stepTakingLonger", "Taking longer than usual"));
						await new Promise((resolve) => setTimeout(resolve, 800));
						if (ownerTokenRef.current === token) {
							setVisible(false);
							setActiveId(null);
							setAttentionId(null);
							setAttentionBadgeLabel(null);
							setDynamicSubtitle(undefined);
						}
					} else {
						setFailedId(stepId);
						await new Promise((resolve) => setTimeout(resolve, 800));
						if (ownerTokenRef.current === token) {
							setVisible(false);
							setActiveId(null);
							setFailedId(null);
							setDynamicSubtitle(undefined);
						}
					}
				}
				throw error;
			}
		},
		[persistCompletedSteps, t]
	);

	const contextValue = useMemo<JourneyLoaderContextValue>(
		() => ({
			runStep,
			runStepThenNavigate,
			show,
			hide,
			markCompleted,
			markFailed,
			markAttention,
			resetJourney,
			completedStepIds,
		}),
		[runStep, runStepThenNavigate, show, hide, markCompleted, markFailed, markAttention, resetJourney, completedStepIds]
	);

	return (
		<JourneyLoaderContext.Provider value={contextValue}>
			{children}
			<VerificationLoader
				visible={visible}
				steps={stepsForDisplay}
				completedIds={completedStepIds}
				activeId={activeId}
				failedId={failedId}
				attentionId={attentionId}
				attentionBadgeLabel={attentionBadgeLabel}
				progressPercent={progressPercent}
			/>
		</JourneyLoaderContext.Provider>
	);
}

export function useJourneyLoader(): JourneyLoaderContextValue {
	const context = useContext(JourneyLoaderContext);
	if (!context) {
		throw new Error(
			"useJourneyLoader must be used within a JourneyLoaderProvider"
		);
	}
	return context;
}
