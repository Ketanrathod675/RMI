import { getStorageItem, setStorageItem } from "@/utils/storage";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

// Dev-only storage key for mock API preference
const DEV_MOCK_API_KEY = "@dev-use-mock-api" as any;
const DEV_MOCK_OPTIONS_KEY = "@dev-mock-options" as any;

let _isMockModeEnabled = false;
let _isInitialized = false;

// Configurable mock options for testing different user flows in dev
export interface DevMockOptions {
	permissionGiven: boolean;
	userExists: boolean;
	isFirstLogin: boolean;
	softPullConsentRequired: boolean;
	easebuzzMockOutcome?: "delayed_success" | "immediate_success" | "failure";
	simulateReapplicationRejection?: boolean;
	employmentNextAction?: "digilocker" | "ckyc";
	currentStep?: string;
	ckycOutcome?: "happy_path" | "digilocker_redirect" | "reapplication_selfie" | "reapplication_other";
	ckycSendOtpSuccess?: boolean;
	faceMatchSuccess?: boolean;
	ckycResendOtpSuccess?: boolean;
}

let _mockOptions: DevMockOptions = {
	permissionGiven: false,
	userExists: false,
	isFirstLogin: true,
	softPullConsentRequired: false,
	easebuzzMockOutcome: "delayed_success",
	simulateReapplicationRejection: false,
	employmentNextAction: "digilocker",
	currentStep: "personal_details",
	ckycOutcome: "happy_path",
	ckycSendOtpSuccess: true,
	faceMatchSuccess: true,
	ckycResendOtpSuccess: true,
};

let _easebuzzPollCount = 0;

type MockListener = (enabled: boolean) => void;
const _listeners = new Set<MockListener>();

type MockOptionsListener = (options: DevMockOptions) => void;
const _optionsListeners = new Set<MockOptionsListener>();

/**
 * Initializes Mock API mode setting and options from AsyncStorage.
 * Only runs in __DEV__.
 */
export async function initDevMockMode(): Promise<boolean> {
	if (!__DEV__) {
		return false;
	}

	try {
		const stored = await getStorageItem(DEV_MOCK_API_KEY);
		// Default is strictly FALSE even in dev builds
		_isMockModeEnabled = stored === "true";

		const storedOptions = await getStorageItem(DEV_MOCK_OPTIONS_KEY);
		if (storedOptions) {
			try {
				const parsed = JSON.parse(storedOptions);
				_mockOptions = { ..._mockOptions, ...parsed };
				if (__DEV__) {
					console.log(
						`🛠️ [DEV MOCK API] Restored mock options (currentStep: ${_mockOptions.currentStep})`
					);
				}
			} catch (e) {
				console.warn("⚠️ [DEV MOCK API] Failed to parse stored mock options:", e);
			}
		}

		_isInitialized = true;
		if (__DEV__ && _isMockModeEnabled) {
			console.log("🛠️ [DEV MOCK API] Mock Mode is ACTIVE (Loaded from dev storage)");
		}
	} catch {
		_isMockModeEnabled = false;
		_isInitialized = true;
	}

	return _isMockModeEnabled;
}

/**
 * Returns whether Mock API mode is currently enabled.
 * Guaranteed to return FALSE in release builds.
 */
export function getIsMockModeEnabled(): boolean {
	if (!__DEV__) {
		return false;
	}
	return _isMockModeEnabled;
}

/**
 * Toggles Mock API mode on/off in development.
 */
export async function setDevMockModeEnabled(enabled: boolean): Promise<void> {
	if (!__DEV__) {
		return;
	}

	_isMockModeEnabled = enabled;
	try {
		await setStorageItem(DEV_MOCK_API_KEY, enabled ? "true" : "false");
	} catch {
		// Ignore storage error in dev
	}

	console.log(`🛠️ [DEV MOCK API] Mock Mode switched to: ${enabled ? "ON (MOCK)" : "OFF (REAL API)"}`);
	_listeners.forEach((listener) => listener(enabled));
}

