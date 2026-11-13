import RateLimitModal from "@/components/RateLimitModal";
import { useTranslation } from "@/hooks/useTranslation";
import {
	notifyRateLimitModalClosed,
	type RateLimitModalRequest,
	setRateLimitModalHandler,
} from "@/utils/rateLimitModal";
import React, { useCallback, useEffect, useRef, useState } from "react";

export default function RateLimitModalHost() {
	const { t } = useTranslation();
	const [visible, setVisible] = useState(false);
	const [endsAt, setEndsAt] = useState<number | null>(null);
	const [request, setRequest] = useState<RateLimitModalRequest | null>(null);

	const visibleRef = useRef(false);
	const endsAtRef = useRef<number | null>(null);
	const requestRef = useRef<RateLimitModalRequest | null>(null);

	useEffect(() => {
		setRateLimitModalHandler((req: RateLimitModalRequest) => {
			const nextEndsAt = Date.now() + Math.max(1, req.retryAfterSeconds) * 1000;

			if (visibleRef.current) {
				if (endsAtRef.current === null || nextEndsAt > endsAtRef.current) {
					endsAtRef.current = nextEndsAt;
					setEndsAt(nextEndsAt);
				}
				return;
			}

			visibleRef.current = true;
			endsAtRef.current = nextEndsAt;
			requestRef.current = req;

			setEndsAt(nextEndsAt);
			setRequest(req);
			setVisible(true);
		});

		return () => {
			visibleRef.current = false;
			endsAtRef.current = null;
			requestRef.current = null;
			setRateLimitModalHandler(null);
		};
	}, []);

	const handlePrimary = useCallback(() => {
		const dismissCallback = requestRef.current?.onDismiss;
		visibleRef.current = false;
		endsAtRef.current = null;
		requestRef.current = null;

		setVisible(false);
		setEndsAt(null);
		setRequest(null);
		notifyRateLimitModalClosed();

		if (dismissCallback) {
			dismissCallback();
		}
	}, []);

	if (!request) {
		return null;
	}

	let title: string;
	let message: string;
	let defaultPrimaryLabel: string;

	switch (request.context) {
		case "otp_request":
		case "otp_resend":
			title = t("rateLimitOtpRequestTitle") || "Too many OTP requests";
			message =
				t("rateLimitOtpRequestMessage") ||
				"You have requested OTP too many times. For your security, please try again after the time shown.";
			defaultPrimaryLabel = t("backToLogin") || "Back to login";
			break;
		case "otp_verify":
			title = t("rateLimitOtpVerifyTitle") || "Too many wrong attempts";
			message =
				t("rateLimitOtpVerifyMessage") ||
				"Your number is temporarily locked after too many wrong OTP attempts. Please try again after the time shown.";
			defaultPrimaryLabel = t("backToLogin") || "Back to login";
			break;
		case "other":
		default:
			title = t("rateLimitGenericTitle") || "Please wait";
			message =
				t("rateLimitGenericMessage") ||
				"Too many attempts. Please try again after the time shown.";
			defaultPrimaryLabel = t("ok") || "OK";
			break;
	}

	const primaryLabel = request.primaryLabel || defaultPrimaryLabel;

	return (
		<RateLimitModal
			visible={visible}
			title={title}
			message={message}
			endsAt={endsAt}
			primaryLabel={primaryLabel}
			onPrimary={handlePrimary}
			dismissible={false}
		/>
	);
}

