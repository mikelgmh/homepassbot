import type { sql } from "drizzle-orm";

export interface User {
  telegram_id: number;
  first_name: string | null;
  username: string | null;
  permission_status: string;
  access_expires_at: string | null;
  can_portal: number;
  can_casa: number;
  language_code: string;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: number;
  name: string;
  entity_id: string;
  domain: string;
  service: string;
  created_at: string;
}

export interface UserEntity {
  user_id: number;
  entity_id: number;
}

export type Dialect = "sqlite" | "postgres";

export type NowSql = ReturnType<typeof sql>;
