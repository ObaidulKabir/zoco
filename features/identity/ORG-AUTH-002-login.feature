@ORG-AUTH-002 @P0
Feature: User login

  Scenario: Active user can log in
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    When I login with email "sarah@acme.test" and password "CorrectH0rse!"
    Then the response status is 200
    And access and refresh tokens are returned
    And organizations list is empty
    And a login audit event was recorded

  Scenario: Invalid credentials are generic (no email enumeration)
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    When I login with email "missing@acme.test" and password "CorrectH0rse!"
    Then the response status is 401
    And the error message is "Invalid email or password"
    When I login with email "sarah@acme.test" and password "WrongPass1!"
    Then the response status is 401
    And the error message is "Invalid email or password"

  Scenario: Five failed logins lock the account for 30 minutes
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    When I fail login 5 times for "sarah@acme.test"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    Then the response status is 403
    And the error code is "LOCKED"

  Scenario: Refresh token rotation invalidates the previous refresh token
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    When I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I refresh the session
    Then the response status is 200
    And access and refresh tokens are returned
    When I refresh using the previous refresh token
    Then the response status is 401
