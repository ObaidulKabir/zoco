@MSG-CH-001
Feature: Channels & Group Messaging
  As an organization member
  I want to create, browse, and participate in public, private, and announcement channels
  So that our teams can collaborate in organized, topical spaces

  Background:
    Given two active members "Rahim" ("rahim@acme.test") and "Sarah" ("sarah@acme.test") in organization "Acme Corp"
    And a third member "Kamal" ("kamal@acme.test") in organization "Acme Corp"

  Scenario: Default channels general and announcements are automatically available
    When "Rahim" requests the channel list for "Acme Corp"
    Then the response status is 200
    And the channel list contains "general" and "announcements"
    And "Rahim" and "Sarah" and "Kamal" are all members of "general" and "announcements"

  Scenario: Create a public channel and join it
    When "Rahim" creates a public channel named "engineering" with topic "Software design"
    Then the response status is 201
    And the channel "engineering" has type "public"
    When "Sarah" joins the channel "engineering"
    Then the response status is 200
    And "Sarah" is listed as an active member of "engineering"

  Scenario: Private channel restricts access to invited members only
    When "Rahim" creates a private channel named "finance-confidential" with topic "Executive reviews"
    Then the response status is 201
    And the channel "finance-confidential" has type "private"
    When "Sarah" attempts to view messages in "finance-confidential" without an invitation
    Then the response status is 403
    And the error code is "CHANNEL_ACCESS_DENIED"
    When "Rahim" invites "Sarah" to "finance-confidential"
    Then the response status is 200
    When "Sarah" views messages in "finance-confidential"
    Then the response status is 200

  Scenario: Announcement channels allow posting only by Managers or Admins
    When "Rahim" creates an announcement channel named "company-news"
    Then the response status is 201
    And the channel "company-news" has type "announcement"
    When "Sarah" (member) attempts to send a message "Hello all!" to "company-news"
    Then the response status is 403
    And the error code is "ANNOUNCEMENT_POST_RESTRICTED"
    When "Rahim" (owner) sends a message "Townhall meeting tomorrow at 3 PM." to "company-news"
    Then the response status is 201
    And all members in "Acme Corp" receive the broadcast message
