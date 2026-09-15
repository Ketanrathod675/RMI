import { type Dispatch, type FC, type SetStateAction } from "react";
import { PrivacyPolicy } from "./PrivacyPolicy";
import { TermsAndConditions } from "./TermsAndConditions";

export const TermsAndPolicy: FC<{
	displayType?: "terms" | "policy";
	showModal: boolean;
	setShowModal: Dispatch<SetStateAction<boolean>>;
}> = ({ displayType = "terms", showModal, setShowModal }) => {
	if (displayType === "policy") {
		return <PrivacyPolicy showModal={showModal} setShowModal={setShowModal} />;
	}

	return <TermsAndConditions showModal={showModal} setShowModal={setShowModal} />;
};
