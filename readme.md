# kysely-pipeline

Helper for [kysely](https://kysely.dev/) to build composable type-safe query
builder logic.

# Synopsis

A Pipeline is a wrapper for a _kysely_ Select Query Builder which allows
composition of database queries, transformation of database results, and various
strategies for consuming the responses.

Pipelines may be consumed by taking the first result, iterating over all the
results (streaming or batching results), or taking a slice of results into an
array (listing or paging). See [reading](/doc/reading/readme.md)

```ts
const person = await findPerson(id);
const persons = await findPerson({ keyword }).list(50);

for await (const pet of findPet({ species: "dog" })) {
  if (isGoodBoy(pet)) {
    giveTreat(pet);
  }
}
```

Pipeline compositions may be chained and nested to produce complex data shapes.
See [extending](/doc/extending/readme.md),
[composition](/doc/composition/readme.md), [relations](/doc/relations/readme.md).

```ts
const person = await findPerson(id)
  .compose(addPets(findPet()))
  .compose(addMother(findPerson()));
person.pets satisfies Pet[];
person.mother satisfies Person | null;

const pet = await findPet(id).compose(
  addOwner(findPerson().compose(addMother(findPerson()))),
);
pet.owner satisfies Person;
pet.owner.mother satisfies Person;
```

# API

## QueryBuilderPipeline

_A not-strictly accurate representation of the query builder pipeline_

```ts
type Pipeline = {
  // terminal methods to read query response
  first(): Promise<Result>;
  list(limit?: number, offset?: number): Promise<Result[]>;
  paginate(
    page: number,
    pageSize: number,
    { counting: boolean = true },
  ): Promise<{ items: Result[]; meta: PaginationMeta }>;
  stream(): AsyncIterable<Result>;
  cursor(index: StringReference): AsyncIterable<Result>;
} & {
  // pipeline modifying methods
  extend(func): Pipeline;
  map(func): Pipeline;
  compose(func): Pipeline;
  throwIfNotFound(): Pipeline;
  lazy(): Pipeline;
} & {
  // use the pipeline's query build and transformer directly
  query: SelectQueryBuilder;
  transform(data): Result;
};
```

## type JsonFrom

A utility type to cast a object to a JSON-ified version. Useful when an object
comes from `jsonArrayFrom()` or `jsonObjectFrom()` queries.

```ts
// casts to an object with the same keys as T with non-JSON valid keys replaced
// with `string`
type JsonFrom<T>
```

## pipeline()

```ts
function pipeline(query: SelectQueryBuilder): Pipeline;
```

This function is typically used in repository 'find' function.

```ts
function findPerson() {
  const query = db.selectFrom("person").selectAll();
  return pipeline(query).lazy();
}
```

The `findPerson()` function returns a Pipeline which means the consumer may
extend/compose the query further, and can choose which of the reading strategies
to use, from simply awaiting to get the first result, or streaming to get all
results, or using `.page()` to get a page of results.

There's no need for separate `findPersonById()` and `findPeople()` functions.
Modify `findPerson()` to implement the `WHERE` logic, and let the consumer worry
about the shape of the result.

```ts
function findPerson(criteria?: number | object) {
  const query = db
    .selectFrom("person")
    .selectAll()
    .$if(typeof criteria === "number", (q) =>
      q.where("id", "=", criteria as number),
    );
  return pipeline(query).lazy();
}
```

```ts
const person: Person = await findPerson(123);
const people: Person[] = await findPerson().list();
```

# Documentation

More information in [docs](./doc/readme.md)
