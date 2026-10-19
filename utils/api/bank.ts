import { URLS, axios } from ".";
import Logger from "@/utils/logger";

// region: IFSC LOOKUP

export type IFSCLookupResponseType = {
	success: boolean;
	ifsc_code: string;
	bank_details: {
		bank_name: string;
		branch_name: string;
		city: string;
		state: string;
		district: string;
		address: string;
		contact: string;
		micr: string;
		swift: string;
		bank_code: string;
		features: {
			rtgs: boolean;
			neft: boolean;
			imps: boolean;
			upi: boolean;
		};
	};
	message: string;
};

/**
 * Lookup IFSC code to get bank details
 * Uses public IFSC API directly (no backend required)
 */
export const lookupIFSC = async (ifscCode: string) => {
	try {
		Logger.debug("Looking up IFSC code");
		const response = await fetch(`https://ifsc.razorpay.com/${ifscCode}`);

		if (!response.ok) {
			return {
				success: false,
				ifsc_code: ifscCode,
				message: "Invalid IFSC code",
			};
		}

		const data = await response.json();
		Logger.debug("IFSC lookup completed", { bank: data.BANK, branch: data.BRANCH });

		return {
			success: true,
			ifsc_code: ifscCode,
			bank_details: {
				bank_name: data.BANK || "",
				branch_name: data.BRANCH || "",
				city: data.CITY || "",
				state: data.STATE || "",
				district: data.DISTRICT || "",
				address: data.ADDRESS || "",
				contact: data.CONTACT || "",
				micr: data.MICR || "",
				swift: data.SWIFT || "",
				bank_code: data.BANKCODE || "",
				features: {
					rtgs: data.RTGS || false,
					neft: data.NEFT || false,
					imps: data.IMPS || false,
					upi: data.UPI || false,
				},
			},
			message: "IFSC details fetched successfully",
		};
	} catch (error: any) {
		Logger.error("IFSC lookup failed", { message: error?.message });
		return {
			success: false,
			ifsc_code: ifscCode,
			message: "Failed to lookup IFSC code",
		};
	}
};

// endregion: IFSC LOOKUP

// region: PINCODE LOOKUP

export type PincodeLookupResponseType = {
	success: boolean;
	pincode: string;
	location_details: {
		city: string;
		state: string;
		district: string;
		region: string;
	};
	message: string;
};

/**
 * Lookup pincode to get city and state information
 * Uses India Post public API directly
 */
export const lookupPincode = async (pincode: string) => {
	try {
		Logger.debug("Looking up pincode");
		const response = await axios.get<any>(`https://api.postalpincode.in/pincode/${pincode}`);
		const data = response.data;

		if (data && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
			const postOffice = data[0].PostOffice[0];

			const result = {
				success: true,
				pincode: pincode,
				location_details: {
					city: postOffice.District || postOffice.Block || "",
					state: postOffice.State || "",
					district: postOffice.District || "",
					region: postOffice.Region || "",
				},
				message: "Pincode details fetched successfully",
			};

			Logger.debug("Pincode lookup successful");
			return result;
		} else {
			Logger.debug("Invalid pincode or no data found");
			return {
				success: false,
				pincode: pincode,
				location_details: {
					city: "",
					state: "",
					district: "",
					region: "",
				},
				message: "Invalid pincode or no data found",
			};
		}
	} catch (error: any) {
		Logger.error("Pincode lookup failed", { message: error?.message });
		return {
			success: false,
			pincode: pincode,
			location_details: {
				city: "",
				state: "",
				district: "",
				region: "",
			},
			message: "Failed to lookup pincode",
		};
	}
};

// endregion: PINCODE LOOKUP

// region: BANK DETAILS SUBMISSION

export type BankDetailsSubmitRequestType = {
	account_holder_name?: string;
	account_number: string;
	confirm_account_number?: string;
	ifsc_code: string;
	bank_name: string;
	branch_name: string;
	account_type: string;
	city?: string;
	state?: string;
	district?: string;
};

export type BankDetailsSubmitResponseType = {
	success: boolean;
	message: string;
	verified: boolean;
	bank_details?: any;
};

export const submitBankDetails = async (data: BankDetailsSubmitRequestType) => {
	try {
		Logger.debug("Submitting bank details");
		const payload: Record<string, any> = {
			account_holder_name: data.account_holder_name,
			account_number: data.account_number,
			ifsc_code: data.ifsc_code,
			bank_name: data.bank_name,
			branch_name: data.branch_name,
			account_type: data.account_type ? data.account_type.toLowerCase() : "savings",
		};
		if (data.city) payload.city = data.city;
		if (data.state) payload.state = data.state;
		if (data.district) payload.district = data.district;

		const response = await axios.post(
			URLS.bank_details.submit,
			payload,
		);

		Logger.debug("Bank details submitted", { status: response.status });
		const raw = response.data;
		const innerData = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;

		return {
			success: raw?.success ?? true,
			message: raw?.message ?? "Bank details submitted successfully",
			verified: true,
			bank_details: innerData,
		};
	} catch (error: any) {
		Logger.error("Bank details submission failed", { status: error?.response?.status });
		throw error;
	}
};

// endregion: BANK DETAILS SUBMISSION

// region: GET BANK ACCOUNTS

export type BankAccount = {
	id: string;
	user_id: string;
	account_holder_name: string;
	account_number: string;
	account_number_masked: string;
	ifsc_code: string;
	bank_name: string;
	branch_name: string;
	city: string;
	state: string;
	account_type: string;
	is_primary: boolean;
	verified_by_lender: boolean;
	submitted_at: string;
};

export type GetBankAccountsResponseType = BankAccount[];

export const getBankAccounts = async (): Promise<GetBankAccountsResponseType> => {
	try {
		Logger.debug("Fetching bank accounts");
		const response = await axios.get(
			URLS.bank_details.get_accounts,
		);

		Logger.debug("Bank accounts fetched", { status: response.status });
		const raw = response.data;
		const list: any[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];

		return list.map((item, index) => ({
			id: String(item.id || item.uuid || ""),
			user_id: String(item.user_id || ""),
			account_holder_name: String(item.account_holder_name || ""),
			account_number: String(item.account_number || ""),
			account_number_masked: String(item.account_number_masked || item.account_number || ""),
			ifsc_code: String(item.ifsc_code || ""),
			bank_name: String(item.bank_name || ""),
			branch_name: String(item.branch_name || ""),
			city: String(item.city || ""),
			state: String(item.state || ""),
			account_type: String(item.account_type || "savings"),
			is_primary: index === 0,
			verified_by_lender: false,
			submitted_at: String(item.created_at || item.updated_at || ""),
		}));
	} catch (error: any) {
		Logger.error("Get bank accounts failed", { status: error?.response?.status });
		throw error;
	}
};

// endregion: GET BANK ACCOUNTS

// region: GET BANK DETAILS HB PARTNER

export type BankDetailsHbPartnerResponseType = {
	_id: string;
	user_id: string;
	account_holder_name: string;
	account_number: string;
	account_number_masked: string;
	ifsc_code: string;
	bank_name: string;
	branch_name: string;
	city: string;
	state: string;
	account_type: string;
	is_primary: boolean;
	verified_by_lender: boolean;
	submitted_at: string;
};

export const getBankDetailsHbPartner = async () => {
	Logger.debug("Calling getBankDetailsHbPartner");
	const response = await axios.get<BankDetailsHbPartnerResponseType>(
		URLS.bank_details.hb_partner,
	);
	Logger.debug("HB partner bank details response received", { status: response.status });

	return response.data;
};

// endregion: GET BANK DETAILS HB PARTNER
