// LEGACY — old backend, disabled during in-house rebuild
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
 * 
 * @param ifscCode - 11 character IFSC code
 * @returns Promise with bank details
 */
export const lookupIFSC = async (ifscCode: string) => {
	try {
		// Use public IFSC API directly
		const response = await fetch(`https://ifsc.razorpay.com/${ifscCode}`);
		
		if (!response.ok) {
			return {
				success: false,
				ifsc_code: ifscCode,
				message: "Invalid IFSC code",
			};
		}

		const data = await response.json();

		console.log("IFSC Lookup Response:", data);

		// Transform the response to match expected format
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
		console.error("IFSC lookup error:", error);
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
 * Uses India Post public API directly (no backend required)
 * 
 * @param pincode - 6 digit Indian pincode
 * @returns Promise with location details including city, state, district
 */
export const lookupPincode = async (pincode: string) => {
	try {
		console.log("🔍 Looking up pincode using India Post API:", pincode);
		
		// Use axios for automatic dev mock interception & network management
		const response = await axios.get<any>(`https://api.postalpincode.in/pincode/${pincode}`);
		const data = response.data;

		console.log("📍 Pincode Lookup Response:", data);

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
			
			console.log("✅ Pincode lookup successful:", result);
			return result;
		} else {
			console.log("❌ Invalid pincode or no data found");
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
		console.error("❌ Pincode lookup error:", error);
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
	account_number: string;
	confirm_account_number: string;
	ifsc_code: string;
	bank_name: string;
	branch_name: string;
	account_type: string;
};

export type BankDetailsSubmitResponseType = {
	success: boolean;
	message: string;
	verified: boolean;
	bank_details?: {
		account_number: string;
		ifsc_code: string;
		bank_name: string;
		branch_name: string;
		account_type: string;
		account_holder_name?: string;
	};
};

export const submitBankDetails = async (data: BankDetailsSubmitRequestType) => {
	try {
		console.log("=== SUBMITTING BANK DETAILS ===");
		console.log("Endpoint:", URLS.bank_details.submit);
		Logger.debug("Submitting bank details", data);
		console.log("==============================");

		const response = await axios.post<Partial<BankDetailsSubmitResponseType>>(
			URLS.bank_details.submit,
			data,
		);

		console.log("=== BANK DETAILS SUBMIT RESPONSE ===");
		console.log("Status:", response.status);
		Logger.debug("Bank details submission response", response.data);
		console.log("===================================");

		return response.data;
	} catch (error: any) {
		console.error("❌ Bank details submission API error:", error);
		console.error("Error Response:", error?.response?.data);
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
		console.log("🔍 Fetching bank accounts from:", URLS.bank_details.get_accounts);
		const response = await axios.get<any>(
			URLS.bank_details.get_accounts,
		);

		console.log("=== GET BANK ACCOUNTS API RESPONSE ===");
		console.log("Status:", response.status);
		Logger.debug("Bank accounts response", response.data);
		console.log("Response Data Type:", typeof response.data);
		console.log("Is Array:", Array.isArray(response.data));
		console.log("Array Length:", Array.isArray(response.data) ? response.data.length : "N/A");
		console.log("Response Keys:", Object.keys(response.data || {}));
		console.log("Has 'data' property:", 'data' in (response.data || {}));
		console.log("Has 'bank_accounts' property:", 'bank_accounts' in (response.data || {}));
		console.log("Has 'accounts' property:", 'accounts' in (response.data || {}));
		console.log("=====================================");

		// Check if response is wrapped in an object
		if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
			// Try common wrapper keys
			if (response.data.bank_accounts) {
				console.log("⚠️ Found bank_accounts in response.data.bank_accounts");
				return response.data.bank_accounts;
			}
			if (response.data.accounts) {
				console.log("⚠️ Found accounts in response.data.accounts");
				return response.data.accounts;
			}
			if (response.data.data) {
				console.log("⚠️ Found data in response.data.data");
				return response.data.data;
			}
		}

		return response.data;
	} catch (error: any) {
		console.error("❌ Get bank accounts API error:", error);
		console.error("Error Response:", error?.response?.data);
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
	console.log("🚀 Calling GET /users/bank-details-hb-partner");
	const response = await axios.get<BankDetailsHbPartnerResponseType>(
		URLS.bank_details.hb_partner,
	);
	Logger.debug("HB partner bank details response", response.data);

	return response.data;
};

// endregion: GET BANK DETAILS HB PARTNER
