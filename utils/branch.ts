let _branchDeviceToken: string | null = null;

export function getBranchDeviceToken(): string | null {
  return _branchDeviceToken;
}

export function initBranch(): () => void {
  return () => {};
}

export function identifyBranchUser(userId: string): void {
  // No-op fallback
}

export function setBranchIdentity(userId: string): void {
  // No-op fallback
}

export function logoutBranch(): void {
  _branchDeviceToken = null;
}
