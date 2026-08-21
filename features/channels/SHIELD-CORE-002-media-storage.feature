@SHIELD-CORE-002
Feature: Media Storage & Virus Quarantine
  As an enterprise security administrator
  I want media uploads stored in self-hosted S3 and scanned for malicious content
  So that data stays strictly within self-hosted infrastructure and viruses are quarantined

  Background:
    Given an active member "Rahim" ("rahim@acme.test") in organization "Acme Corp"

  Scenario: Request pre-signed upload URL for local MinIO S3 storage
    When "Rahim" requests an upload URL for file "quarterly-report.pdf" of size 1048576 bytes and type "application/pdf"
    Then the response status is 200
    And the response provides an upload URL targeting bucket "zoqo-media"
    And a pre-signed auth signature is returned

  Scenario: Clean file passes virus scan and becomes accessible
    Given "Rahim" uploaded a clean file "architecture.png"
    When the scanning pipeline scans "architecture.png"
    Then the file status is marked as "CLEAN"
    And the file download URL is accessible to authorized channel members

  Scenario: Infected file is quarantined and blocked from download
    Given "Rahim" uploaded an infected file "eicar-test.com"
    When the scanning pipeline detects malware in "eicar-test.com"
    Then the file status is marked as "QUARANTINED"
    And attempts to download "eicar-test.com" are rejected with status 403
    And the error code is "FILE_QUARANTINED"
