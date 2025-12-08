/*
  Migration: Add Multi-Tenancy Support

  This migration adds ownerId fields to all tables and assigns existing data
  to the first OWNER user found in the system.

  WARNING: This migration assumes you have at least one OWNER user.
  If you have multiple OWNER users and want to distribute data among them,
  you'll need to manually update the ownerId values after this migration.
*/

-- Step 1: Add ownerId column as nullable first (to avoid constraint violation)
ALTER TABLE "User" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Category" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Product" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Store" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "ownerId" TEXT;

-- Step 2: Set ownerId for existing data
-- Find the first OWNER user and assign all existing data to them
DO $$
DECLARE
  first_owner_id TEXT;
BEGIN
  -- Get the first OWNER user ID
  SELECT id INTO first_owner_id
  FROM "User"
  WHERE role = 'OWNER'
  LIMIT 1;

  -- If we have an owner, assign all existing data to them
  IF first_owner_id IS NOT NULL THEN
    -- Update all stores to belong to first owner
    UPDATE "Store"
    SET "ownerId" = first_owner_id
    WHERE "ownerId" IS NULL;

    -- Update all categories to belong to first owner
    UPDATE "Category"
    SET "ownerId" = first_owner_id
    WHERE "ownerId" IS NULL;

    -- Update all products to belong to first owner
    UPDATE "Product"
    SET "ownerId" = first_owner_id
    WHERE "ownerId" IS NULL;

    -- Update all transactions to belong to first owner
    UPDATE "Transaction"
    SET "ownerId" = first_owner_id
    WHERE "ownerId" IS NULL;

    -- Update employees (MANAGER/CASHIER) to belong to first owner
    UPDATE "User"
    SET "ownerId" = first_owner_id
    WHERE role IN ('MANAGER', 'CASHIER') AND "ownerId" IS NULL;

    RAISE NOTICE 'Assigned all existing data to owner: %', first_owner_id;
  ELSE
    RAISE EXCEPTION 'No OWNER user found. Please create at least one OWNER user before running this migration.';
  END IF;
END $$;

-- Step 3: Make ownerId NOT NULL for tables that require it
ALTER TABLE "Store" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "ownerId" SET NOT NULL;
-- Note: User.ownerId stays nullable (NULL for OWNER users)

-- Step 4: Create indexes for performance
CREATE INDEX "Category_ownerId_idx" ON "Category"("ownerId");
CREATE INDEX "Product_ownerId_idx" ON "Product"("ownerId");
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");
CREATE INDEX "Transaction_ownerId_idx" ON "Transaction"("ownerId");
CREATE INDEX "User_ownerId_idx" ON "User"("ownerId");

-- Step 5: Add foreign key constraints
ALTER TABLE "User" ADD CONSTRAINT "User_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Category" ADD CONSTRAINT "Category_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note: Transaction.ownerId is intentionally not a foreign key to User
-- because it's denormalized for performance (prevents need for joins)
-- but we keep it in sync via application logic
