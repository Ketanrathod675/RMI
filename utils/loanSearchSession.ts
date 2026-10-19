/**
 * Remembers that the "Searching for best loan" loader already ran in this app session,
 * so /loan-approved can never be shown without it (queue on or off, resume or fresh).
 */
let loanSearchDone = false;

export const hasLoanSearchRun = (): boolean => loanSearchDone;
export const markLoanSearchDone = (): void => {
	loanSearchDone = true;
};
export const resetLoanSearchSession = (): void => {
	loanSearchDone = false;
};
