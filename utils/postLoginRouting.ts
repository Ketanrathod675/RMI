import {
	StepHref,
	type StepNameTypes,
	type UserDashboardResponseType,
} from "@/utils/api/types/user.types";

/**
 * Adapts raw `/auth/me` profile payload into `UserDashboardResponseType`.
 * Never fabricates `basic_details` / `in_progress` when top-level `is_rejected`
 * is true or when `current_workflow == null && !active_loan` (returning user with no open workflow).
 */
export function adaptAuthProfileToDashboard(authData: any): UserDashboardResponseType {
	const workflow = authData?.current_workflow;
	const kyc = authData?.profile;
	const activeLoan = authData?.active_loan ?? null;
	const hasNothingOpenReturningUser = workflow == null && !activeLoan;

	const isRejected =
		Boolean(workflow?.is_rejected) ||
		Boolean(authData?.is_rejected) ||
		String(workflow?.overall_status ?? "").toLowerCase().trim() === "rejected";

	const overallStatus =
		workflow?.overall_status ||
		(isRejected
			? "rejected"
			: activeLoan || hasNothingOpenReturningUser
				? "completed"
				: "in_progress");

	const currentStep =
		workflow?.current_step ||
		(isRejected || hasNothingOpenReturningUser
			? "dashboard"
			: activeLoan
				? "disbursement"
				: "basic_details");

	const nextStep = workflow?.next_step || "";
	const percentage =
		workflow?.overall_percentage ??
		(isRejected ? 0 : activeLoan || hasNothingOpenReturningUser ? 100 : 0);

	return {
		dashboard_type: "workflow_dashboard",
		user_summary: {
			name: kyc?.full_name || authData?.phone_number || "Applicant",
			customer_id: authData?.id || "",
			phone_number: authData?.phone_number || "",
			profile_completion: percentage,
			kyc_status: overallStatus,
			member_since: authData?.created_at || new Date().toISOString(),
			last_login: new Date(),
		},
		workflow_progress: {
			current_step: currentStep,
			current_step_name: currentStep.replace(/_/g, " "),
			completion_percentage: percentage,
			overall_status: overallStatus,
			steps_completed: Math.round((percentage / 100) * 10),
			total_steps: 10,
			last_activity_at: new Date(),
			next_required_step: nextStep,
			workflow_started_at: new Date(),
			bre_status: workflow?.bre_status || null,
			bre_failed_rule: workflow?.bre_failed_rule || null,
			is_rejected: isRejected,
			rejection_source: workflow?.rejection_source ?? authData?.rejection_source ?? undefined,
			rejection_reason: workflow?.rejection_reason ?? authData?.rejection_reason ?? null,
			can_reapply: workflow?.can_reapply ?? authData?.can_reapply,
			can_reapply_at: authData?.can_reapply_at ?? workflow?.can_reapply_at ?? null,
		},
		workflow_steps: [],
		current_step_info: {
			step: currentStep,
			step_name: currentStep.replace(/_/g, " "),
			percentage,
			is_accessible: true,
			description: "",
		},
		notifications: {
			unread_count: 0,
			recent_notifications: [],
		},
		progress_summary: {
			days_since_started: 0,
			estimated_completion_time: "",
			next_milestone: nextStep,
		},
		active_loan: activeLoan,
		is_rejected: isRejected,
		can_reapply: authData?.can_reapply ?? null,
		can_reapply_at: authData?.can_reapply_at ?? workflow?.can_reapply_at ?? null,
	};
}

/**
 * Resolves immediate post-OTP-login destination.
 * Returning and blocked/rejected users always land on the Dashboard (`/(tabs)`),
 * never jumping directly onto `/loan-application` or a workflow screen.
 */
export function resolvePostLoginRoute(
	verifyData: any,
	loginData?: any,
): "/request-permissions" | "/(tabs)" {
	const nextStep = String(verifyData?.next_step ?? "").toLowerCase().trim();
	const isExplicitlyBlockedOrDashboard =
		nextStep === "dashboard" || verifyData?.is_rejected === true;

	if (isExplicitlyBlockedOrDashboard) {
		return "/(tabs)";
	}

	const rawPermissionGiven =
		verifyData?.permission_given ?? verifyData?.user?.permission_given;

	const isNewUser =
		verifyData?.is_new_user === true ||
		verifyData?.is_profile_completed === false ||
		loginData?.user_exists === false ||
		verifyData?.user?.is_first_login === true ||
		verifyData?.is_first_login === true ||
		rawPermissionGiven === false ||
		rawPermissionGiven === "false";

	if (isNewUser) {
		return "/request-permissions";
	}

	return "/(tabs)";
}

/**
 * Resolves destination after permissions are completed.
 * Rejected, completed, and active-loan users always return to Dashboard `/(tabs)`.
 */
export function resolvePostPermissionsRoute(
	verifyOtpData: any,
	dashboardData?: UserDashboardResponseType | null,
): string {
	const verifyNextStep = String(verifyOtpData?.next_step ?? "").toLowerCase().trim();
	const wp = dashboardData?.workflow_progress;
	const overallStatus = String(wp?.overall_status ?? "").toLowerCase().trim();
	const isRejected =
		Boolean(dashboardData?.is_rejected) ||
		Boolean(wp?.is_rejected) ||
		overallStatus === "rejected" ||
		overallStatus === "application_rejected" ||
		overallStatus === "no_approved_amount";

	if (isRejected) {
		return "/(tabs)";
	}

	if (
		verifyNextStep === "dashboard" ||
		verifyOtpData?.is_profile_completed === true ||
		dashboardData?.dashboard_type === "loan_dashboard" ||
		overallStatus === "completed" ||
		Boolean(dashboardData?.active_loan)
	) {
		return "/(tabs)";
	}

	const currentStep = wp?.current_step;
	if (currentStep === "digilocker") {
		return "/aadhaar-kyc";
	}

	if (currentStep && StepHref[currentStep as StepNameTypes]) {
		return StepHref[currentStep as StepNameTypes];
	}

	if (verifyNextStep === "basic_details" || verifyOtpData?.is_profile_completed === false) {
		return "/loan-application";
	}

	return "/(tabs)";
}

