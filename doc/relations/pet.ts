import { pipeline, JsonFrom, Pipeline, PipelineState } from "kysely-pipeline";
import { Database, db } from "./db.js";
import { personFromJson, PersonPipeline } from "./person.js";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { Selectable } from "kysely";

export type PetPipeline<
  O,
  T = O,
  S extends PipelineState = PipelineState,
  TB extends keyof Database = "pet",
> = TB extends "pet" ? Pipeline<Database, TB, O, T, S> : never;

type Pet = Selectable<Database["pet"]>;

/**
 * Find records from the `pet` table.
 *
 * @returns QueryBuilderPipeline
 */
export function findPet() {
  const query = db.selectFrom("pet").selectAll();
  return pipeline(query).lazy().throwIfNotFound();
}

/**
 * Transform a "pet" record that was JSON-ified by being selected via
 * `jsonArrayFrom()` or `jsonObjectFrom()`.
 *
 * @param json the JSON-ified data
 * @returns data cast back to Pet type
 */
export function petFromJson<T extends Partial<JsonFrom<Pet>>>(json: T) {
  const { ...rest } = json;
  const data = rest as Omit<T, keyof Pet> & Pet;
  // currently Pet == JsonFrom<Pet> so there's no type casting to be done here.
  return data;
}

/**
 * Factory method for a pipeline composition callback to extend a `pet` query
 * with an `owner` object containing the pet's related owner (`person`) record.
 *
 * @param ownerPipeline PersonPipeline
 * @returns query PetPipeline with 'owner' property
 */
export function addOwnerToPet<PersonO, T, S extends PipelineState>(
  ownerPipeline: PersonPipeline<PersonO, T, S>,
) {
  return <O, T, S extends PipelineState>(petPipeline: PetPipeline<O, T, S>) =>
    petPipeline
      .extend((query) =>
        query.select(({ ref }) =>
          jsonObjectFrom(
            ownerPipeline.query.whereRef("person.id", "=", ref("pet.owner_id")),
          )
            .$notNull()
            .as("owner"),
        ),
      )
      .map(({ owner, ...rest }) => ({
        ...rest,
        owner: ownerPipeline.transform(personFromJson(owner!) as PersonO),
      }));
}
