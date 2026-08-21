@MSG-DM-002 @P0
Feature: Message actions (edit, delete, react, reply, pin)
  As an organization member
  I want to edit, delete, react, quote reply, and pin messages
  So that conversations are rich, flexible, and accurate

  Scenario: Edit own message within 15 minutes window
    Given an existing message sent 5 minutes ago by "Rahim" to "Sarah" with content "Original text"
    When "Rahim" edits the message to "Updated text"
    Then the response status is 200
    And the message is marked as edited
    And the updated ciphertext reflects "Updated text"

  Scenario: Edit rejected after 15 minutes window
    Given an existing message sent 20 minutes ago by "Rahim" to "Sarah" with content "Old text"
    When "Rahim" attempts to edit the message to "Late text"
    Then the response status is 400
    And the error code is "EDIT_WINDOW_EXPIRED"

  Scenario: Soft delete a message replaces content with placeholder
    Given an existing message sent by "Rahim" to "Sarah" with content "Sensitive info"
    When "Rahim" deletes the message
    Then the response status is 200
    And the message is marked as deleted
    And the message payload displays "This message was deleted"

  Scenario: Add and remove emoji reactions
    Given an existing message sent by "Rahim" to "Sarah"
    When "Sarah" adds reaction "👍" to the message
    Then the response status is 200
    And the message reactions include "👍" by "Sarah"
    When "Sarah" removes reaction "👍" from the message
    Then the reaction "👍" is removed for "Sarah"

  Scenario: Quoted reply references the parent message
    Given an existing message with ID "msg-123" sent by "Rahim"
    When "Sarah" sends a reply referencing "msg-123" with content "Agreed!"
    Then the reply message carries "reply_to_id" equal to "msg-123"

  Scenario: Pin a message requires Manager or higher role
    Given an existing message in a conversation between "Rahim" (member) and "Kamal" (manager)
    When "Kamal" pins the message
    Then the response status is 200
    And the message is marked as pinned
    When "Rahim" attempts to unpin the message
    Then the response status is 403
    And the error code is "PERMISSION_DENIED"
