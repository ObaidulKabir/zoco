@ORG-AUTH-003 @P1
Feature: TOTP multi-factor authentication

  Scenario: MFA enable is deferred when time does not allow in Sprint 1
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    When I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I enable MFA
    Then the response status is 501
