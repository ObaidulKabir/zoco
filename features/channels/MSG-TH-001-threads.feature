@MSG-TH-001
Feature: Threaded Conversations
  As a channel member
  I want to reply directly to messages in focused threads
  So that deep side-discussions do not clutter the main channel feed

  Background:
    Given two active members "Rahim" ("rahim@acme.test") and "Sarah" ("sarah@acme.test") in organization "Acme Corp"
    And a channel "engineering" exists with both "Rahim" and "Sarah" as members

  Scenario: Starting a thread and replying updates thread count and participants
    Given "Rahim" sends a root message "Should we migrate to Valkey 8?" to channel "engineering"
    When "Sarah" replies in thread to the message with "Yes, benchmarks show 3x lower latency."
    Then the response status is 201
    And the thread reply count is 1
    And the thread participants include "Rahim" and "Sarah"
    When "Rahim" requests the thread messages for the root message
    Then the response status is 200
    And the thread message list contains "Yes, benchmarks show 3x lower latency."

  Scenario: Broadcast thread reply back to the main channel feed
    Given "Rahim" sends a root message "Sprint 4 planning agenda" to channel "engineering"
    When "Sarah" replies in thread with "Final decision: Deploy to staging Friday" and sets broadcast to channel true
    Then the response status is 201
    And the message appears in the thread replies
    And the message also appears in the main channel feed of "engineering" marked as a thread broadcast
