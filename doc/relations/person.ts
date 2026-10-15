import { Selectable } from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import { pipeline, JsonFrom, Pipeline, PipelineState } from "kysely-pipeline";
import { Database, db } from "./db.js";
import { petFromJson, PetPipeline } from "./pet.js";

export type PersonPipeline<
  O,
  T = O,
  S extends PipelineState = PipelineState,
  TB extends keyof Database = "person",
> = TB extends "person" ? Pipeline<Database, TB, O, T, S> : never;

export type Person = Selectable<Database["person"]>;

/**
 * Find records from the `person` table.
 *
 * @returns QueryBuilderPipeline
 */
export function findPerson() {
  const query = db.selectFrom("person").selectAll();
  return pipeline(query).lazy().throwIfNotFound();
}

/**
 * Transform a "person" record that was JSON-ified by being selected via
 * `jsonArrayFrom()` or `jsonObjectFrom()`.
 *
 * @param json the JSON-ified data
 * @returns data cast back to Person type
 */
export function personFromJson<T extends Partial<JsonFrom<Person>>>(json: T) {
  const { created_at, ...rest } = json;
  const data = rest as Omit<T, keyof Person> & Person;
  if (created_at !== undefined) {
    data.created_at = new Date(created_at);
  }
  return data;
}

/**
 * Factory method for a pipeline composition callback to extend a `person`
 * query with a `pets` object containing an array of related `pet` records.
 *
 * @param petPipeline PetPipeline
 * @returns (pipe: PersonPipeline) => PersonPipeline
 */
export function addPetsToPerson<PetO, T, S extends PipelineState>(
  petPipeline: PetPipeline<PetO, T, S>,
) {
  return <O, T, S extends PipelineState>(
    personPipeline: PersonPipeline<O, T, S>,
  ) =>
    personPipeline
      .extend((query) =>
        query.select(({ ref }) =>
          jsonArrayFrom(
            petPipeline.query.whereRef("pet.owner_id", "=", ref("person.id")),
          ).as("pets"),
        ),
      )
      .map(({ pets, ...rest }) => ({
        ...rest,
        pets: pets.map((pet) =>
          petPipeline.transform(petFromJson(pet) as PetO),
        ),
      }));
}

/**
 * Factory method for a pipeline composition callbcak to extend a `person`
 * query with a `mother` object containing the related mother's `person` record.
 *
 * @param motherPipeline PersonPipeline
 * @returns (pipe: PersonPipeline) => PersonPipeline
 */
export function addMotherToPerson<
  MotherO extends { id: number },
  T,
  S extends PipelineState,
>(motherPipeline: PersonPipeline<MotherO, T, S>) {
  return <O, T, S extends PipelineState>(
    personPipelne: PersonPipeline<O, T, S>,
  ) =>
    personPipelne
      .extend((query) =>
        query.select((eb) =>
          jsonObjectFrom(
            db
              .selectFrom(
                db.selectFrom(motherPipeline.query.as("t")).selectAll().as("m"),
              )
              .selectAll()
              .whereRef("m.id", "=", eb.ref("person.mother_id")),
          ).as("mother"),
        ),
      )
      .map(({ mother, ...rest }) => ({
        ...rest,
        mother:
          mother === null
            ? null
            : motherPipeline.transform(personFromJson(mother!) as MotherO),
      }));
}
