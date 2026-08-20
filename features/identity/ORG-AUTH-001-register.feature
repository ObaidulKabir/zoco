@ORG-AUTH-001 @P0
Feature: User registration with email and password

  Scenario: Register creates a pending user and emails a 6-digit OTP
    Given a clean identity store
    When I register with name "Sarah Chen" email "sarah@acme.test" and password "CorrectH0rse!"
    Then the response status is 201
    And the user status is "pending_verification"
    And a verification email with a 6-digit OTP was sent to "sarah@acme.test"

  Scenario: Duplicate email is rejected with a clear error
    Given a clean identity store
    And a registered user "sarah@acme.test" with password "CorrectH0rse!"
    When I register with name "Sarah" email "sarah@acme.test" and password "CorrectH0rse!"
    Then the response status is 409
    And the error code is "DUPLICATE"

  Scenario: Weak and common passwords are rejected
    Given a clean identity store
    When I register with name "Sarah Chen" email "sarah@acme.test" and password "password"
    Then the response status is 400
    And the error code is "VALIDATION_ERROR"

  Scenario: Unverified user cannot access protected APIs
    Given a clean identity store
    When I register with name "Sarah Chen" email "sarah@acme.test" and password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    Then the response status is 403
    And the error code is "UNVERIFIED"

  Scenario: OTP verification activates the account and returns tokens
    Given a clean identity store
    When I register with name "Sarah Chen" email "sarah@acme.test" and password "CorrectH0rse!"
    And I verify email "sarah@acme.test" with the OTP from mail
    Then the response status is 200
    And the user status is "active"
    And access and refresh tokens are returned
