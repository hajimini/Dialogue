# Mem0 Migration Guide

This guide explains how to migrate your local memory data to Supabase with Mem0 integration.

## Overview

The migration script (`migrate-to-mem0.ts`) performs the following operations:

1. **Automatic Backup**: Creates a timestamped backup of your current `app-store.json`
2. **Memory Migration**: Migrates all memories to Supabase, regenerating embeddings
3. **Profile Migration**: Migrates user profiles to Supabase
4. **Session Migration**: Placeholder for future session migration (currently not needed)
5. **Verification**: Validates that all data was migrated correctly
6. **Report Generation**: Creates a detailed JSON report of the migration

## Prerequisites

### 1. Environment Variables

Ensure the following environment variables are set in your `.env.local`:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key  # Required for migration (bypasses RLS)
SUPABASE_ANON_KEY=your_anon_key

# Mem0 Configuration
MEM0_API_KEY=your_mem0_api_key

# Embedding Configuration
EMBEDDING_PROVIDER=openai  # or bge-m3
EMBEDDING_MODEL=text-embedding-3-large
OPENAI_API_KEY=your_openai_api_key  # Required if using OpenAI embeddings

# Reranker Configuration (optional)
RERANKER_PROVIDER=jina  # or cohere or none
RERANKER_API_KEY=your_reranker_api_key

# Memory Configuration
MEMORY_PROVIDER=mem0
MEMORY_RETRIEVAL_LIMIT=5
```

### 2. Supabase Schema

Ensure your Supabase database has the required schema. Run the schema setup script:

```bash
# Execute the SQL script in your Supabase SQL editor
cat scripts/setup-supabase-schema.sql
```

The schema includes:
- `memories` table with pgvector support
- `user_profiles_per_persona` table
- `sessions` table
- Appropriate indexes for performance

### 3. Test Your Setup

Before running the migration, test your configuration:

```bash
npm run test:migration
```

This will:
- Verify your local data structure
- Check environment variables
- Estimate migration time
- Validate data integrity

## Running the Migration

### Step 1: Review Your Data

Check your current data:

```bash
cat .data/app-store.json
```

Note the number of memories and profiles to be migrated.

### Step 2: Run the Migration

Execute the migration script:

```bash
npm run migrate:mem0
```

The script will:
1. Create a backup in `.data/backups/`
2. Migrate memories one by one (with progress indicators)
3. Migrate user profiles
4. Verify the migration
5. Generate a detailed report

### Step 3: Review the Report

After migration, check the report:

```bash
cat .data/migration-report-YYYY-MM-DDTHH-MM-SS-SSSZ.json
```

The report includes:
- Source data counts
- Migrated data counts
- Failed migrations (if any)
- Verification results
- Duration metrics

## Migration Output

### Successful Migration

```
🚀 Starting Mem0 Migration
============================================================

📖 Reading local app store...
✅ Found 150 memories, 5 profiles

📦 Creating backup...
✅ Backup created at: .data/backups/app-store-before-mem0-migration-2026-03-28T10-30-00-000Z.json (45ms)

🧠 Migrating 150 memories...
  ✓ [1/150] Migrated memory: 12345678...
  ✓ [2/150] Migrated memory: 23456789...
  ...
✅ Memory migration completed in 75000ms
   - Migrated: 150
   - Failed: 0

👤 Migrating 5 user profiles...
  ✓ [1/5] Migrated profile: 34567890...
  ...
✅ Profile migration completed in 500ms
   - Migrated: 5
   - Failed: 0

🔍 Verifying migration...
✅ Verification completed in 200ms
   - Memories in Supabase: 150 (expected: 150)
   - Profiles in Supabase: 5 (expected: 5)

📊 Generating migration report...
✅ Report saved to: .data/migration-report-2026-03-28T10-31-15-000Z.json

============================================================
📋 MIGRATION SUMMARY
============================================================
Timestamp: 2026-03-28T10:31:15.000Z
Backup: .data/backups/app-store-before-mem0-migration-2026-03-28T10-30-00-000Z.json

Source Data:
  - Memories: 150
  - Profiles: 5
  - Sessions: 0

Migrated:
  - Memories: 150
  - Profiles: 5
  - Sessions: 0

Failed:
  - Memories: 0
  - Profiles: 0
  - Sessions: 0

Verified in Supabase:
  - Memories: 150
  - Profiles: 5

Duration:
  - Total: 75745ms
  - Backup: 45ms
  - Memories: 75000ms
  - Profiles: 500ms
  - Verification: 200ms
============================================================

✅ Migration completed successfully!
```

### Failed Migration

If some items fail to migrate, the script will:
- Continue migrating remaining items
- Log each failure with error details
- Include failures in the report
- Exit with code 1

Example failure output:

```
  ✗ [42/150] Failed memory abc123: API rate limit exceeded
```

## Troubleshooting

### Issue: "SUPABASE_URL environment variable is required"

**Solution**: Ensure all required environment variables are set in `.env.local`

### Issue: "API rate limit exceeded"

**Solution**: 
- Wait a few minutes and retry
- Consider upgrading your API plan
- The script will continue from where it left off

### Issue: "Embedding generation failed"

**Solution**:
- Check your OpenAI API key
- Verify you have sufficient API credits
- The script will use fallback embeddings if needed

### Issue: "Memory count mismatch after verification"

**Solution**:
- Check the migration report for failed items
- Review error messages for specific failures
- You can re-run the migration (it will skip duplicates)

## Rollback

If you need to rollback the migration:

1. **Stop using the new system**: Switch back to local storage
2. **Restore from backup**:

```bash
cp .data/backups/app-store-before-mem0-migration-TIMESTAMP.json .data/app-store.json
```

3. **Clear Supabase data** (optional):

```sql
-- In Supabase SQL editor
DELETE FROM memories;
DELETE FROM user_profiles_per_persona;
```

## Post-Migration

After successful migration:

1. **Verify functionality**: Test your application with the new memory system
2. **Monitor performance**: Check the memory metrics API
3. **Run C-category tests**: Validate context continuation improvements
4. **Keep backups**: Don't delete the backup files immediately

## Performance Considerations

### Migration Time

Approximate times per item:
- **Memory**: ~500ms (includes embedding generation)
- **Profile**: ~100ms

For 150 memories and 5 profiles:
- Estimated time: ~75 seconds

### API Costs

Each memory requires:
- 1 embedding API call (~$0.0001 for text-embedding-3-large)
- 1 Mem0 API call (check your Mem0 pricing)

For 150 memories:
- Estimated cost: ~$0.015 + Mem0 costs

## Next Steps

After migration:

1. **Update your code**: Ensure all code uses the new MemoryGateway
2. **Run tests**: Execute your test suite to verify functionality
3. **Monitor metrics**: Use the memory metrics API to track performance
4. **Optimize**: Adjust embedding and reranker settings based on results

## Support

If you encounter issues:

1. Check the migration report for detailed error messages
2. Review the backup to ensure data integrity
3. Consult the design document for architecture details
4. Check Supabase logs for database errors
