@ORG-SETUP-005 @P0
Feature: Member profile

  Scenario: Member updates profile and presence
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I update my profile with title "Founder" presence "away" and language "bn"
    Then the response status is 200
    And my profile title is "Founder"
    And my presence is "away"

  Scenario: Avatar upload URL is issued for valid images
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    When I request an avatar upload URL for type "image/png" and size 1024
    Then the response status is 200
    And an upload URL is returned
    When I request an avatar upload URL for type "image/png" and size 6000000
    Then the response status is 400
    And the error code is "VALIDATION_ERROR"
