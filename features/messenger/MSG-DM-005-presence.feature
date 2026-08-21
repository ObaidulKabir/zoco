@MSG-DM-005 @P0
Feature: Real-time user presence
  As an organization member
  I want to see the presence status of my colleagues
  So that I know who is available to communicate

  Scenario: User presence transitions across online, away, and offline
    Given "Rahim" connects to the real-time gateway
    Then "Rahim"'s presence status is "online"
    And other members in "Acme Corp" receive "presence:update" with status "online"
    When "Rahim" sends a manual status update to "dnd"
    Then "Rahim"'s presence status is "dnd"
    When "Rahim" disconnects from the real-time gateway
    Then "Rahim"'s presence status becomes "offline" after the grace period