/**
 * Subscribe to mock mode state changes for UI components.
 */
export function subscribeDevMockMode(listener: MockListener): () => void {
	if (!__DEV__) {
		return () => { };
	}
	_listeners.add(listener);
	return () => {
		_listeners.delete(listener);
	};
}

/**
 * Subscribe to mock options changes for UI components.
 */
export function subscribeDevMockOptions(listener: MockOptionsListener): () => void {
	if (!__DEV__) {
		return () => { };
	}
	_optionsListeners.add(listener);
	return () => {
		_optionsListeners.delete(listener);
	};
}

export function getDevMockOptions(): DevMockOptions {
	return { ..._mockOptions };
}

export function updateDevMockOptions(options: Partial<DevMockOptions>): void {
	if (!__DEV__) return;
	_mockOptions = { ..._mockOptions, ...options };
	try {
		setStorageItem(DEV_MOCK_OPTIONS_KEY, JSON.stringify(_mockOptions)).catch(() => { });
	} catch {
		// Ignore storage error in dev
	}
	_optionsListeners.forEach((listener) => listener({ ..._mockOptions }));
}

/**
 * Explicitly resets currentStep back to "personal_details" and persists to AsyncStorage.
 */
export function resetDevMockCurrentStep(): void {
	if (!__DEV__) return;
	console.log("🔄 [DEV MOCK API] Resetting mock user state back to fresh new user ('personal_details')");
	updateDevMockOptions({
		userExists: false,
		isFirstLogin: true,
		permissionGiven: false,
		currentStep: "personal_details",
	});
}

/**
 * Helper to simulate network latency in dev
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Evaluates an outgoing Axios request config and returns a mocked AxiosResponse
 * if Mock Mode is enabled and a matching mock handler exists.
 * Returns null if the request should proceed normally to the real backend.
 */
