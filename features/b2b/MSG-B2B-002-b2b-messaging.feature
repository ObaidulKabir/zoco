@MSG-B2B-002 @P0
Feature: B2B Cross-Organization Direct Messaging
  As an organization member
  I want to exchange direct messages with members of connected partner organizations
  So that we can collaborate externally while keeping internal organization data isolated

  Scenario: Connected organizations exchange direct messages
    Given two connected organizations "Acme Corp" and "Tokyo Corp"
    And an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    And an active member "Tanaka" ("tanaka@tokyo.test") in organization "Tokyo Corp"
    When "Rahim" initiates a direct conversation with "Tanaka"
    And "Rahim" sends an encrypted message "Hello Tanaka from Acme Corp" to "Tanaka"
    Then the message status is 201
    And "Tanaka" receives the message in his conversation inbox

  Scenario: Cross-tenant isolation blocks direct messages when connection is not accepted
    Given an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    And an active member "Tanaka" ("tanaka@tokyo.test") in organization "Tokyo Corp"
    And "Acme Corp" and "Tokyo Corp" have no active B2B connection
    When "Rahim" attempts to start a direct message with "Tanaka"
    Then the response status is 403
    And the error code is "CROSS_TENANT_FORBIDDEN"

  Scenario: Disconnecting B2B relation prevents further messages
    Given two connected organizations "Acme Corp" and "Tokyo Corp"
    And an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    And an active member "Tanaka" ("tanaka@tokyo.test") in organization "Tokyo Corp"
    When "Rahim" disconnects the B2B connection with "Tokyo Corp"
    Then the response status is 200
    When "Rahim" attempts to start a direct message with "Tanaka"
    Then the response status is 403
    And the error code is "CROSS_TENANT_FORBIDDEN"

  Scenario: Cross-tenant leak test: Acme user cannot list Tokyo Corp internal channels
    Given two connected organizations "Acme Corp" and "Tokyo Corp"
    And an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    When "Rahim" attempts to list channels of "Tokyo Corp"
    Then the response status is 403
