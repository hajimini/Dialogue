# Rollback Migration Guide

This guide explains how to rollback a Mem0 migration and restore your data from a backup.

## Overview

The rollback script (`rollback-migration.ts`) allows you to:

1. **Restore data from backup** - Restore memories and user profiles from a backup file to your local `app-store.json`
2. **Clear Supabase data** (optional) - Remove all migrated data from Supabase
3. **Verify rollback** - Confirm that data was restored correctly
4. **Generate report** - Create a detailed rollback report

## Prerequisites

- A backup file created by the migration script (located in `.data/backups/`)
- Node.js and TypeScript installed
- (Optional) Supabase credentials if you want to clear Supabase data

## Usage

### Option 1: Use Latest Backup (Recommended)

This automatically finds and uses the most recent backup file:

```bash
npx tsx scripts/rollback-migration.ts --latest
```

### Option 2: Specify Backup File

If you want to use a specific backup:

```bash
npx tsx scripts/rollback-migration.ts --backup=.data/backups/app-store-before-mem0-migration-2026-03-28T12-00-00-000Z.json
```

### Option 3: Rollback and Clear Supabase

To restore local data AND clear Supabase:

```bash
npx tsx scripts/rollback-migration.ts --latest --clear-supabase
```

## What Happens During Rollback

### Step 1: Backup Selection
- If `--latest` is used, the script finds the most recent backup file
- If `--backup=<path>` is used, the specified file is loaded
- The backup file is validated

### Step 2: Restore to Local
- The backup data is read
- Your current `app-store.json` is **overwritten** with the backup data
- Memories and user profiles are restored

### Step 3: Clear Supabase (Optional)
- Only runs if `--clear-supabase` flag is provided
- Requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` environment variables
- Deletes all memories from the `memories` table
- Deletes all profiles from the `user_profiles_per_persona` table

### Step 4: Verification
- Counts memories and profiles in local app store
- Counts memories and profiles in Supabase (if credentials available)
- Compares counts with expected values

### Step 5: Report Generation
- Creates a detailed JSON report in `.data/rollback-report-<timestamp>.json`
- Displays summary in console

## Safety Features

### 5-Second Confirmation
Before executing the rollback, the script displays warnings and waits 5 seconds:

```
⚠️  WARNING: This will overwrite your current local app-store.json
⚠️  WARNING: This will delete ALL data from Supabase (memories and profiles)

Press Ctrl+C to cancel, or wait 5 seconds to continue...
```

Press `Ctrl+C` during this time to cancel the rollback.

### Backup File Validation
The script validates that the backup file:
- Exists and is readable
- Contains valid JSON
- Has the expected structure (memories, userProfilesPerPersona, etc.)

### Verification
After rollback, the script verifies:
- Local data was restored correctly
- Supabase data was cleared (if requested)
- Counts match expected values

## Rollback Report

After completion, a detailed report is saved to `.data/rollback-report-<timestamp>.json`:

```json
{
  "timestamp": "2026-03-28T12:00:00.000Z",
  "backupPath": ".data/backups/app-store-before-mem0-migration-2026-03-28T10-00-00-000Z.json",
  "clearSupabase": true,
  "restored": {
    "memories": 150,
    "profiles": 5
  },
  "supabaseCleared": {
    "memories": 150,
    "profiles": 5
  },
  "verified": {
    "memoriesInLocal": 150,
    "profilesInLocal": 5,
    "memoriesInSupabase": 0,
    "profilesInSupabase": 0
  },
  "duration": {
    "total": 2500,
    "restore": 500,
    "clearSupabase": 1500,
    "verification": 500
  }
}
```

## Troubleshooting

### Error: No backup files found

**Problem**: The script cannot find any backup files in `.data/backups/`

**Solution**: 
- Check that you have run the migration script first
- Verify that backup files exist in `.data/backups/`
- Use `--backup=<path>` to specify a backup file manually

### Error: Failed to restore from backup

**Problem**: The backup file is corrupted or has invalid format

**Solution**:
- Try a different backup file
- Check that the backup file is valid JSON
- Ensure the backup was created by the migration script

### Warning: Supabase credentials not found

**Problem**: `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` environment variables are not set

**Solution**:
- This is only a problem if you want to clear Supabase data
- Set the environment variables in `.env.local`
- Or skip Supabase cleanup (data will remain in Supabase)

### Warning: Memory/Profile count mismatch

**Problem**: The number of restored items doesn't match the backup

**Solution**:
- Check the rollback report for details
- Verify the backup file integrity
- This may indicate a partial restore - check the error logs

## After Rollback

### What's Restored
- ✅ All memories from the backup
- ✅ All user profiles from the backup
- ✅ All other app store data (auth users, evaluation logs, prompt versions)

### What's NOT Restored
- ❌ Supabase data (unless you manually restore it)
- ❌ Any changes made after the backup was created

### Next Steps

1. **Verify your data** - Check that your local app store has the expected data
2. **Test your application** - Ensure everything works as expected
3. **Review the rollback report** - Check for any warnings or issues
4. **Keep the backup** - Don't delete the backup file in case you need it again

## Best Practices

### Before Rollback
1. **Understand what will be lost** - Any data created after the backup will be lost
2. **Check the backup date** - Ensure you're using the correct backup
3. **Backup current state** (optional) - Create a backup of your current state before rollback

### During Rollback
1. **Don't interrupt** - Let the script complete fully
2. **Watch for errors** - Monitor the console output for any issues
3. **Wait for verification** - Don't use the application until verification completes

### After Rollback
1. **Verify data integrity** - Check that your data is correct
2. **Test functionality** - Ensure the application works as expected
3. **Review the report** - Check for any warnings or issues
4. **Document the rollback** - Note why you rolled back and what was lost

## Examples

### Example 1: Simple Rollback

Restore from the latest backup without clearing Supabase:

```bash
npx tsx scripts/rollback-migration.ts --latest
```

Output:
```
🔄 Starting Migration Rollback
============================================================

