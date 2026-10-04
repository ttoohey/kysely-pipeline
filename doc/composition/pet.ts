import { createQueryPipeline, QueryBuilderPipeline } from "kysely-pipeline";
import { Database, db } from "./db.js";

export type PetPipeline<
  O,
  T = O,
  L extends boolean = false,
  TB extends keyof Database = "pet",
> = TB extends "pet" ? QueryBuilderPipeline<Database, TB, O, T, L> : never;

/**
 * Find records from the `pet` table.
 *
 * @returns QueryBuilderPipeline
 */
export function findPet() {
  const query = db.selectFrom("pet").selectAll();
  return createQueryPipeline(query).throwIfNotFound();
}
