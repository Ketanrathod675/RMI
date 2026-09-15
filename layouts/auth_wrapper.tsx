import { useAuth } from "@/hooks/useAuth";
import { useEffect, type FC, type ReactNode } from "react";

export const AuthWrapper: FC<{
	children: ReactNode;
	roles?: string[];
}> = ({ children }) => {
	const { accessToken } = useAuth();

	useEffect(() => {
		// No-op
	}, [accessToken]);

	return <>{children}</>;
};

export default AuthWrapper;
