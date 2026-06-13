# BigfootDS Service Utils

Reusable service-side utilities for BigfootDS microservices.

This package helps services apply the same request, error, and internal-caller conventions without copying helper code into each service. It is a package, not a service, and it does not own runtime data.

## To-Do List

- [x] Morgan logging helpers
- [x] Profanity matching/normalisation helpers.
- [ ] Broad validation helpers
- [ ] Audit helpers
- [ ] Admin/operator bulk helpers


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

## Morgan Logging

Use the BigfootDS Morgan logger to emit one-line request logs similar to the current microservice convention, with request ID support added:

```ts
import {
	createBigfootDSMorganLogger,
	requestIdMiddleware
} from "@bigfootds/bigfootds-service-utils";

app.use(requestIdMiddleware());
app.use(createBigfootDSMorganLogger());
```

Logging is disabled by default when `NODE_ENV` is `test`. The default format is exported as `BIGFOOTDS_MORGAN_FORMAT` if a service needs to pass it to Morgan directly.

## Profanity And Restricted Words

Runtime profanity handling lives here, while the static word lists and metadata stay in `@bigfootds/bigfootds-shared-data`.

```ts
import {
	chatProfanityHandler,
	playerNameProfanityHandler
} from "@bigfootds/bigfootds-service-utils";

const chatHasProfanity = chatProfanityHandler.exists("I like big butts and I cannot lie");
const nameResult = playerNameProfanityHandler.check("BigfootDS_Admin");
```

Use the lower-level helpers when a service needs direct list matching or normalisation:

```ts
import {
	findProfanityListMatches,
	normalizeModerationText
} from "@bigfootds/bigfootds-service-utils";

const normalised = normalizeModerationText("  BigfootDS\tAdmin  ");
const matches = findProfanityListMatches(normalised);
```

## Package Boundary

`pkg-service-utils` depends on `@bigfootds/bigfootds-shared-data` for stable Project Definitions, error-code metadata, and shared response data shapes.

Do not copy shared data into this package. Do not make `pkg-shared-data` depend on this package.

The intended dependency direction is:

```text
microservice -> pkg-service-utils -> pkg-shared-data
```
