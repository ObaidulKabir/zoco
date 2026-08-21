@ORG-SETUP-002 @P0
Feature: Invite members

  Scenario: Owner invites an existing user who accepts
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And a verified user "pat@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I invite emails "pat@acme.test" as role "member"
    Then the response status is 201
    And an invitation email was sent to "pat@acme.test"
    When I login with email "pat@acme.test" and password "CorrectH0rse!"
    And I accept the invitation for "pat@acme.test"
    Then the response status is 200
    And "pat@acme.test" is a member of the current organization
    And "pat@acme.test" is in channel "#general"

  Scenario: Duplicate pending invite is rejected
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I invite emails "new@wait.test" as role "member"
    And I invite emails "new@wait.test" as role "member"
    Then the response status is 409
    And the error code is "DUPLICATE"

  Scenario: CSV bulk invite parses emails
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I invite CSV:
      """
      email
      lee@acme.test
      admin@acme.test
      """
    Then the response status is 201
    And 2 invitations were created

  @tenant
  Scenario: Second tenant cannot see Acme members
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And a verified user "rahim@nodi.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    And I login with email "rahim@nodi.test" and password "CorrectH0rse!"
    And I create an organization named "Nodi Traders" in industry "Trading" size "1-10" country "BD" timezone "Asia/Dhaka"
    When I list members of the Acme organization as "rahim@nodi.test"
    Then the response status is 403
