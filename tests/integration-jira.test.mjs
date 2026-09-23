import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  classifyJiraStatus,
  createJiraConnectionRequest,
  JiraConnectionError,
  normalizeJiraSiteUrl,
  parseJiraAccount,
} from "../src/features/integration/jira-connection.ts";

test("normalizes safe Jira Cloud site URLs", () => {
  assert.equal(
    normalizeJiraSiteUrl(
      "https://synapse-test.atlassian.net/"
    ),
    "https://synapse-test.atlassian.net"
  );
});

test("rejects unsafe Jira site URLs", () => {
  for (const siteUrl of [
    "http://synapse-test.atlassian.net",
    "https://example.com",
    "https://atlassian.net",
    "https://user:password@synapse-test.atlassian.net",
    "https://synapse-test.atlassian.net:8443",
    "https://synapse-test.atlassian.net/jira",
    "https://synapse-test.atlassian.net?redirect=example",
    "not-a-url",
  ]) {
    assert.throws(
      () =>
        normalizeJiraSiteUrl(
          siteUrl
        ),
      JiraConnectionError
    );
  }
});

test("builds a Basic-authenticated Jira account request", () => {
  const email =
    "owner@example.com";
  const apiToken =
    "jira-api-token-example";

  const request =
    createJiraConnectionRequest({
      siteUrl:
        "https://synapse-test.atlassian.net/",
      email,
      apiToken,
    });

  const url = new URL(request.url);
  const headers = new Headers(
    request.init.headers
  );

  assert.equal(
    url.origin,
    "https://synapse-test.atlassian.net"
  );

  assert.equal(
    url.pathname,
    "/rest/api/3/myself"
  );

  assert.equal(url.search, "");

  assert.equal(
    headers.get("Authorization"),
    `Basic ${Buffer.from(
      `${email}:${apiToken}`,
      "utf8"
    ).toString("base64")}`
  );

  assert.equal(
    request.url.includes(email),
    false
  );

  assert.equal(
    request.url.includes(apiToken),
    false
  );
});

test("parses a safe Jira account profile", () => {
  assert.deepEqual(
    parseJiraAccount(
      JSON.stringify({
        accountId:
          "712020:account-id",
        displayName:
          "Shubham Shaw",
        emailAddress:
          "owner@example.com",
        active: true,
        avatarUrls: {
          "48x48":
            "https://example.com/avatar.png",
        },
        groups: {
          size: 100,
          items: [],
        },
      })
    ),
    {
      accountId:
        "712020:account-id",
      displayName:
        "Shubham Shaw",
      emailAddress:
        "owner@example.com",
      active: true,
    }
  );
});

test("accepts a Jira profile without a visible email address", () => {
  assert.deepEqual(
    parseJiraAccount(
      JSON.stringify({
        accountId:
          "712020:account-id",
        displayName:
          "Shubham Shaw",
        active: true,
      })
    ),
    {
      accountId:
        "712020:account-id",
      displayName:
        "Shubham Shaw",
      emailAddress: null,
      active: true,
    }
  );
});

test("rejects malformed Jira account responses", () => {
  assert.throws(
    () =>
      parseJiraAccount("not-json"),
    JiraConnectionError
  );

  assert.throws(
    () =>
      parseJiraAccount(
        JSON.stringify({
          displayName:
            "Missing account ID",
          active: true,
        })
      ),
    JiraConnectionError
  );

  assert.throws(
    () =>
      parseJiraAccount(
        JSON.stringify({
          accountId:
            "712020:account-id",
          displayName:
            "Inactive field missing",
        })
      ),
    JiraConnectionError
  );
});

test("classifies Jira response statuses", () => {
  assert.equal(
    classifyJiraStatus(401).status,
    "INVALID_CREDENTIALS"
  );

  assert.equal(
    classifyJiraStatus(403).status,
    "INVALID_CREDENTIALS"
  );

  assert.equal(
    classifyJiraStatus(404).status,
    "INVALID_CREDENTIALS"
  );

  assert.equal(
    classifyJiraStatus(429).status,
    "PROVIDER_UNAVAILABLE"
  );

  assert.equal(
    classifyJiraStatus(500).status,
    "PROVIDER_UNAVAILABLE"
  );
});
