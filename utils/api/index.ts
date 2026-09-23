/**
 * RapidMoney API Client & Domain Services Facade
 * 
 * Provides unified, typed access to the RapidMoney FastAPI Backend and all workflow services.
 * Structured into:
 * - core/      : HTTP client, URL endpoints registry, environment configuration
 * - types/     : Standard response envelopes, Auth schemas, User schemas
 * - services/  : Modular domain service implementations
 */

// Core Infrastructure
export * from "./core/config";
export * from "./core/endpoints";
export * from "./core/client";

// Shared Types & Models
export * from "./types/common";
export * from "./types/auth.types";
export * from "./types/user.types";

// Domain Services
export * from "./services/auth.service";
export * from "./services/user.service";
export * from "./services/loans.service";
export * from "./services/notifications.service";
export * from "./services/faq.service";
export * from "./services/video.service";

// LEGACY — old backend, disabled during in-house rebuild
// Domain Modules & Legacy Fallbacks
// export * from "./auth";
// export * from "./bank";
// export * from "./kyc";
// export * from "./loans";
// export * from "./notifications";
// export * from "./user";
