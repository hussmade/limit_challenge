# AI assistance: engineering prompts

These are reconstructed prompt examples for specific issues addressed in the project, not a transcript. AI assistance covered implementation, testing and documentation.

## Data integrity

> Review the vehicle constraints. VINs must be unique across all vehicles, while case-insensitive license plates are unique only among active vehicles. Check reactivation and concurrent inserts. Keep friendly serializer validation, but enforce uniqueness in PostgreSQL as well.

## Query correctness and performance

> Check the office summary for inflated counts or costs when joining vehicles and maintenance records. Maintenance-date and mechanic filters must match the same service record. Verify that vehicle details with 300 maintenance records do not introduce N+1 queries, and add regression tests for these cases.

## Filter edge cases

> Investigate why omitted hasDocuments and hasNotes parameters are filtering the submission list. Distinguish an absent value from an explicit false, reject malformed values, and test inclusive UTC date boundaries and stable pagination.

## Session handling

> Review cookie-based JWT renewal and logout. Check CSRF enforcement, refresh-token rotation, and rejection after account deletion, deactivation or a password change. Investigate why clearing the query cache can leave the UI showing the previous session. Add regression coverage for the confirmed failures.
