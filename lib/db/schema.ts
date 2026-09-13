import { pgTable, text, timestamp, boolean, serial, integer, numeric, date, jsonb } from "drizzle-orm/pg-core"

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("employee"),
  sector: text("sector"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  issuer: text("issuer").notNull().default("credential"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// --- App tables ------------------------------------------------------------

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  productName: text("productName"),
  sector: text("sector").notNull(),
  oldPrice: numeric("oldPrice", { precision: 10, scale: 2 }),
  newPrice: numeric("newPrice", { precision: 10, scale: 2 }),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  createdBy: text("createdBy").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// One task per promotion phase (start = aplicar novos preços, end = retirar promoção).
export const promotionTasks = pgTable("promotion_tasks", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotionId").notNull(),
  type: text("type").notNull(), // "start" | "end"
  sector: text("sector").notNull(),
  dueDate: date("dueDate").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedBy: text("completedBy"),
  completedByName: text("completedByName"),
  completedAt: timestamp("completedAt"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: text("verified_by"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  promotionId: integer("promotionId"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Web Push subscriptions per user (for notifications with the app closed).
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const taskUpdates = pgTable("task_updates", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  promotionId: integer("promotion_id").notNull(),
  employeeId: text("employee_id").notNull(),
  sector: text("sector").notNull(),
  updateText: text("update_text").notNull(),
  photoPath: text("photo_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  managerReadAt: timestamp("manager_read_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
})

export const taskUpdateReplies = pgTable("task_update_replies", {
  id: serial("id").primaryKey(),
  updateId: integer("update_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  message: text("message").notNull(),
  photoPath: text("photo_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
