/**
 * RapidMoney Step Routing Definitions
 */
export const STEP_NAMES = [
	"login_signup",
	"mpin_set",
	"personal_details",
	"assessment_fee_payment",
	"pan_verification",
	"professional_details",
	"ekyc_ckyc",
	"selfie_match",
	"address_submission",
	"loan_application",
	"bank_details",
	"kfs_signing",
	"enach_mandate",
	"agreement_signing",
	"credit_queue",
	"digilocker",
	"ckyc",
] as const;

export type StepNameTypes = (typeof STEP_NAMES)[number];

export const StepHref: { [key in StepNameTypes]: string } = {
	login_signup: "/login",
	mpin_set: "/set-mpin",
	personal_details: "/loan-application",
	assessment_fee_payment: "/new-assessment-fee",
	pan_verification: "/verify-email",
	professional_details: "/professional-details",
	ekyc_ckyc: "/ckyc-instructions",
	selfie_match: "/ckyc-instructions",
	address_submission: "/aadhaar-kyc",
	loan_application: "/loan-approved",
	agreement_signing: "/sanction-letter",
	bank_details: "/verify-bank-details",
	enach_mandate: "/auto-debit-setup",
	kfs_signing: "/sanction-letter",
	credit_queue: "/application-verification",
	digilocker: "/aadhaar-kyc",
	ckyc: "/ckyc-instructions",
} as const;

/**
 * RapidMoney FastAPI User Models
 */
export interface FastApiUser {
	uuid: string;
	phone_number: string;
	full_name?: string | null;
	fathers_name?: string | null;
	mothers_name?: string | null;
	gender?: string | null;
	pan_card?: string | null;
	email?: string | null;
	phone_verified: boolean;
	email_verified: boolean;
	pan_verified: boolean;
	role: "borrower" | "employee" | "lender";
	is_active: boolean;
	image_url?: string | null;
	created_at: string;
	updated_at: string;
	created_by?: string | null;
	updated_by?: string | null;
}

export interface FastApiUserUpdate {
	full_name?: string | null;
	fathers_name?: string | null;
	mothers_name?: string | null;
	gender?: string | null;
	pan_card?: string | null;
	email?: string | null;
	image_url?: string | null;
	phone_verified?: boolean;
	email_verified?: boolean;
	pan_verified?: boolean;
	updated_by?: string | null;
}

export interface BasicDetailsPayload {
	full_name: string;
	pan_card: string;
	fathers_name: string;
	date_of_birth: string; // Format: DD-MM-YYYY
	email: string;
	pincode: string;
	gender?: string;
	preferred_language?: string;
}

/**
 * Legacy Dashboard & User Profile Models
 */
export type LoanSummary = {
	amount_due?: number;
	payment_date?: string;
	interest_amount?: number;
};

export enum Status {
	Completed = "completed",
	NotStarted = "not_started",
}

export type WorkflowStep = {
	step: string;
	step_name: string;
	status: Status;
	started_at: Date | null;
	completed_at: Date | null;
	is_current: boolean;
};

export type CurrentStepInfo = {
	step: string;
	step_name: string;
	percentage: number;
	is_accessible: boolean;
	description: string;
};

export type RecentNotification = {
	id: string;
	title: string;
	message: string;
	type: string;
	read: boolean;
	created_at: Date;
	action_url: string;
};

export type Notifications = {
	unread_count: number;
	recent_notifications: RecentNotification[];
};

export type ProgressSummary = {
	days_since_started: number;
	estimated_completion_time: string;
	next_milestone?: string;
};

export type UserSummary = {
	name: string;
	customer_id: string;
	phone_number: string;
	profile_completion: number;
	kyc_status: string;
	member_since: string;
	last_login: Date;
};

export type WorkflowProgress = {
	current_step: string;
	current_step_name: string;
	completion_percentage: number;
	overall_status: string;
	steps_completed: number;
	total_steps: number;
	last_activity_at: Date;
	next_required_step: string;
	workflow_started_at: Date;
};

export type UserDashboardResponseType = {
	dashboard_type: string;
	user_summary: UserSummary;
	workflow_progress: WorkflowProgress;
	workflow_steps: WorkflowStep[];
	current_step_info: CurrentStepInfo;
	notifications: Notifications;
	progress_summary: ProgressSummary;
	loan_summary?: LoanSummary;
};

export type PersonalDetails = {
	full_name: string;
	father_name: string;
	pan_number: string;
	date_of_birth: string;
	gender: "male" | "female" | "other";
	pin_code: string;
	is_pan_verified: boolean;
	preferred_language: string;
	aadhaar_number: string;
};

export type EmploymentDetails = {
	employment_type: string;
	verification_type: string;
	company_type: string | null;
	company_name: string;
	designation: string;
	nature_of_business: string;
	industry_type: string;
	income_range: string;
	residence_status: string;
};

export type NotificationPreferences = {
	email: boolean;
	sms: boolean;
	push: boolean;
};

export type KycAddressShown = {
	address?: string;
	city?: string;
	state?: string;
	pin_code?: string;
};

export type AddressDetails = {
	address_line1: string | null;
	address_line2: string | null;
	city: string;
	state: string;
	pincode: string;
	country: string;
	verified: boolean;
	latitude: number | null;
	longitude: number | null;
	kyc_address_shown?: KycAddressShown;
};

export type UserProfileResponseType = {
	id: string;
	user_id: string;
	customer_id: string;
	phone_number: string;
	email: string | null;
	role: string;
	status: string;
	is_phone_verified: boolean;
	is_email_verified: boolean;
	personal_details: PersonalDetails;
	employment_details: EmploymentDetails;
	preferred_language: string;
	notification_preferences: NotificationPreferences;
	address?: AddressDetails;
	kyc_address?: AddressDetails;
	created_at: string;
	last_login: string;
};

export type DeleteAccountPayload = {
	full_name: string;
	email: string;
	phone_number: string;
	reason: string;
};

export type PersonalDetailsHbPartnerResponseType = {
	full_name: string;
	father_name: string;
	email: string;
	pan_number: string;
	aadhaar_number: string;
	date_of_birth: string;
	pin_code: string;
	preferred_language: string;
	gender: string;
	address: string;
	city: string;
	state: string;
	country: string;
};

export type EmploymentDetailsHbPartnerResponseType = {
	employment_type: string;
	verification_type: string;
	income_range: string;
	residence_status: string | null;
	company_name: string;
	designation: string;
	work_experience_years: number;
	monthly_income: number;
};

export type ReusableData = {
	personal_details: boolean;
	ckyc_verified: boolean;
	employment_details: boolean;
	address_details: boolean;
};

export type CanReapplyResponseType = {
	can_apply: boolean;
	reason: string;
	message: string;
	starting_step: string;
	processing_fee_required: boolean;
	processing_fee_valid_days: number;
	previous_applications_count: number;
	reusable_data: ReusableData;
	rejection_count: number;
};
