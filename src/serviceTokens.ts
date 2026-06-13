import { timingSafeEqual } from "node:crypto";
import {
	ERROR_CODES,
	type GlobalErrorCode
} from "@bigfootds/bigfootds-shared-data";
import { getHeaderValue, type HeaderRecord } from "./requestIds";

/**
 * Header populated by `pkg-bigfoot-fetcher` with the caller's package/product name.
 */
export const SERVICE_CALLER_HEADER_NAME = "productName";

/**
 * Standard HTTP authorization header name.
 */
export const AUTHORIZATION_HEADER_NAME = "authorization";

/**
 * Expected authorization scheme for service tokens.
 */
export const SERVICE_TOKEN_AUTHORIZATION_SCHEME = "Bearer";

/**
 * Token accepted for one calling service.
 */
export interface ServiceTokenCredential {
	/**
	 * Canonical caller service ID, such as `ms-auth`.
	 */
	readonly serviceId: string;

	/**
	 * Secret token expected for this caller.
	 */
	readonly token: string;
}

/**
 * Route-level service caller policy.
 */
export interface ServiceCallerPolicy {
	/**
	 * Callers and tokens this target route can authenticate.
	 */
	readonly acceptedCallers: readonly ServiceTokenCredential[];

	/**
	 * Optional route-level allowlist. When omitted, all accepted callers are allowed.
	 */
	readonly allowedServiceIds?: readonly string[];

	/**
	 * Header used for caller identity. Defaults to `productName`.
	 */
	readonly serviceIdentityHeaderName?: string;

	/**
	 * Header used for bearer token authentication. Defaults to `authorization`.
	 */
	readonly authorizationHeaderName?: string;
}

/**
 * Authenticated service caller identity.
 */
export interface ServiceCaller {
	/**
	 * Canonical service ID after normalisation.
	 */
	readonly serviceId: string;

	/**
	 * Raw service identity value declared by the caller.
	 */
	readonly declaredServiceId: string;
}

export type ServiceTokenFailureReason =
	| "missing_service_identity"
	| "missing_authorization"
	| "malformed_authorization"
	| "unknown_service_identity"
	| "token_mismatch"
	| "caller_not_allowed";

export interface ServiceTokenVerificationSuccess {
	readonly ok: true;
	readonly caller: ServiceCaller;
}

export interface ServiceTokenVerificationFailure {
	readonly ok: false;
	readonly reason: ServiceTokenFailureReason;
	readonly errorCode: GlobalErrorCode;
	readonly httpStatus: 401 | 403;
}

export type ServiceTokenVerificationResult =
	| ServiceTokenVerificationSuccess
	| ServiceTokenVerificationFailure;

export interface VerifyServiceTokenInput {
	readonly authorizationHeader?: string;
	readonly serviceIdentityHeader?: string;
	readonly policy: ServiceCallerPolicy;
}

/**
 * Verifies a bearer service token and route-level service caller policy.
 */
export function verifyServiceToken(input: VerifyServiceTokenInput): ServiceTokenVerificationResult {
	const declaredServiceId = input.serviceIdentityHeader?.trim();

	if (declaredServiceId === undefined || declaredServiceId === "") {
		return unauthenticated("missing_service_identity");
	}

	const bearerToken = extractBearerToken(input.authorizationHeader);

	if (bearerToken === undefined) {
		return unauthenticated(
			input.authorizationHeader === undefined ? "missing_authorization" : "malformed_authorization"
		);
	}

	const serviceId = normalizeServiceIdentity(declaredServiceId);
	const credential = input.policy.acceptedCallers.find(
		(candidate) => normalizeServiceIdentity(candidate.serviceId) === serviceId
	);

	if (credential === undefined) {
		return unauthenticated("unknown_service_identity");
	}

	if (!tokensMatch(bearerToken, credential.token)) {
		return unauthenticated("token_mismatch");
	}

	if (!isCallerAllowed(serviceId, input.policy.allowedServiceIds)) {
		return {
			ok: false,
			reason: "caller_not_allowed",
			errorCode: ERROR_CODES.SERVICE_FORBIDDEN,
			httpStatus: 403
		};
	}

	return {
		ok: true,
		caller: {
			serviceId,
			declaredServiceId
		}
	};
}

/**
 * Verifies a service token from request headers.
 */
export function verifyServiceTokenFromHeaders(
	headers: HeaderRecord | undefined,
	policy: ServiceCallerPolicy
): ServiceTokenVerificationResult {
	return verifyServiceToken({
		authorizationHeader: getHeaderValue(
			headers,
			policy.authorizationHeaderName ?? AUTHORIZATION_HEADER_NAME
		),
		serviceIdentityHeader: getHeaderValue(
			headers,
			policy.serviceIdentityHeaderName ?? SERVICE_CALLER_HEADER_NAME
		),
		policy
	});
}

/**
 * Extracts a bearer token from an Authorization header.
 */
export function extractBearerToken(authorizationHeader?: string): string | undefined {
	if (authorizationHeader === undefined) {
		return undefined;
	}

	const [scheme, token, extra] = authorizationHeader.trim().split(/\s+/);

	if (
		extra !== undefined ||
		scheme?.toLowerCase() !== SERVICE_TOKEN_AUTHORIZATION_SCHEME.toLowerCase() ||
		token === undefined ||
		token === ""
	) {
		return undefined;
	}

	return token;
}

/**
 * Normalises package-style caller names into canonical BigfootDS project IDs.
 */
export function normalizeServiceIdentity(serviceIdentity: string): string {
	const trimmed = serviceIdentity.trim().toLowerCase();
	return trimmed.startsWith("@bigfootds/") ? trimmed.slice("@bigfootds/".length) : trimmed;
}

function unauthenticated(reason: ServiceTokenFailureReason): ServiceTokenVerificationFailure {
	const errorCode = reason === "missing_service_identity" || reason === "missing_authorization"
		? ERROR_CODES.SERVICE_TOKEN_MISSING
		: ERROR_CODES.SERVICE_TOKEN_INVALID;

	return {
		ok: false,
		reason,
		errorCode,
		httpStatus: 401
	};
}

function isCallerAllowed(
	serviceId: string,
	allowedServiceIds: readonly string[] | undefined
): boolean {
	if (allowedServiceIds === undefined) {
		return true;
	}

	return allowedServiceIds.map(normalizeServiceIdentity).includes(serviceId);
}

function tokensMatch(actualToken: string, expectedToken: string): boolean {
	const actual = Buffer.from(actualToken);
	const expected = Buffer.from(expectedToken);

	if (actual.length !== expected.length) {
		return false;
	}

	return timingSafeEqual(actual, expected);
}
