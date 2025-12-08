# Multi-Tenancy Implementation - Completion Guide

## ✅ COMPLETED (75%)

### 1. Database Schema
- ✅ Added `ownerId` to: User, Store, Category, Product, Transaction
- ✅ Created migration with data assignment to first OWNER
- ✅ Applied migration successfully
- ✅ Generated Prisma Client

### 2. Authentication & Authorization
- ✅ Updated JWT payload to include `ownerId`
- ✅ Updated auth middleware to extract `req.ownerId`
- ✅ Fixed registration to set `ownerId = null` for OWNER
- ✅ Fixed login to include `ownerId` in JWT token

### 3. Secured Controllers
- ✅ Stores Controller - All endpoints tenant-filtered
- ✅ Categories Controller - All endpoints tenant-filtered
- ✅ Products Controller - All endpoints tenant-filtered

---

## 🔄 REMAINING WORK (25%)

### Files That Need Tenant Filtering:

#### 1. **productVariants.controller.ts** (449 lines)
Location: `src/controllers/productVariants.controller.ts`

**Functions to fix:**
- `getProductVariants()` - Filter variants by product's ownerId
- `getVariantById()` - Validate variant belongs to owner
- `getVariantBySku()` - Validate variant belongs to owner
- `getVariantByBarcode()` - Validate variant belongs to owner
- `createVariant()` - Validate product belongs to owner
- `updateVariant()` - Validate variant belongs to owner
- `deleteVariant()` - Validate variant belongs to owner
- `adjustStock()` - Validate variant belongs to owner

**Pattern to apply:**
```typescript
// Product variants inherit ownerId from their product
// Always validate the parent product belongs to the owner

export const getVariantById = async (req: Request, res: Response): Promise<Response> => {
  if (!req.ownerId) {
    return sendError(res, 'Unauthorized - no tenant context', 401);
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id },
    include: {
      product: {
        where: {
          ownerId: req.ownerId, // VALIDATE parent product ownership
        },
      },
    },
  });

  // Or use this pattern:
  const variant = await prisma.productVariant.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!variant || variant.product.ownerId !== req.ownerId) {
    return sendError(res, 'Variant not found', 404);
  }

  return sendSuccess(res, variant, 'Variant retrieved');
};
```

---

#### 2. **transactions.controller.ts** (402 lines)
Location: `src/controllers/transactions.controller.ts`

**Functions to fix:**
- `getAllTransactions()` - Filter by `ownerId`
- `getTransactionById()` - Validate ownership
- `createTransaction()` - Set `ownerId = req.ownerId`
- `getTransactionStats()` - Filter stats by `ownerId`
- `getTodayTransactions()` - Filter by `ownerId`

**Critical Pattern:**
```typescript
export const createTransaction = async (req: Request, res: Response): Promise<Response> => {
  if (!req.ownerId) {
    return sendError(res, 'Unauthorized - no tenant context', 401);
  }

  // Validate store belongs to owner
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      ownerId: req.ownerId,
    },
  });

  if (!store) {
    return sendError(res, 'Store not found', 404);
  }

  // Validate all product variants belong to owner
  for (const item of items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.productVariantId },
      include: { product: true },
    });

    if (!variant || variant.product.ownerId !== req.ownerId) {
      return sendError(res, `Invalid product variant: ${item.productVariantId}`, 400);
    }
  }

  const transaction = await prisma.transaction.create({
    data: {
      // ... transaction fields
      ownerId: req.ownerId, // CRITICAL: Set owner
    },
  });

  return sendSuccess(res, transaction, 'Transaction created');
};
```

---

#### 3. **reports.controller.ts** (901 lines)
Location: `src/controllers/reports.controller.ts`

**Functions to fix:**
- `getSalesReport()` - Filter by `ownerId`
- `getTopSellingProducts()` - Filter by `ownerId`
- `getPaymentMethodBreakdown()` - Filter by `ownerId`
- `getInventoryValueReport()` - Filter by `ownerId`
- `exportReportCSV()` - Filter data by `ownerId`
- `exportReportPDF()` - Filter data by `ownerId`

**Pattern for reports:**
```typescript
export const getSalesReport = async (req: Request, res: Response): Promise<Response> => {
  if (!req.ownerId) {
    return sendError(res, 'Unauthorized - no tenant context', 401);
  }

  const { storeId, startDate, endDate } = req.query;

  const where: any = {
    ownerId: req.ownerId, // TENANT FILTER
  };

  if (storeId) {
    // Also validate storeId belongs to this owner
    const store = await prisma.store.findFirst({
      where: { id: storeId as string, ownerId: req.ownerId },
    });
    if (!store) {
      return sendError(res, 'Store not found', 404);
    }
    where.storeId = storeId;
  }

  if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string),
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { items: true, store: true },
  });

  // Calculate report data...
  return sendSuccess(res, reportData, 'Sales report generated');
};
```

---

#### 4. **auth.controller.ts** - Employee Management
Location: `src/controllers/auth.controller.ts`

**Functions to fix:**
- `createEmployee()` - Ensure employee's `ownerId = req.user.ownerId`
- `getAllEmployees()` - Filter by `ownerId`
- `updateEmployee()` - Validate employee belongs to owner
- `deleteEmployee()` - Validate employee belongs to owner

