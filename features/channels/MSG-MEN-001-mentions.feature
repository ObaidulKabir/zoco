@MSG-MEN-001
Feature: Mentions & Notification Parsing
  As a channel member
  I want to @mention individuals, the whole channel, or online members
  So that relevant team members are promptly alerted to critical discussions

  Background:
    Given two active members "Rahim" ("rahim@acme.test") and "Sarah" ("sarah@acme.test") in organization "Acme Corp"
    And a channel "dev-ops" exists with both "Rahim" and "Sarah" as members

  Scenario: Mentioning a specific user triggers direct mention notification
    When "Rahim" sends a message "@Sarah please review the cluster metrics" to channel "dev-ops"
    Then the response status is 201
    And "Sarah" receives a real-time notification with type "mention" from "Rahim"
    And the notification references channel "dev-ops"

  Scenario: @channel mentions all channel members
    When "Rahim" sends a message "@channel deployment starting in 5 minutes" to channel "dev-ops"
    Then the response status is 201
    And all members in channel "dev-ops" receive a "channel_mention" alert

  Scenario: @here mentions only active online members
    Given "Sarah" is online and "Kamal" is offline
    When "Rahim" sends a message "@here quick sync on production hotfix" to channel "dev-ops"
    Then the response status is 201
    And "Sarah" receives the online alert
    And "Kamal" does not receive an urgent active alert
