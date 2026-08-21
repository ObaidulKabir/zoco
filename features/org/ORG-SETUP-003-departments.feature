@ORG-SETUP-003 @P0
Feature: Departments and teams

  Scenario: Create a nested department within five levels
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I create a department named "Engineering" under "General"
    Then the response status is 201
    And the department tree contains "Engineering"

  Scenario: Sixth department level is rejected
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I create five nested departments under "General"
    And I create a sixth nested department
    Then the response status is 400
    And the error code is "VALIDATION_ERROR"

  Scenario: Deleting a department requires reassignment
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I create a department named "Engineering" under "General"
    And I assign myself to department "Engineering"
    And I delete department "Engineering" without reassignment
    Then the response status is 400
    And the error code is "VALIDATION_ERROR"
    When I delete department "Engineering" reassigning to "General"
    Then the response status is 204

  Scenario: Create a team in a department
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I create a team named "Platform" in department "General"
    Then the response status is 201
    And the team list contains "Platform"
