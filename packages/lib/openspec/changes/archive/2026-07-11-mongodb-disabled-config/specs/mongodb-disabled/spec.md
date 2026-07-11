## ADDED Requirements

### Requirement: Global MongoDB disable via config

When `mongodb.disabled: true` in config, the system SHALL gracefully skip all MongoDB-dependent functionality without throwing errors.

#### Scenario: mongodb.ts init skips when disabled

- **WHEN** `mongodb.ts:init` is called with config `{ disabled: true }`
- **THEN** it SHALL log a warning and return an empty array without connecting

#### Scenario: mongoClient returns null when no instances

- **WHEN** `mongoClient()` or `mongoClientSync()` is called and no MongoDB connections exist
- **THEN** it SHALL log a warning and return `null`

#### Scenario: agenda skips MongoDB-dependent init

- **WHEN** agenda init calls `mongoClient()` and receives `null`
- **THEN** agenda SHALL skip initialization and return an empty object

#### Scenario: fs skips domain DB setup

- **WHEN** `fs.ts:initMongoDb` calls `mongoClient()` and receives `null`
- **THEN** fs SHALL skip the per-domain MongoDB setup and return `false`
