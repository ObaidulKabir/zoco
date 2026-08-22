@MSG-B2B-001 @P0
Feature: B2B Connection Requests
  As an organization owner or manager
  I want to send and manage connection requests with partner organizations
  So that we can collaborate externally while maintaining tenant isolation

  Scenario: Send a B2B connection request with an introduction message
    Given an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    And an active member "Tanaka" ("tanaka@tokyo.test") in organization "Tokyo Corp"
    When "Rahim" sends a B2B connection request to "Tokyo Corp" with message "We would like to connect for supply chain sync."
    Then the response status is 201
    And "Tokyo Corp" has a pending connection request from "Acme Corp"
    When "Tanaka" accepts the connection request from "Acme Corp"
    Then the response status is 200
    And "Acme Corp" and "Tokyo Corp" have an active B2B connection

  Scenario: Reject a B2B connection request
    Given an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    And an active member "Tanaka" ("tanaka@tokyo.test") in organization "Tokyo Corp"
    When "Rahim" sends a B2B connection request to "Tokyo Corp" with message "Intro request"
    And "Tanaka" rejects the connection request from "Acme Corp"
    Then the response status is 200
    And "Acme Corp" and "Tokyo Corp" are not connected

  Scenario: Block an organization to prevent future requests
    Given an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    And an active member "Tanaka" ("tanaka@tokyo.test") in organization "Tokyo Corp"
    When "Tanaka" blocks "Acme Corp"
    Then the response status is 200
    When "Rahim" sends a B2B connection request to "Tokyo Corp" with message "Please let us connect"
    Then the response status is 403
    And the error code is "B2B_CONNECTION_BLOCKED"

  Scenario: Enforce daily limit of connection requests per organization
    Given an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    When "Rahim" sends 10 B2B connection requests to different target organizations
    And "Rahim" attempts to send an 11th B2B connection request
    Then the response status is 400
    And the error code is "B2B_DAILY_LIMIT_EXCEEDED"
