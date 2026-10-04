import {
  ColumnType,
  Generated,
  JSONColumnType,
  Kysely,
  PostgresDialect,
} from "kysely";
import { Pool } from "pg";

const dialect = new PostgresDialect({ pool: new Pool() });

interface PersonTable {
  id: Generated<number>;
  first_name: string;
  last_name: string | null;
  gender: "man" | "woman" | "other";
  created_at: ColumnType<Date, string | undefined, never>;
  metadata: JSONColumnType<{
    login_at: string;
    ip: string | null;
    agent: string | null;
    plan: "free" | "premium";
  }>;
}

interface PetTable {
  id: Generated<number>;
  name: string;
  owner_id: number;
  species: "dog" | "cat";
}

export interface Database {
  person: PersonTable;
  pet: PetTable;
}

export const db = new Kysely<Database>({ dialect });