🔍 Finding latest backup...
✅ Using latest backup: .data/backups/app-store-before-mem0-migration-2026-03-28T10-00-00-000Z.json

⚠️  WARNING: This will overwrite your current local app-store.json

Press Ctrl+C to cancel, or wait 5 seconds to continue...

📦 Restoring from backup: .data/backups/app-store-before-mem0-migration-2026-03-28T10-00-00-000Z.json
  Found 150 memories and 5 profiles in backup
✅ Restore completed in 500ms
   - Memories: 150
   - Profiles: 5

⏭️  Skipping Supabase cleanup (use --clear-supabase to enable)

🔍 Verifying rollback...
  ✓ Local app store: 150 memories, 5 profiles
  ⚠️  Supabase credentials not found, skipping Supabase verification
✅ Verification completed in 200ms

📊 Generating rollback report...
✅ Report saved to: .data/rollback-report-2026-03-28T12-00-00-000Z.json

============================================================
📋 ROLLBACK SUMMARY
============================================================
Timestamp: 2026-03-28T12:00:00.000Z
Backup: .data/backups/app-store-before-mem0-migration-2026-03-28T10-00-00-000Z.json
Clear Supabase: No

Restored to Local:
  - Memories: 150
  - Profiles: 5

Verified:
  - Memories in Local: 150
  - Profiles in Local: 5
  - Memories in Supabase: 0
  - Profiles in Supabase: 0

Duration:
  - Total: 700ms
  - Restore: 500ms
  - Clear Supabase: 0ms
  - Verification: 200ms
============================================================

✅ Rollback completed successfully!

Your local app-store.json has been restored from the backup.
```

### Example 2: Full Rollback with Supabase Cleanup

Restore from latest backup and clear all Supabase data:

```bash
npx tsx scripts/rollback-migration.ts --latest --clear-supabase
```

This will:
1. Find the latest backup
2. Restore local data
3. Delete all memories and profiles from Supabase
4. Verify the rollback
5. Generate a report

### Example 3: Rollback from Specific Backup

Use a specific backup file:

```bash
npx tsx scripts/rollback-migration.ts --backup=.data/backups/app-store-before-mem0-migration-2026-03-27T15-30-00-000Z.json
```

This is useful when you have multiple backups and want to restore from a specific point in time.

## Related Documentation

- [Migration Guide](./MIGRATION_GUIDE.md) - How to migrate to Mem0
- [Design Document](../.kiro/specs/mem0-memory-migration/design.md) - Technical architecture
- [Tasks](../.kiro/specs/mem0-memory-migration/tasks.md) - Implementation tasks

## Support

If you encounter issues:

1. Check the rollback report for detailed error information
2. Review the console output for error messages
3. Verify your backup file is valid
4. Check environment variables are set correctly
5. Consult the troubleshooting section above
