@ORG-SETUP-006 @P0
Feature: Organization settings

  Scenario: Owner updates invitation policy
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I update organization settings with invitation policy "owner_only"
    Then the response status is 200
    And the invitation policy is "owner_only"
    And an org settings audit event was recorded

  Scenario: Member cannot change organization settings
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And a verified user "pat@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    And I invite emails "pat@acme.test" as role "member"
    And I login with email "pat@acme.test" and password "CorrectH0rse!"
    And I accept the invitation for "pat@acme.test"
    When I update organization settings with invitation policy "anyone"
    Then the response status is 403
