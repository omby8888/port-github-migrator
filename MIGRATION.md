# GitHub App to GitHub Ocean Migration Guide

This guide walks you through migrating your Port catalog from the legacy GitHub App integration to the new GitHub Ocean integration.

## Before You Start

- Install the migration tool: `npm install -g port-github-migration`
- Obtain Port API credentials (Client ID and Secret)
- Have both GitHub App and GitHub Ocean integration IDs available
- Ensure you have administrative access to your Port instance

## Phase 1: Initial Setup

### Step 1: Install GitHub Ocean Integration

1. Log in to your Port instance
2. Navigate to **Integrations**
3. Install the new **GitHub Ocean** integration
4. Complete the setup and note your **New Installation ID**
5. Leave the integration inactive for now

### Step 2: Clean Up Old Integration Mapping

1. In Port, navigate to the old **GitHub App** integration settings
2. Remove mappings for all blueprints **except** the `organization` blueprint
3. Perform a full resync of the old GitHub App integration
4. Verify that only `organization` entities remain

### Step 3: Validate and Restore if Needed

1. Check if any unintended changes were made to other entities
2. If changes occurred, resync the old GitHub App integration again to restore entities
3. Confirm all non-organization entities are back to their previous state

**You are now ready to begin blueprint migration.**

## Phase 2: Blueprint-by-Blueprint Migration

### Migration Process for Each Blueprint

For each blueprint you want to migrate, follow these steps:

#### Step 1: Create Dummy Blueprint

1. In Port, go to **Data Model > Blueprints**
2. Find the blueprint you want to migrate (e.g., `githubRepository`)
3. Click **Export** and copy the blueprint definition
4. Create a new blueprint with a temporary name (e.g., `githubRepository-dummy`)
5. Paste the definition and save

#### Step 2: Map New Integration to Dummy Blueprint

1. Go to the **GitHub Ocean** integration settings
2. Configure the integration to populate entities into your dummy blueprint
3. Trigger a resync to populate entities
4. Wait for the sync to complete

#### Step 3: Compare Entities

Use the migration tool to compare entities:

```bash
port-github-migrator get-diff githubRepository githubRepository-dummy
```

This shows:
- ✅ **Identical**: Entities that match perfectly
- ⚠️ **Not migrated**: Entities only in the old blueprint
- 📝 **Changed**: Entities that exist in both but have different data
- ❌ **Orphaned**: Entities only in the new blueprint

#### Step 4: Review Detailed Differences

For detailed field-level differences:

```bash
port-github-migrator get-diff githubRepository githubRepository-dummy --show-diffs
```

Export to a file for thorough review:

```bash
port-github-migrator get-diff githubRepository githubRepository-dummy --output diff-report.json
```

#### Step 5: Validate Entity Counts

Ensure the entity counts match:

```bash
port-github-migrator get-blueprints
```

Check that:
- Old blueprint entity count matches expected
- Dummy blueprint entity count matches expected
- No significant discrepancies exist

#### Step 6: Verify Entity Data

If differences exist:
- Review the detailed diff report
- Identify which fields changed
- Determine if changes are acceptable
- Consider if data transformation is needed

**Do not proceed to migration if data mismatches exist.**

#### Step 7: Perform Migration

Once entities are validated as identical:

```bash
port-github-migrator migrate githubRepository
```

The tool will:
1. Show how many entities will be affected
2. Display a warning (migration cannot be undone)
3. Require you to type "yes" to confirm
4. Update entity ownership to the new integration

**Alternatively, dry-run first:**

```bash
port-github-migrator migrate githubRepository --dry-run
```

#### Step 8: Verify Migration

After migration:

1. Check the old blueprint to confirm entities were migrated
2. Verify entity counts remain the same
3. Check that entities now show the new GitHub Ocean integration

#### Step 9: Update Original Blueprint

Once migration is confirmed:

1. Go back to the original blueprint settings
2. Configure the **GitHub Ocean** integration to populate it
3. Delete the dummy blueprint
4. Trigger a resync on the original blueprint

### Repeat for Remaining Blueprints

Repeat Steps 1-9 for each blueprint until all are migrated.

## Phase 3: Final Cleanup

### Step 1: Disable Old Integration

1. Go to the old **GitHub App** integration settings
2. Disable or remove the integration
3. Confirm all data is now owned by GitHub Ocean

### Step 2: Verify Complete Migration

```bash
port-github-migrator get-blueprints
```

Verify that all blueprints are now managed by the GitHub Ocean integration.

### Step 3: Test End-to-End

1. Verify that entities update correctly from GitHub
2. Test that new entities are created with the new integration
3. Confirm webhooks work properly

## Migration Commands Reference

### Compare Blueprints
```bash
port-github-migrator get-diff <source> <target>
```

### List Available Blueprints
```bash
port-github-migrator get-blueprints
```

### Migrate with Dry Run
```bash
port-github-migrator migrate <blueprint> --dry-run
```

### Migrate Blueprint
```bash
port-github-migrator migrate <blueprint>
```

### Migrate All Blueprints
```bash
port-github-migrator migrate --all
```

## Troubleshooting

### Entities Don't Match

**Problem**: `get-diff` shows mismatched entities

**Solution**:
1. Review the detailed diff report with `--output`
2. Identify which fields differ
3. Check if GitHub Ocean is configured correctly
4. Consult with your GitHub Ocean integration setup

### Migration Fails

**Problem**: Migration command returns an error

**Solution**:
1. Verify credentials are correct
2. Ensure the blueprint name is spelled correctly
3. Check that the installation IDs are valid
4. Run with `--verbose` for more details

### Too Many Differences

**Problem**: `get-diff` shows many changed entities

**Solution**:
1. This may indicate a configuration difference
2. Stop and review the GitHub Ocean integration setup
3. Compare with the old GitHub App configuration
4. Ensure both are pulling data from the same GitHub account

### Entities Lost After Migration

**Problem**: Entities disappear after migration

**Solution**:
1. Do NOT proceed with other blueprints
2. Contact Port support immediately
3. Provide the X-Trace-Id header from failed requests
4. Migration may need to be rolled back

## Best Practices

1. **Migrate one blueprint at a time** - Don't migrate everything at once
2. **Always compare before migrating** - Use `get-diff` to validate
3. **Test with dry-run first** - Use `--dry-run` to preview changes
4. **Keep backups** - Have entity exports before migration
5. **Schedule during low-traffic times** - Avoid peak usage times
6. **Have rollback plan** - Know how to restore from backups
7. **Verify after each blueprint** - Confirm success before moving to next

## Need Help?

- Review command help: `port-github-migrator help <command>`
- Check the tool README: See [README.md](./README.md)
- Contact Port support with your X-Trace-Id header

