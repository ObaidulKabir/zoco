@MSG-DM-003 @P0
Feature: Real-time typing indicators
  As a conversation participant
  I want to see when my peer is typing
  So that I know a response is being prepared

  Scenario: Emit typing start and stop events
    Given an active conversation between "Rahim" and "Sarah"
    When "Rahim" emits "typing_start" for the conversation
    Then "Sarah" receives a real-time event "typing:start" with userId "Rahim"
    When 3 seconds pass without typing or "Rahim" emits "typing_stop"
    Then "Sarah" receives a real-time event "typing:stop" with userId "Rahim"
