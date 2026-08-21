@SHIELD-CORE-001 @P0 @security
Feature: End-to-end encrypted message envelope and X3DH key exchange
  As a privacy-conscious organization member
  I want my direct messages to be end-to-end encrypted with X3DH key exchange
  So that neither unauthorized parties nor the server can inspect message plaintext

  Scenario: Publish and fetch X3DH prekey bundle
    Given an active member "Sarah"
    When "Sarah" registers her X3DH prekey bundle with identity key, signed prekey, and one-time prekeys
    Then the prekey bundle is stored for "Sarah"
    When "Rahim" requests the prekey bundle for "Sarah"
    Then "Rahim" receives "Sarah"'s identity key, signed prekey, signature, and one single-use prekey

  Scenario: Direct message envelope contains only ciphertext in database
    Given "Rahim" encrypts a message for "Sarah" using an ephemeral symmetric key and X3DH envelope
    When the message is persisted to the database
    Then querying the `messages` table directly reveals:
      | column             | value_type  | contains_plaintext |
      | content_ciphertext | base64_hex  | false              |
      | envelope_iv        | hex_string  | false              |
      | envelope_tag       | hex_string  | false              |
    And no plaintext is found in the database row
