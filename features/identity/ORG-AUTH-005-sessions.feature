@ORG-AUTH-005 @P0
Feature: Session management

  Scenario: List sessions and revoke one
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    When I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I list sessions
    Then the response status is 200
    And at least 1 session is listed
    When I revoke the current session
    Then the response status is 204
    When I list sessions
    Then the response status is 401

  Scenario: Log out all devices
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    When I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I logout all devices
    Then the response status is 204
    When I list sessions
    Then the response status is 401
