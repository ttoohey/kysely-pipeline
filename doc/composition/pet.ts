import {
  createQueryPipeline,
  QueryBuilderPipeline,
  QueryPipelineState,
} from "kysely-pipeline";
import { Database, db } from "./db.js";

export type PetPipeline<
  O,
  T = O,
  S extends QueryPipelineState = QueryPipelineState,
  TB extends keyof Database = "pet",
> = TB extends "pet" ? QueryBuilderPipeline<Database, TB, O, T, S> : never;

/**
 * Find records from the `pet` table.
 *
 * @returns QueryBuilderPipeline
 */
export function findPet() {
  const query = db.selectFrom("pet").selectAll();
  return createQueryPipeline(query).throwIfNotFound();
}
