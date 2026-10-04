import { createQueryPipeline, QueryBuilderPipeline } from "kysely-pipeline";
import { Database, db } from "./db.js";
import { PetPipeline } from "./pet.js";
import { jsonArrayFrom } from "kysely/helpers/postgres";

export type PersonPipeline<
  O,
  T = O,
  L extends boolean = false,
  TB extends keyof Database = "person",
> = TB extends "person" ? QueryBuilderPipeline<Database, TB, O, T, L> : never;

/**
 * Find records from the `person` table.
 *
 * @returns QueryBuilderPipeline
 */
export function findPerson() {
  const query = db.selectFrom("person").selectAll();
  return createQueryPipeline(query).throwIfNotFound();
}

/**
 * Factory method for a pipeline composition callback to extend a `person`
 * query with a `pets` object containing an array of related `pet` records.
 *
 * @param petPipeline PetPipeline
 * @returns (pipe: PersonPipeline) => PersonPipeline
 */
export function addPetsToPerson<PetO, PetT>(
  petPipeline: PetPipeline<PetO, PetT>,
) {
  return <O, T, L extends boolean>(personPipeline: PersonPipeline<O, T, L>) =>
    personPipeline.extend((query) =>
      query.select(({ ref }) =>
        jsonArrayFrom(
          petPipeline.query.whereRef("pet.owner_id", "=", ref("person.id")),
        ).as("pets"),
      ),
    );
}
