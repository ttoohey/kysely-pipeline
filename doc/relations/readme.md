# kysely-pipeline: Relations

Chanining and nesting composable queries.

```ts
import { Selectable } from "kysely";
import { addMotherToPerson, addPetsToPerson, findPerson } from "./person.js";
import { addOwnerToPet, findPet } from "./pet.js";
import { Database } from "./db.js";

type Pet = Selectable<Database["pet"]>;
type Person = Selectable<Database["person"]>;
type Owner<T = {}, U = Person> = { owner: U & T };
type Mother<T = {}, U = Person> = { mother: (U & T) | null };
type Pets<T = {}, U = Pet> = { pets: (U & T)[] };

/**
 * Chaining to add multiple unrelated fields to a query.
 */
async () => {
  const person = await findPerson()
    .compose(addPetsToPerson(findPet()))
    .compose(addMotherToPerson(findPerson()));
  console.log(person satisfies Person & Pets & Mother);
  console.log(person.pets satisfies Pet[]);
  console.log(person.mother satisfies Person | null);
};

/**
 * Nesting objects in the query builder with de-JSON-ifying the results.
 */
async () => {
  const pet = await findPet().compose(
    addOwnerToPet(
      findPerson().compose(
        addMotherToPerson(findPerson().compose(addPetsToPerson(findPet()))),
      ),
    ),
  );
  console.log(pet satisfies Pet & Owner<Mother<Pets>>);
  console.log(pet.owner satisfies Person & Mother<Pets>);
  console.log(pet.owner.mother! satisfies Person & Pets);
  console.log(pet.owner.mother!.pets satisfies Pet[]);
};
```

Extending the `addPetsToPerson()` factory method with a `.map()` doing two
things:

1. Transform the JSON-ified `pet` data to correct types
2. Apply any transforms the `petPipeline` needs using the pipeline's `.transform()` method

```ts
// person.ts
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
```

The `petFromJson()` function performs the type casting.

```ts
// pet.ts

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
```

The `JsonFrom` type is a utility type to typecast a type into it's JSON-ified
version. Since the `pets` field of `data` comes from the
`jsonArrayFrom().as("pets")` call, the types are cast to JSON types (`null`,
`number`, `string`, `object`, `array`).

The same pattern is followed to create the reciprical relationship from `pet`
to `person` via the `pet.owner_id` field.

```ts
// pet.ts
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
```

In this case the relationship is many-to-one so `owner` is a single object,
not an array like `pets` was. The `jsonObjectFrom().as("owner")` function is
used.

The `owner` is transformed via `personFromJson()` and also by the `ownerPipeline`
transformer. As with `pets` this allows the JSON-ified "person" data to be
cast to the correct type, and ensures the pipeline's transformation isn't lost.

```ts
// person.ts
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
```

> [!Note]
>
> Why does `.map()` require the type assertions for the final .transform()?
> This is a good question, and the short answer is I don't know. Perhaps one
> day my typescript-fu will be better and I can answer it.

The "mother" relationship is again similar to the `pet.owner -> person`
relationship. It is also a many-to-one relation, but since it's a "to self"
relation there's a couple of nuances.

```ts
// person.ts
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
```

Since `motherPipeline.query` is a `SELECT FROM person` query, and `person` is not
aliased (and we cannot change it to be aliased within this function), it gets
wrapped in `db.selectFrom(query).selectAll().as("m")`. This allows the
`.whereRef()` to use the alias `m.id` which would otherwise conflict with the
outer `person` table.

This pattern necessitates ensuring the `motherPipeline`'s query includes the
`id` column in the query's `SELECT` list. The `MotherO` generic type extends
`{ id: number }` to provide a type-safe way to ensure this (it's also this that
makes `m.id` resolvable to something kysely understands).

> [!Note]
>
> This pattern produces non-optimal SQL for finding a single linked record.
> `SELECT * FROM (SELECT * FROM person) AS t WHERE t.id=person.mother_id`
> would be better optimised as
> `SELECT * FROM person AS t WHERE t.id=person.mother_id)`.

Since `person.mother_id` is nullable, then so too is `mother`. This is reflected
in the `.map()` transformation function return `null` if the value is `null`.

Again, type assertions are required in the final `.transform()` so care must
be taken when creating these functions.
