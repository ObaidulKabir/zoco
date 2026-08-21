@ORG-SETUP-004 @P1
Feature: Organization chart

  Scenario: Org chart is deferred when time does not allow in Sprint 2
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I request the organization chart
    Then the response status is 501
    And the error code is "NOT_IMPLEMENTED"
