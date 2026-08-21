@MSG-DM-004 @P0
Feature: Read receipts and delivery tracking
  As a message sender
  I want to know when my message was delivered and read
  So that I have confirmation of receipt

  Scenario: Message lifecycle transitions from Sent to Delivered to Read
    Given "Rahim" sends a direct message to "Sarah"
    Then the initial message status is "sent"
    When "Sarah"'s client acknowledges receipt
    Then the message status is updated to "delivered"
    When "Sarah" views the conversation
    Then the message status is updated to "read"
    And "Rahim" receives a real-time event "message:receipt" with status "read"
