@MSG-DM-001 @P0
Feature: Send and receive direct messages
  As an organization member
  I want to send 1:1 direct messages to my colleagues
  So that we can communicate in real time with end-to-end privacy

  Scenario: Start a 1:1 direct conversation and send an encrypted message
    Given two active members "Rahim" ("rahim@acme.test") and "Sarah" ("sarah@acme.test") in organization "Acme Corp"
    When "Rahim" initiates a direct conversation with "Sarah"
    And "Rahim" sends an encrypted message "Hello Sarah, let's discuss the quarterly goals." to "Sarah"
    Then the message status is 201
    And the database record for the message contains ciphertext and no plaintext "Hello Sarah"
    And "Sarah" receives the message in her conversation inbox

  Scenario: Cannot send direct message to a user outside the organization without B2B connection
    Given an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"
    And an active member "Tanaka" ("tanaka@tokyo.test") in organization "Tokyo Corp"
    When "Rahim" attempts to start a direct message with "Tanaka"
    Then the response status is 403
    And the error code is "CROSS_TENANT_FORBIDDEN"

  Scenario: Offline recipient receives queued messages upon reconnecting
    Given two active members "Rahim" and "Sarah" in organization "Acme Corp"
    And "Sarah" is currently offline
    When "Rahim" sends an encrypted message "Check this when you log in." to "Sarah"
    And "Sarah" comes online and requests conversation history
    Then "Sarah" receives the unread message "Check this when you log in."
