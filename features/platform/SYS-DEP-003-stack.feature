@SYS-DEP-003 @P0
Feature: Self-hosted stack with no vendor accounts

  Scenario: Stack starts with no vendor accounts
    Given a clean clone and copied .env.example
    When I run docker compose up
    Then api /health is 200 within 5 minutes
    And no outbound call is made to a third-party SaaS
