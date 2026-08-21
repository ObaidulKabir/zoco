@ORG-SETUP-001 @P0
Feature: Create organization

  Scenario: Create organization with defaults
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    When I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    Then the response status is 201
    And the organization slug is "acme"
    And I am the organization owner
    And default departments "General" and "Management" exist
    And default channels "#general" and "#announcements" exist
    And a Discover profile stub exists

  Scenario: Slug collision gets a numeric suffix
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    When I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    Then the response status is 201
    And the organization slug is "acme-2"

  Scenario: Unauthenticated create is rejected
    Given a clean identity store
    When I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka" without a token
    Then the response status is 401

  Scenario: X-Org-Id selects the active tenant
    Given a clean identity store
    And a verified user "sarah@acme.test" with password "CorrectH0rse!"
    And I login with email "sarah@acme.test" and password "CorrectH0rse!"
    And I create an organization named "Acme" in industry "Software" size "11-50" country "BD" timezone "Asia/Dhaka"
    And I create an organization named "Nodi Traders" in industry "Trading" size "1-10" country "BD" timezone "Asia/Dhaka"
    When I list members with the Nodi organization header
    Then the response status is 200
    And the member list has 1 email "sarah@acme.test"