export async function handleDevMockRequest(
	config: InternalAxiosRequestConfig
): Promise<AxiosResponse | null> {
	// Guard #1: Statically eliminated in release builds
	if (!__DEV__) {
		return null;
	}

	// Guard #2: Mock mode must be explicitly turned on by developer
	if (!_isMockModeEnabled) {
		return null;
	}

	const url = config.url ?? "";
	const method = (config.method ?? "get").toLowerCase();

	// ─── 1. Endpoint: auth/login ──────────────────────────────────────────────
	if (url.includes("auth/login") && method === "post") {
		await delay(450); // Simulate network latency

		const reqData = typeof config.data === "string" ? JSON.parse(config.data || "{}") : config.data;
		const phoneNumber = reqData?.phone_number ?? "9876543210";

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST auth/login:", { phoneNumber });

		// Always reset new logins to a clean new user starting at personal_details
		updateDevMockOptions({
			userExists: false,
			isFirstLogin: true,
			permissionGiven: false,
			currentStep: "personal_details",
		});

		const mockResponseBody = {
			user_exists: false,
			next_action: "verify_otp",
			otp_id: "mock_otp_id_889900",
			expires_in: 600,
			user_id: "mock_user_id_12345",
			customer_id: "mock_cust_98765",
			is_mpin_set: false,
			message: "OTP sent successfully [MOCK MODE]",
			soft_pull_consent: !_mockOptions.softPullConsentRequired,
		};

		return {
			data: mockResponseBody,
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 2. Endpoint: auth/verify-otp ─────────────────────────────────────────
	if (url.includes("auth/verify-otp") && method === "post") {
		await delay(500); // Simulate network latency

		const reqData = typeof config.data === "string" ? JSON.parse(config.data || "{}") : config.data;
		const phoneNumber = reqData?.phone_number ?? "9876543210";
		const enteredOtp = reqData?.otp ?? "1234";

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST auth/verify-otp:", {
			phoneNumber,
			enteredOtp,
			permissionGiven: _mockOptions.permissionGiven,
		});

		const mockResponseBody = {
			message: "OTP verified successfully [MOCK MODE]",
			user_id: "mock_user_id_12345",
			next_action: "setup_mpin",
			access_token: "mock_jwt_access_token_dev_environment",
			refresh_token: "mock_jwt_refresh_token_dev_environment",
			token_type: "Bearer",
			permission_given: _mockOptions.permissionGiven,
			success: true,
			user: {
				id: "mock_user_id_12345",
				user_id: "mock_user_id_12345",
				customer_id: "mock_cust_98765",
				phone_number: phoneNumber,
				is_phone_verified: true,
				is_first_login: _mockOptions.isFirstLogin,
				email: "dev.user@rapidmoney.in",
				is_mpin_set: false,
				applicant_from: "OG",
			},
		};

		return {
			data: mockResponseBody,
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 3. Endpoint: auth/setup-mpin ─────────────────────────────────────────
	if (url.includes("auth/setup-mpin") && method === "post") {
		await delay(400);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST auth/setup-mpin");

		return {
			data: {
				message: "MPIN setup successful [MOCK MODE]",
				access_token: "mock_jwt_access_token_dev_environment",
				refresh_token: "mock_jwt_refresh_token_dev_environment",
				token_type: "Bearer",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 4. Endpoint: workflow/mark-consent-permission ────────────────────────
	if (url.includes("workflow/mark-consent-permission") && method === "post") {
		await delay(350);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST workflow/mark-consent-permission");

		return {
			data: {
				success: true,
				message: "Consent permission marked successfully [MOCK MODE]",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 5. Endpoint: users/permissions ───────────────────────────────────────
	if (url.includes("users/permissions") && method === "post") {
		await delay(350);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST users/permissions");

		return {
			data: {
				success: true,
				message: "User permissions marked successfully [MOCK MODE]",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 6. Endpoint: users/dashboard ─────────────────────────────────────────
	if (url.includes("users/dashboard") && method === "get") {
		await delay(400);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET users/dashboard");

		const currentStep = _mockOptions.currentStep || "personal_details";
		const isProf = currentStep === "professional_details";
		const isCkyc = currentStep === "ckyc";

		return {
			data: {
				dashboard_type: "onboarding_dashboard",
				user_summary: {
					name: "Dev User",
					customer_id: "mock_cust_98765",
					phone_number: "9876543210",
					profile_completion: isCkyc ? 60 : isProf ? 40 : 20,
					kyc_status: "pending",
					member_since: "2026",
					last_login: new Date(),
				},
				workflow_progress: {
					current_step: currentStep,
					current_step_name: isCkyc ? "CKYC Verification" : isProf ? "Professional Details" : "Personal Details",
					completion_percentage: isCkyc ? 60 : isProf ? 40 : 20,
					overall_status: "in_progress",
					steps_completed: isCkyc ? 3 : isProf ? 2 : 1,
					total_steps: 6,
					last_activity_at: new Date(),
					next_required_step: currentStep,
					workflow_started_at: new Date(),
				},
				workflow_steps: [],
				current_step_info: {
					step: currentStep,
					step_name: isCkyc ? "CKYC Verification" : isProf ? "Professional Details" : "Personal Details",
					percentage: isCkyc ? 60 : isProf ? 40 : 20,
					is_accessible: true,
					description: isCkyc ? "Complete CKYC" : isProf ? "Fill professional details" : "Fill personal details",
				},
				notifications: {
					unread_count: 0,
					recent_notifications: [],
				},
				progress_summary: {
					days_since_started: 1,
					estimated_completion_time: "5 mins",
					next_milestone: isCkyc ? "Lender Approval" : "Employment Details",
				},
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 7. Endpoint: kyc/verify-pan ─────────────────────────────────────────
	if (url.includes("kyc/verify-pan") && method === "post") {
		await delay(600);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST kyc/verify-pan");

		const reqData = typeof config.data === "string" ? JSON.parse(config.data || "{}") : config.data;
		const name = reqData?.name || "DEV USER";
		const panNumber = (reqData?.pan_number || "ABCDE1234F").toUpperCase();

		return {
			data: {
				verified: true,
				message: "PAN verification successful",
				is_pan_valid: true,
				pan_details: {
					pan_number: panNumber,
					verified_name: name,
					provided_name: name,
					name_similarity_percentage: 95,
					name_match: true,
					pan_status: "valid",
					category: "individual",
					gender: "",
					aadhaar_seeded: true,
				},
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 8. Endpoint: auth/send-email-otp ─────────────────────────────────────
	if (url.includes("auth/send-email-otp") && method === "post") {
		await delay(450);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST auth/send-email-otp");

		const reqData = typeof config.data === "string" ? JSON.parse(config.data || "{}") : config.data;
		const email = reqData?.email || "dev.user@example.com";

		// Deduplication failure simulation
		if (email.toLowerCase().includes("duplicate") || email.toLowerCase() === "exists@example.com") {
			const error = new Error("This email is already linked to another account") as any;
			error.response = {
				status: 400,
				data: {
					success: false,
					message: "This email is already linked to another account",
					code: "EMAIL_ALREADY_EXISTS",
				},
			};
			throw error;
		}

		// User not found simulation
		if (email.toLowerCase() === "notfound@example.com") {
			const error = new Error("User not found") as any;
			error.response = {
				status: 404,
				data: {
					success: false,
					message: "User not found",
				},
			};
			throw error;
		}

		// Invalid email format simulation
		if (email === "invalid-email" || !email.includes("@")) {
			const error = new Error("Invalid email format") as any;
			error.response = {
				status: 400,
				data: {
					success: false,
					message: "Invalid email format",
				},
			};
			throw error;
		}

		return {
			data: {
				success: true,
				message: "4-digit OTP sent to your email address",
				otp_id: "mock_email_otp_id_8899",
				expires_in: 600,
				email,
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 9. Endpoint: auth/verify-email-otp ───────────────────────────────────
	if (url.includes("auth/verify-email-otp") && method === "post") {
		await delay(450);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST auth/verify-email-otp");

		const reqData = typeof config.data === "string" ? JSON.parse(config.data || "{}") : config.data;
		const otp = reqData?.otp || "";
		const email = reqData?.email || "dev.user@example.com";

		if (otp === "0000") {
			const error = new Error("Invalid or expired OTP") as any;
			error.response = {
				status: 400,
				data: {
					success: false,
					message: "Invalid or expired OTP",
				},
			};
			throw error;
		}

		return {
			data: {
				success: true,
				message: "Email verified successfully",
				email,
				is_email_verified: true,
				user_id: reqData?.user_id || "mock_user_12345",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 10. Endpoint: kyc/verify-email ───────────────────────────────────────
	if (url.includes("kyc/verify-email") && method === "get") {
		await delay(400);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET kyc/verify-email");

		return {
			data: {
				email: "dev.user@rapidmoney.in",
				result: "deliverable",
				message: "Email deliverable [MOCK MODE]",
				accept_all: 0,
				disposable: 0,
				spamtrap: 0,
				role: 0,
				free_email: 1,
				success: true,
				user: "dev.user",
				domain: "rapidmoney.in",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 11. Endpoint: kyc/personal-details ───────────────────────────────────
	if (url.includes("kyc/personal-details") && method === "post") {
		await delay(700);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST kyc/personal-details");
		updateDevMockOptions({ currentStep: "assessment_fee_payment" });

		return {
			data: {
				message: "Personal details submitted successfully [MOCK MODE]",
				success: true,
				kyc_id: "mock_kyc_id_778899",
				credit_check: {
					status: "approved",
					credit_score: 750,
					credit_status: "good",
					bureau: "CIBIL",
					report_date: new Date().toISOString(),
				},
				processing_fee: {
					amount: 299,
					currency: "INR",
					description: "Processing fee for loan application",
					payment_methods: [
						{ id: "upi", name: "UPI" },
						{ id: "card", name: "Debit/Credit Card" },
					],
				},
				pre_qualified_amount: 25000,
				next_step: "new-assessment-fee",
				status: "in_progress",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 12. Endpoint: users/personal-details-hb-partner ──────────────────────
	if (url.includes("users/personal-details-hb-partner") && method === "get") {
		await delay(400);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET users/personal-details-hb-partner");

		return {
			data: {
				full_name: "Dev HB User",
				father_name: "Dev HB Father",
				email: "dev.hb@rapidmoney.in",
				pan_number: "ABCDE1234F",
				aadhaar_number: "999988887777",
				date_of_birth: "1990-01-01",
				pin_code: "110001",
				preferred_language: "english",
				gender: "male",
				address: "123 Dev Street",
				city: "New Delhi",
				state: "Delhi",
				country: "India",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 13. Endpoint: kyc/initial-approval ───────────────────────────────────
	if (url.includes("kyc/initial-approval") && method === "post") {
		await delay(500);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST kyc/initial-approval");

		if (_mockOptions.simulateReapplicationRejection) {
			console.log("🛠️ [DEV MOCK API] ⚡ Returning REJECTION status for kyc/initial-approval");
			return {
				data: {
					status: "reject",
					message: "Your application didn't meet our lending partner's criteria this time.",
					msg: "Your application didn't meet our lending partner's criteria this time.",
				},
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		}

		return {
			data: {
				status: "approved",
				message: "Application approved [MOCK MODE]",
				msg: "Application approved [MOCK MODE]",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 14. Endpoint: kyc/lender-offers ──────────────────────────────────────
	if (url.includes("kyc/lender-offers") && method === "get") {
		await delay(500);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET kyc/lender-offers");

		return {
			data: {
				success: true,
				primary_lender: {
					lender_id: "lender_ruloans_01",
					lender_name: "Ruloans Financial Services P Ltd",
					is_rbi_nbfc: true,
					loan_upto: 15000,
					tenure_upto: 60,
					interest_rate_starts_at: "Starts @ 1.5% p.m.",
				},
				eligible_lenders: [
					{
						lender_id: "lender_fintree_02",
						lender_name: "Fintree (Term - Personal Loan)",
						is_rbi_nbfc: true,
						loan_upto: 20000,
						tenure_upto: 45,
						interest_rate_starts_at: "Starts @ 1.75% p.m.",
					},
					{
						lender_id: "lender_emkay_03",
						lender_name: "Emkay Global Finance",
						is_rbi_nbfc: true,
						loan_upto: 15000,
						tenure_upto: 30,
						interest_rate_starts_at: "Starts @ 2.0% p.m.",
					},
				],
				assessment_fee: {
					amount: 99,
					original_amount: 249,
					gst: 0,
					currency: "INR",
				},
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 15. Endpoint: payments/initiate ──────────────────────────────────────
	if (url.includes("payments/initiate") && method === "post") {
		await delay(600);
		_easebuzzPollCount = 0; // Reset poll counter for new payment

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST payments/initiate");

		const mockOrderId = "order_mock_" + Date.now();
		const mockTxnId = "txnid_mock_" + Date.now();

		return {
			data: {
				status: "success",
				message: "Payment initiated successfully [MOCK MODE]",
				payment_data: {
					order_id: mockOrderId,
					cf_order_id: mockOrderId,
					payment_session_id: "sess_" + mockOrderId,
					order_status: "ACTIVE",
					order_token: "token_" + mockOrderId,
					payment_link: `rapid-money://assessment-fee?status=success&txnid=${mockOrderId}`,
					amount: 236,
					currency: "INR",
					expires_at: new Date(Date.now() + 600000).toISOString(),
					created_at: new Date().toISOString(),
					transaction_id: mockTxnId,
				},
				payment_methods: {
					payment_methods: [],
					currency: "INR",
					supported_countries: ["IN"],
					min_amount: 1,
					max_amount: 100000,
				},
				next_step: "payment",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 16. Endpoint: payments/payment/easebuzz/status/:txnid ────────────────
	if (url.includes("payments/payment/easebuzz/status") && method === "post") {
		await delay(400);
		_easebuzzPollCount++;

		const outcome = _mockOptions.easebuzzMockOutcome || "delayed_success";
		console.log(`🛠️ [DEV MOCK API] ⚡ Easebuzz status check #${_easebuzzPollCount}, outcome setting: ${outcome}`);

		let status: "success" | "failure" | "pending" = "pending";
		if (outcome === "immediate_success") {
			status = "success";
		} else if (outcome === "failure") {
			status = "failure";
		} else {
			// delayed_success: returns pending twice, then success on 3rd poll
			status = _easebuzzPollCount >= 2 ? "success" : "pending";
		}

		if (status === "success") {
			updateDevMockOptions({ currentStep: "professional_details" });
		}

		return {
			data: {
				status,
				message: `Easebuzz status: ${status} [MOCK MODE]`,
				order_id: url.split("/").pop() || "mock_order",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 17. Endpoint: kyc/verify-lead-creation ────────────────────────────────
	if (url.includes("kyc/verify-lead-creation") && method === "get") {
		await delay(350);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET kyc/verify-lead-creation");

		return {
			data: {
				lead_created: true,
				message: "Lead verified successfully [MOCK MODE]",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 18. Endpoint: kyc/get-my-details ─────────────────────────────────────
	if (url.includes("kyc/get-my-details") && method === "get") {
		await delay(400);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET kyc/get-my-details");

		const isReappRejection = Boolean(_mockOptions.simulateReapplicationRejection);

		return {
			data: {
				reapplication: isReappRejection,
				pan_verified: true,
				email_verified: true,
				kyc_record: {
					full_name: "Dev User",
					pan_number: "ABCDE1234F",
					email: "dev.user@rapidmoney.in",
					is_pan_verified: true,
					is_email_verified: true,
				},
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 19. Endpoint: kyc/employment-details ─────────────────────────────────
	if (url.includes("kyc/employment-details") && method === "post") {
		await delay(600);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST kyc/employment-details");

		const reqData = typeof config.data === "string" ? JSON.parse(config.data || "{}") : config.data;

		// Server requires employment_type, verification_type, income_range, residence_status
		if (!reqData?.employment_type || !reqData?.verification_type || !reqData?.income_range || !reqData?.residence_status) {
			console.log("🛠️ [DEV MOCK API] ❌ kyc/employment-details missing required fields:", {
				employment_type: reqData?.employment_type,
				verification_type: reqData?.verification_type,
				income_range: reqData?.income_range,
				residence_status: reqData?.residence_status,
			});
			return {
				data: {
					message: "Missing required fields: employment_type, verification_type, income_range, or residence_status",
				},
				status: 400,
				statusText: "Bad Request",
				headers: {},
				config,
			};
		}

		const nextAction = _mockOptions.employmentNextAction || "digilocker";
		updateDevMockOptions({ currentStep: "ckyc" });

		return {
			data: {
				message: "Employment details submitted successfully",
				application_id: "app_mock_emp_" + Date.now(),
				is_reapplication: false,
				next_action: nextAction,
				success: true,
				kyc_id: "kyc_mock_" + Date.now(),
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 20. Endpoint: kyc/professional-details ────────────────────────────────
	if (url.includes("kyc/professional-details") && method === "get") {
		await delay(400);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET kyc/professional-details");

		return {
			data: {
				status: true,
				languages: [
					"English",
					"Hindi",
					"Marathi",
					"Gujarati",
					"Bengali",
					"Telugu",
					"Tamil",
					"Kannada",
					"Malayalam",
					"Odia",
					"Punjabi",
				],
				data: null,
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 21. Endpoint: kyc/get-my-ckyc ─────────────────────────────────────────
	if (url.includes("kyc/get-my-ckyc") && method === "get") {
		await delay(450);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET kyc/get-my-ckyc");

		const outcome = _mockOptions.ckycOutcome || "happy_path";

		if (outcome === "digilocker_redirect") {
			return {
				data: {
					success: true,
					reapplication: false,
					next_step: "digilocker",
					message: "CKYC unavailable, redirecting to DigiLocker [MOCK MODE]",
					ckyc_details: null,
				},
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		}

		if (outcome === "reapplication_selfie") {
			return {
				data: {
					success: true,
					reapplication: true,
					next_step: "selfie_match",
					message: "Reapplication: selfie match required [MOCK MODE]",
					ckyc_details: { ckyc_number: "98765432109876" },
				},
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		}

		if (outcome === "reapplication_other") {
			return {
				data: {
					success: true,
					reapplication: true,
					next_step: "pan_verification",
					message: "Reapplication: pan verification required [MOCK MODE]",
					ckyc_details: null,
				},
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		}

		// Normal Happy Path
		return {
			data: {
				success: true,
				reapplication: false,
				next_step: "ckyc",
				message: "CKYC record found [MOCK MODE]",
				ckyc_details: {
					ckyc_number: "12345678901234",
					name: "Dev User",
					dob: "1995-01-01",
					gender: "M",
				},
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 22. Endpoint: onefin/ckyc/send-otp ────────────────────────────────────
	if (url.includes("onefin/ckyc/send-otp") && method === "post") {
		await delay(500);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST onefin/ckyc/send-otp");

		const isSuccess = _mockOptions.ckycSendOtpSuccess !== false;

		if (!isSuccess) {
			return {
				data: {
					success: false,
					message: "Failed to send CKYC OTP [MOCK MODE]",
				},
				status: 400,
				statusText: "Bad Request",
				headers: {},
				config,
			};
		}

		return {
			data: {
				success: true,
				message: "CKYC OTP sent successfully [MOCK MODE]",
				otp_id: "mock_ckyc_otp_" + Date.now(),
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 23. Endpoint: ekyc/upload-selfie or documents/upload ──────────────────
	if ((url.includes("ekyc/upload-selfie") || url.includes("documents/upload")) && method === "post") {
		await delay(600);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for selfie upload");

		return {
			data: {
				status: "uploaded",
				message: "Selfie uploaded successfully [MOCK MODE]",
				document_id: "doc_mock_selfie_" + Date.now(),
				document_type: "selfie",
				file_url: "https://mock.rapidmoney.in/selfie.jpg",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 24. Endpoint: kychub-face-match/verify-selfie-with-aadhaar ────────────
	if (url.includes("kychub-face-match/verify-selfie-with-aadhaar") && method === "post") {
		await delay(700);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST kychub-face-match/verify-selfie-with-aadhaar");

		const isIdentical = _mockOptions.faceMatchSuccess !== false;

		return {
			data: {
				success: true,
				is_identical: isIdentical,
				confidence: isIdentical ? 94.5 : 42.1,
				message: isIdentical ? "Face match successful [MOCK MODE]" : "Face match failed [MOCK MODE]",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 25. Endpoint: lender-approval/check-approval ──────────────────────────
	if (url.includes("lender-approval/check-approval") && method === "post") {
		await delay(350);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST lender-approval/check-approval");

		return {
			data: {
				success: true,
				status: "approved",
				message: "Lender approval confirmed [MOCK MODE]",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 26. Endpoint: onefin/ckyc/validate-otp ──────────────────────────────
	if (url.includes("onefin/ckyc/validate-otp") && method === "post") {
		await delay(500);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST onefin/ckyc/validate-otp");

		let submittedOtp = "";
		try {
			const parsedData =
				typeof config?.data === "string" ? JSON.parse(config?.data || "{}") : config?.data;
			submittedOtp = parsedData?.otp;
		} catch (e) {
			// fallback
		}

		if (submittedOtp === "121212") {
			return {
				data: {
					status: true,
					success: true,
					message: "CKYC OTP validated successfully [MOCK MODE]",
					ckyc_data: {
						ckyc_number: "91029384756102",
						permanent_address_parts: {
							address_line_1: "Flat 402, Green Valley Apartments",
							address_line_2: "Sector 14",
							city: "Gurugram",
							district: "Gurgaon",
							state: "Haryana",
							pincode: "122001",
							country: "India",
						},
						correspondence_address_parts: {
							address_line_1: "Flat 402, Green Valley Apartments",
							address_line_2: "Sector 14",
							city: "Gurugram",
							district: "Gurgaon",
							state: "Haryana",
							pincode: "122001",
							country: "India",
						},
					},
				},
				status: 200,
				statusText: "OK",
				headers: {},
				config,
			};
		}

		// Anything else fails naturally
		return {
			data: {
				status: false,
				success: false,
				error: {
					message: "Invalid OTP entered. Remaining attempts: 2 [MOCK MODE]",
				},
				message: "Invalid OTP entered. Remaining attempts: 2 [MOCK MODE]",
			},
			status: 400,
			statusText: "Bad Request",
			headers: {},
			config,
		};
	}

	// ─── 27. Endpoint: onefin/ckyc/resend-otp ────────────────────────────────
	if (url.includes("onefin/ckyc/resend-otp") && method === "post") {
		await delay(450);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST onefin/ckyc/resend-otp");

		const isSuccess = _mockOptions.ckycResendOtpSuccess !== false;

		if (!isSuccess) {
			return {
				data: {
					status: false,
					success: false,
					message: "Failed to resend CKYC OTP [MOCK MODE]",
				},
				status: 400,
				statusText: "Bad Request",
				headers: {},
				config,
			};
		}

		return {
			data: {
				status: true,
				success: true,
				message: "CKYC OTP resent successfully [MOCK MODE]",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 28. Endpoint: postalpincode.in / pincode lookup ────────────────────
	if (url.includes("postalpincode.in") || url.includes("pincode")) {
		await delay(350);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for GET postalpincode");

		const cleanUrl = url.split("?")[0];
		const parts = cleanUrl.split("/");
		const pincode = parts[parts.length - 1] || "122001";

		return {
			data: [
				{
					Status: "Success",
					Message: "Number of pincode found: 1",
					PostOffice: [
						{
							Name: "Sector 14",
							Description: null,
							BranchType: "Sub Post Office",
							DeliveryStatus: "Delivery",
							Circle: "Haryana",
							District: "Gurgaon",
							Division: "Gurgaon",
							Region: "Delhi",
							Block: "Gurugram",
							State: "Haryana",
							Country: "India",
							Pincode: pincode,
						},
					],
				},
			],
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 29. Endpoint: documents/upload (uploadKycDocument) ──────────────────
	if (url.includes("documents/upload") && method === "post") {
		await delay(600);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST documents/upload");

		return {
			data: {
				uploaded: true,
				document_id: "mock_doc_" + Date.now(),
				document_type: "aadhaar kyc",
				filename: "address_proof.pdf",
				file_size: 1048576,
				upload_url: "/documents/mock_doc_sample.pdf",
				file_url: "https://rapidmoney-kyc-docs.s3.amazonaws.com/mock_doc_sample.pdf",
				uploaded_at: new Date().toISOString(),
				status: "success",
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// ─── 30. Endpoint: address-verification/submit (verifyAddress) ───────────
	if (url.includes("address-verification/submit") && method === "post") {
		await delay(600);

		console.log("🛠️ [DEV MOCK API] ⚡ Mocking response for POST address-verification/submit");

		updateDevMockOptions({ currentStep: "loan_application" });

		return {
			data: {
				message: "Address verification completed successfully [MOCK MODE]",
				address_type: "communication",
				auto_verified: true,
				next_step: "search_loan",
				completion_percentage: 75,
				is_repeat_user: false,
			},
			status: 200,
			statusText: "OK",
			headers: {},
			config,
		};
	}

	// Real network call for unhandled endpoints
	return null;
}

