@MSG-CH-002
Feature: Shared B2B Channels
  As an organization administrator
  I want to create cross-company channels shared with verified external partner organizations
  So that cross-company vendor and client teams can collaborate in a single shared channel

  Background:
    Given an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    And an active member "Tanaka" ("tanaka@tokyo.test") in organization "Tokyo Corp"

  Scenario: Create a shared B2B channel between two connected organizations
    When "Rahim" creates a shared channel "acme-tokyo-sync" and invites "Tokyo Corp"
    Then the response status is 201
    And the channel "acme-tokyo-sync" has type "shared"
    When "Tanaka" from "Tokyo Corp" accepts the shared channel invitation
    Then the response status is 200
    When "Tanaka" sends a message "Welcome to the joint collaboration space" to "acme-tokyo-sync"
    Then the response status is 201
    And "Rahim" in "Acme Corp" receives the message in "acme-tokyo-sync"
