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
}

export interface RunStepOptions {
	subSteps?: { id: string; title: string; subtitle?: string }[];
	timeoutMs?: number;
	keepOpen?: boolean;
}

interface JourneyLoaderContextValue {
	runStep: <T>(
		stepId: JourneyStepId,
		task: (helpers: StepRunHelpers) => Promise<T>,
		options?: RunStepOptions
	) => Promise<T>;
	advance: (subStepId?: string) => Promise<void>;
	show: (stepId: JourneyStepId, customSubtitle?: string) => void;
	hide: () => void;
	setActive: (stepId: JourneyStepId) => void;
	markCompleted: (stepId: JourneyStepId) => void;
	markFailed: (stepId: JourneyStepId) => void;
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
	const [completedStepIds, setCompletedStepIds] = useState<JourneyStepId[]>([]);
	const [dynamicSubtitle, setDynamicSubtitle] = useState<string | undefined>(undefined);

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
			const subtitle = isCurrentActive && dynamicSubtitle
				? dynamicSubtitle
				: s.activeSubtitleKey
				? t(s.activeSubtitleKey as any, s.activeSubtitle || "")
				: s.activeSubtitle;

			return {
				id: s.id,
				title: t(s.titleKey as any, s.title),
				subtitle: subtitle || undefined,
			};
		});
	}, [activeId, dynamicSubtitle, t]);

	const progressPercent = useMemo(() => {
		return getProgressPercent(completedStepIds, activeId);
	}, [completedStepIds, activeId]);

	const show = useCallback((stepId: JourneyStepId, customSubtitle?: string) => {
		const completedBefore = getCompletedBefore(stepId);
		setCompletedStepIds(completedBefore);
		persistCompletedSteps(completedBefore);
		setActiveId(stepId);
		setFailedId(null);
		setDynamicSubtitle(customSubtitle);
		setVisible(true);
	}, [persistCompletedSteps]);

	const hide = useCallback(() => {
		setVisible(false);
		setActiveId(null);
		setFailedId(null);
		setDynamicSubtitle(undefined);
	}, []);

	const setActive = useCallback((stepId: JourneyStepId) => {
		setActiveId(stepId);
	}, []);

	const markCompleted = useCallback(
		(stepId: JourneyStepId) => {
			const completedBefore = getCompletedBefore(stepId);
			const updated = Array.from(new Set([...completedBefore, stepId]));
			setCompletedStepIds(updated);
			persistCompletedSteps(updated);
		},
		[persistCompletedSteps]
	);

	const markFailed = useCallback((stepId: JourneyStepId) => {
		setFailedId(stepId);
	}, []);

	const resetJourney = useCallback(async () => {
		setCompletedStepIds([]);
		setActiveId(null);
		setFailedId(null);
		setDynamicSubtitle(undefined);
		await persistCompletedSteps([]);
	}, [persistCompletedSteps]);

	const advance = useCallback(async (subStepId?: string) => {
		if (subStepId) {
			setDynamicSubtitle(subStepId);
		}
	}, []);

	const runStep = useCallback(
		async <T,>(
			stepId: JourneyStepId,
			task: (helpers: StepRunHelpers) => Promise<T>,
			options?: RunStepOptions
		): Promise<T> => {
			// 1. Current step is running, so strictly preceding steps are completed.
			// The current step itself and any future steps are NOT completed yet.
			const initialCompleted = getCompletedBefore(stepId);
			setCompletedStepIds(initialCompleted);
			await persistCompletedSteps(initialCompleted);

			setActiveId(stepId);
			setFailedId(null);
			setDynamicSubtitle(undefined);
			setVisible(true);

			const startTime = Date.now();
			const minActiveTime = 600; // ms minimum visible active time

			const advanceSubStep = (id: string, customSubtitle?: string) => {
				if (customSubtitle) {
					setDynamicSubtitle(customSubtitle);
				}
			};

			try {
				const timeoutMs = options?.timeoutMs ?? 60000;

				let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
				const timeoutPromise = new Promise<never>((_, reject) => {
					timeoutHandle = setTimeout(() => {
						reject(new Error(`Operation timed out after ${timeoutMs}ms`));
					}, timeoutMs);
				});

				const taskPromise = task({ advanceSubStep });

				const result = await Promise.race([taskPromise, timeoutPromise]);

				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
				}

				// Ensure minimum 600ms active display time for smooth UX
				const elapsed = Date.now() - startTime;
				if (elapsed < minActiveTime) {
					await new Promise((resolve) =>
						setTimeout(resolve, minActiveTime - elapsed)
					);
				}

				// Mark completed
				const nextCompleted = Array.from(
					new Set([...initialCompleted, stepId])
				);
				setCompletedStepIds(nextCompleted);
				await persistCompletedSteps(nextCompleted);

				// Wait for tick scale-in and strikethrough animation (550ms)
				await new Promise((resolve) => setTimeout(resolve, 550));

				if (!options?.keepOpen) {
					setVisible(false);
					setActiveId(null);
					setDynamicSubtitle(undefined);
				}

				return result;
			} catch (error) {
				setFailedId(stepId);
				// Keep failed row visible for 800ms so user clearly perceives the failure state
				await new Promise((resolve) => setTimeout(resolve, 800));
				setVisible(false);
				setActiveId(null);
				setDynamicSubtitle(undefined);
				throw error;
			}
		},
		[persistCompletedSteps]
	);

	const contextValue = useMemo<JourneyLoaderContextValue>(
		() => ({
			runStep,
			advance,
			show,
			hide,
			setActive,
			markCompleted,
			markFailed,
			resetJourney,
			completedStepIds,
		}),
		[runStep, advance, show, hide, setActive, markCompleted, markFailed, resetJourney, completedStepIds]
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
