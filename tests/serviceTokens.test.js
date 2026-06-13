const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
	extractBearerToken,
	normalizeServiceIdentity,
	verifyServiceToken,
	verifyServiceTokenFromHeaders
} = require("@bigfootds/bigfootds-service-utils");

const policy = {
	acceptedCallers: [
		{ serviceId: "ms-auth", token: "auth-token" },
		{ serviceId: "ms-news", token: "news-token" }
	],
	allowedServiceIds: ["ms-auth"]
};

describe("service token helpers", () => {
	test("normalises package-style service identities", () => {
		assert.equal(normalizeServiceIdentity("@bigfootds/ms-auth"), "ms-auth");
		assert.equal(normalizeServiceIdentity("MS-AUTH"), "ms-auth");
	});

	test("extracts bearer tokens only from valid authorization headers", () => {
		assert.equal(extractBearerToken("Bearer abc123"), "abc123");
		assert.equal(extractBearerToken("bearer abc123"), "abc123");
		assert.equal(extractBearerToken("Basic abc123"), undefined);
		assert.equal(extractBearerToken("Bearer"), undefined);
		assert.equal(extractBearerToken("Bearer abc extra"), undefined);
	});

	test("authenticates and authorises allowed callers", () => {
		assert.deepEqual(
			verifyServiceToken({
				authorizationHeader: "Bearer auth-token",
				serviceIdentityHeader: "@bigfootds/ms-auth",
				policy
			}),
			{
				ok: true,
				caller: {
					serviceId: "ms-auth",
					declaredServiceId: "@bigfootds/ms-auth"
				}
			}
		);
	});

	test("distinguishes missing, invalid, and forbidden service-token failures", () => {
		assert.deepEqual(
			verifyServiceToken({
				policy
			}),
			{
				ok: false,
				reason: "missing_service_identity",
				errorCode: "service_token_missing",
				httpStatus: 401
			}
		);

		assert.deepEqual(
			verifyServiceToken({
				authorizationHeader: "Bearer wrong-token",
				serviceIdentityHeader: "ms-auth",
				policy
			}),
			{
				ok: false,
				reason: "token_mismatch",
				errorCode: "service_token_invalid",
				httpStatus: 401
			}
		);

		assert.deepEqual(
			verifyServiceToken({
				authorizationHeader: "Bearer news-token",
				serviceIdentityHeader: "ms-news",
				policy
			}),
			{
				ok: false,
				reason: "caller_not_allowed",
				errorCode: "service_forbidden",
				httpStatus: 403
			}
		);
	});

	test("verifies service tokens from case-insensitive headers", () => {
		assert.equal(
			verifyServiceTokenFromHeaders(
				{
					Authorization: "Bearer auth-token",
					ProductName: "@bigfootds/ms-auth"
				},
				policy
			).ok,
			true
		);
	});
});
