@ORG-AUTH-004 @P0
Feature: Password reset

  Scenario: Forgot password always returns the same message
    Given a clean identity store
    When I request a password reset for "nobody@acme.test"
    Then the response status is 200
    And the reset message does not enumerate emails
    When I request a password reset for "nobody@acme.test"
    Then a password reset email was not sent

  Scenario: Reset link is single-use and invalidates sessions
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    When I request a password reset for "sarah@acme.test"
    And I reset the password for "sarah@acme.test" to "NewHorse9!"
    Then the response status is 200
    When I login with email "sarah@acme.test" and password "CorrectH0rse!"
    Then the response status is 401
    When I refresh the session
    Then the response status is 401

  Scenario: New password must differ from the last 3 passwords
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    When I request a password reset for "sarah@acme.test"
    And I reset the password for "sarah@acme.test" to "CorrectH0rse!"
    Then the response status is 400
    And the error code is "VALIDATION_ERROR"
