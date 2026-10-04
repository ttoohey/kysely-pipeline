# kysely-pipeline: Composition

Creating repositories of composable logic.

```ts
import { Selectable } from "kysely";
import { addPetsToPerson, findPerson } from "./person.js";
import { findPet } from "./pet.js";
import { Database } from "./db.js";

type Person = Selectable<Database["person"]>;
type Pet = Selectable<Database["pet"]>;

type Pets = { pets: Pet[] };

/**
 * Use `.compose()` to extend the query builder to find
 * related `Pet` records.
 *
 * `findPet()` is a query pipeline for selecting all pets
 *
 * `addPetsToPerson(findPet())` extends the "person" pipeline to include
 * a `pets` field containing the pets identified in the `findPet()` pipeline,
 * with the query extended to find only related `pet` records.
 *
 * The findPerson() pipeline resolves to a `Person & { pets: Pet[] }` shape.
 */
async () => {
  const person = await findPerson().compose(addPetsToPerson(findPet()));
  console.log(person satisfies Person & Pets);
  for (const pet of person.pets) {
    console.log(pet satisfies Pet);
  }
};
```

## How to write pipeline factory functions

### Each repository has a `Pipeline` type

Create a `Pipeline` type for each repository class. This is a type that narrows
the generic `QueryBuilderPipeline` type to be specific for the repository.

```ts
// person.ts
export type PersonPipeline<
  O,
  T = O,
  L extends boolean = false,
  TB extends keyof Database = "person",
> = TB extends "person" ? QueryBuilderPipeline<Database, TB, O, T, L> : never;
```

```ts
// pet.ts
export type PetPipeline<
  O,
  T = O,
  L extends boolean = false,
  TB extends keyof Database = "pet",
> = TB extends "pet" ? QueryBuilderPipeline<Database, TB, O, T, L> : never;
```

The generic parameters:

- `O` is the shape that the `SELECT` database query returns, the same as the `O` in `SelectQueryBuilder<DB, TB, O>`
- `T` is the shape returned by the pipeline's transformer (a function `(data: O) => T`) updated by the `.map()` pipeline modifier.
- `L` is a boolean that tells the pipeline whether `await` will throw if no record is found; it determines with the results are nullable or not (`true` means non-null results).
- `TB` is the database table key, the same as the `TB` in `SelectQueryBuilder<DB, TB, O>`

The ternary condition (`TB extends "person"` and `TB extends "pet"`) is a guard
to prevent passing an invalid pipeline to functions.

### Each repository has a `find` function

Create a `find` function in each repository which returns a query pipeline
initialised with a basic "select all" query builder.

> [!TIP]
>
> Typically the `find` function takes parameters so the intial query builder
> can be created with `.where()` conditions etc. This example is deliberately
> cut-down to the bare essentials.

```ts
// person.ts
/**
 * Find records from the `person` table.
 *
 * @returns QueryBuilderPipeline
 */
export function findPerson() {
  const query = db.selectFrom("person").selectAll();
  return createQueryPipeline(query).throwIfNotFound();
}
```

```ts
// pet.ts
/**
 * Find records from the `pet` table.
 *
 * @returns QueryBuilderPipeline
 */
export function findPet() {
  const query = db.selectFrom("pet").selectAll();
  return createQueryPipeline(query).throwIfNotFound();
}
```

### Create pipeline compose factory functions

See https://kysely.dev/docs/recipes/relations for some background.

The essential step we want to encapsulate is extending the query builder
to include a `pets` field with the list of related pets.

In _kysely_ this is typically done like:

```ts
const persons = await db
  .selectFrom("person")
  .selectAll("person")
  .select((eb) => [
    // pets
    jsonArrayFrom(
      eb
        .selectFrom("pet")
        .select(["pet.id", "pet.name"])
        .whereRef("pet.owner_id", "=", "person.id")
        .orderBy("pet.name"),
    ).as("pets"),
  ])
  .execute();
console.log(persons[0].pets[0].name);
```

We will encapsulate this in a pipeline compose factory function. The factory
returns a function suitable to be passed to `.compose()`.

```ts
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
```

> [!NOTE]
>
> We don't include `.select()` or `.orderBy()` expressions in the factory method
> since these may be left to the `petPipeline` query being passed. That is,
> it's up to the caller to decide what shape of `Pet` to return and what order
> the pets will be listed in.

The factory function (`addPetsToPerson()`) accepts generics `<PetO, PetT>` which
are inferred by the actual pipeline instance that is passed (`petPipeline`).
This makes the shape of pets up to the caller.

The returned function accepts generics `<O, T, L>` which are inferred by the
pipeline being updated (`personPipeline`). This makes the factory function
versatile, so it can be used with any shape of `Person`, and query pipelines
with and without the `throwIfNotFound` flag set.

The `jsonArrayFrom()` call is passed `petPipeline.query`, rather than creating
a query builder from scratch using `db.selectFrom("pet")`. The `.query` accessor
on pipeline objects returns the pipeline's query builder. It's a normal
`SelectQueryBuilder<Database, "pet", PetO>` shaped query builder.
