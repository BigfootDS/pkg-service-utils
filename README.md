# BigfootDS Service Utils

Reusable service-side utilities for BigfootDS microservices.

This package helps services apply the same request, error, and internal-caller conventions without copying helper code into each service. It is a package, not a service, and it does not own runtime data.

## First-Pass Scope

- request ID generation, validation, inbound resolution, active request metadata, and response-header wiring
- standard JSON error helpers built from the global error catalogue in `@bigfootds/bigfootds-shared-data`
- framework-neutral bearer service-token verification and service caller policy results
- thin Express-style adapters for request IDs, service-token verification, and standard error responses

Deferred areas include broad validation helpers, audit helpers, Morgan logging helpers, admin/operator bulk helpers, and profanity matching/normalisation helpers.

## Public Package Safety

This package is publicly published on NPM, so its contents must be safe for public-facing usage.

It should contain reusable code, public type definitions, and public convention constants only.

Do not put secrets, service-token values, private route policies, private diagnostics, account data, provider payloads, environment-specific URLs, live-ops configuration, audit records, or service-owned runtime data in this package.

Service-token helpers accept token values at runtime from the consuming service. Tokens should come from that service's environment or secret manager, never from this package.

## Installation

Install using the organisatio-scoped name like below: 

```sh
npm install @bigfootds/bigfootds-service-utils
```

## Request IDs

```ts
import {
	resolveRequestIdFromHeaders,
	writeRequestIdHeader
} from "@bigfootds/bigfootds-service-utils";

const metadata = resolveRequestIdFromHeaders(request.headers);

writeRequestIdHeader(response, metadata.requestId);
```

Inbound `x-request-id` values are accepted only when they are safe ASCII, 8-64 characters long, and contain letters, numbers, `.`, `_`, `:`, or `-`. Missing or unsafe values are replaced with a generated UUID.

## Standard Errors

```ts
import {
	ERROR_CODES
} from "@bigfootds/bigfootds-shared-data";
import {
	createServiceError,
	serializeServiceError
} from "@bigfootds/bigfootds-service-utils";

const error = createServiceError(ERROR_CODES.VALIDATION_FAILED, {
	message: "Display name is required.",
	safeDetails: { field: "displayName" },
	requestId: "req_123456"
});

const { httpStatus, body } = serializeServiceError(error);
```

Serialised errors include stable `error.code` values and safe messages. They do not include stack traces, causes, tokens, or private diagnostics.

## Service Tokens

```ts
import {
	verifyServiceTokenFromHeaders
} from "@bigfootds/bigfootds-service-utils";

const result = verifyServiceTokenFromHeaders(request.headers, {
	acceptedCallers: [
		{
			serviceId: "ms-auth",
			token: process.env.ACCEPT_MS_AUTH_SERVICE_TOKEN ?? ""
		}
	],
	allowedServiceIds: ["ms-auth"]
});

if (!result.ok) {
	console.log(result.errorCode);
}
```

Callers send tokens with `Authorization: Bearer <token>`. Caller identity comes from the existing `pkg-bigfoot-fetcher` `productName` header. Package-style identities such as `@bigfootds/ms-auth` are normalised to canonical Project IDs such as `ms-auth`.

## Express Adapters

The Express adapters use structural types, so this package does not require Express as a dependency.

```ts
import {
	requestIdMiddleware,
	serviceTokenMiddleware,
	standardErrorHandler
} from "@bigfootds/bigfootds-service-utils";

app.use(requestIdMiddleware());

app.post(
	"/internal/auth-user-deleted",
	serviceTokenMiddleware({
		acceptedCallers: [
			{
				serviceId: "ms-auth",
				token: process.env.ACCEPT_MS_AUTH_SERVICE_TOKEN ?? ""
			}
		],
		allowedServiceIds: ["ms-auth"]
	}),
	controller
);

app.use(standardErrorHandler());
```

## Package Boundary

`pkg-service-utils` depends on `@bigfootds/bigfootds-shared-data` for stable Project Definitions, error-code metadata, and shared response data shapes.

Do not copy shared data into this package. Do not make `pkg-shared-data` depend on this package.

The intended dependency direction is:

```text
microservice -> pkg-service-utils -> pkg-shared-data
```
