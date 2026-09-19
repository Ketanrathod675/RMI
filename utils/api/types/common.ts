/**
 * Standard Unified Response Envelopes matching FastAPI Backend
 */
export interface StandardResponse<T = any> {
	success: boolean;
	message: string;
	data: T;
}

export interface PaginatedData<T> {
	items: T[];
	total: number;
	page: number;
	page_size: number;
	total_pages: number;
}

export interface PaginatedResponse<T> {
	success: boolean;
	message: string;
	data: PaginatedData<T>;
}

export interface ApiError {
	detail?: string | Array<{ loc: string[]; msg: string; type: string }>;
	message?: string;
	status?: number;
}