**Pattern:**
```typescript
export const createEmployee = async (req: Request, res: Response): Promise<Response> => {
  if (!req.ownerId) {
    return sendError(res, 'Unauthorized - no tenant context', 401);
  }

  const { email, password, firstName, lastName, role, storeId } = req.body;

  // Validate store belongs to this owner (if storeId provided)
  if (storeId) {
    const store = await prisma.store.findFirst({
      where: { id: storeId, ownerId: req.ownerId },
    });
    if (!store) {
      return sendError(res, 'Store not found', 404);
    }
  }

  const employee = await prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      firstName,
      lastName,
      role, // MANAGER or CASHIER
      storeId,
      ownerId: req.ownerId, // CRITICAL: Assign employee to the authenticated owner
    },
  });

  return sendSuccess(res, employee, 'Employee created');
};

export const getAllEmployees = async (req: Request, res: Response): Promise<Response> => {
  if (!req.ownerId) {
    return sendError(res, 'Unauthorized - no tenant context', 401);
  }

  const employees = await prisma.user.findMany({
    where: {
      ownerId: req.ownerId, // TENANT FILTER
      role: { in: ['MANAGER', 'CASHIER'] },
    },
    include: { store: true },
  });

  return sendSuccess(res, employees, 'Employees retrieved');
};
```

---

## 🧪 TESTING CHECKLIST

After completing the above changes, test the following scenarios:

### Test 1: Data Isolation
1. Create 2 OWNER accounts (Owner A, Owner B)
2. Log in as Owner A, create: 1 store, 1 category, 1 product
3. Log in as Owner B, create: 1 store, 1 category, 1 product
4. Verify:
   - Owner A sees ONLY their store/category/product
   - Owner B sees ONLY their store/category/product
   - Owner A CANNOT access Owner B's resources (try direct API calls with IDs)

### Test 2: Employee Access
1. Owner A creates a MANAGER employee
2. Log in as that MANAGER
3. Verify:
   - Manager sees Owner A's data only
   - Manager CANNOT create stores (authorization check)
   - Manager CAN create products in Owner A's stores

### Test 3: Transaction Creation
1. Owner A creates a transaction
2. Verify:
   - Transaction has `ownerId` set to Owner A
   - Owner B CANNOT see this transaction
   - Reports show correct data for each owner

### Test 4: Cross-Tenant Access Attempt
1. Get Owner B's store ID
2. As Owner A, try to:
   - GET /api/stores/{OwnerB_StoreID}
   - PUT /api/stores/{OwnerB_StoreID}
   - DELETE /api/stores/{OwnerB_StoreID}
3. All should return 404 (not 403, because resource "doesn't exist" for that tenant)

---

## 🚀 DEPLOYMENT STEPS

Once all controllers are fixed:

1. **Run the backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Test all endpoints** with Postman/Insomnia

3. **Run the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Full integration test** with the UI

---

## 📝 QUICK REFERENCE - Common Patterns

### Pattern 1: GET All (with filtering)
```typescript
if (!req.ownerId) return sendError(res, 'Unauthorized', 401);

const items = await prisma.model.findMany({
  where: {
    ownerId: req.ownerId,
    // other filters...
  },
});
```

### Pattern 2: GET One (by ID)
```typescript
if (!req.ownerId) return sendError(res, 'Unauthorized', 401);

const item = await prisma.model.findFirst({
  where: {
    id,
    ownerId: req.ownerId,
  },
});

if (!item) return sendError(res, 'Not found', 404);
```

### Pattern 3: CREATE
```typescript
if (!req.ownerId) return sendError(res, 'Unauthorized', 401);

// Validate related resources belong to owner
const relatedResource = await prisma.relatedModel.findFirst({
  where: { id: relatedId, ownerId: req.ownerId },
});
if (!relatedResource) return sendError(res, 'Related resource not found', 404);

const item = await prisma.model.create({
  data: {
    ...fields,
    ownerId: req.ownerId,
  },
});
```

### Pattern 4: UPDATE
```typescript
if (!req.ownerId) return sendError(res, 'Unauthorized', 401);

const existingItem = await prisma.model.findFirst({
  where: { id, ownerId: req.ownerId },
});

if (!existingItem) return sendError(res, 'Not found', 404);

const updated = await prisma.model.update({
  where: { id },
  data: { ...updates },
});
```

### Pattern 5: DELETE
```typescript
if (!req.ownerId) return sendError(res, 'Unauthorized', 401);

const item = await prisma.model.findFirst({
  where: { id, ownerId: req.ownerId },
});

if (!item) return sendError(res, 'Not found', 404);

await prisma.model.delete({ where: { id } });
```

---

## ⚠️ CRITICAL SECURITY RULES

1. **ALWAYS** check `req.ownerId` at the start of EVERY controller function
2. **NEVER** trust client-provided IDs (storeId, categoryId, etc.) without validation
3. **ALWAYS** filter queries by `ownerId`
4. **ALWAYS** set `ownerId` when creating new resources
5. **NEVER** use `findUnique` alone - use `findFirst` with `ownerId` filter
6. For resources without direct `ownerId` (like ProductVariant), validate through parent (Product)

---

## 📊 COMPLETION STATUS

- [x] Database Schema (100%)
- [x] JWT & Middleware (100%)
- [x] Stores Controller (100%)
- [x] Categories Controller (100%)
- [x] Products Controller (100%)
- [ ] Product Variants Controller (0%)
- [ ] Transactions Controller (0%)
- [ ] Reports Controller (0%)
- [ ] Employee Management (0%)

**Overall Progress: 75%**

---

## 🎯 NEXT STEPS

1. Apply the patterns above to the remaining 4 controller files
2. Test thoroughly with multiple owner accounts
3. Verify no data leakage between tenants
4. Deploy and celebrate! 🎉
