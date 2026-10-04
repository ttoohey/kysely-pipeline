# kysely-pipeline: Reading

The different ways of reading data from a pipeline.

- use `await` to get a single database record
- use `for await` to stream database records
- use `.list()` to get an array of records
- use `.paginate()` to get an array of records and pagination meta data
- use `.cursor()` to use keyset iteration to stream database records

```ts
import { Selectable } from "kysely";
import { createQueryPipeline } from "kysely-pipeline";
import { Database, db } from "./db.js";

type Person = Selectable<Database["person"]>;

const query = db.selectFrom("person").selectAll();

/**
 * A pipeline is a "thenable" object which resolves
 * to a single record or null.
 *
 * It calls the query builder `executeTakeFirst()` method.
 */
async () => {
  const person = await createQueryPipeline(query);
  console.log(person satisfies Person | null);
};

/**
 * the `throwIfNotFound()` modifier makes the thenable
 * reject if the record is not found, which narrows
 * the type to be non-null.
 *
 * It calls the query builder `executeTakeFirstOrThrow()` method.
 */
async () => {
  const person = await createQueryPipeline(query).throwIfNotFound();
  console.log(person satisfies Person);
};

/**
 * `list()` will return an array of results from the query.
 *
 * The optional `limit` and `offset` arguments can be
 * used to get a slice of the result set.
 *
 * It calls the query builder `execute()` method.
 */
async () => {
  const people = await createQueryPipeline(query).list();
  console.log(people satisfies Person[]);
};
async (limit?: number, offset?: number) => {
  const people = await createQueryPipeline(query).list(limit, offset);
  console.log(people satisfies Person[]);
};

/**
 * `paginate()` will return an array of results along
 * with pagination meta data.
 *
 * It calls the query builder `execute()` method.
 *
 * If `options.counting` is true (the default) it will
 * execute a second query to get the total count of
 * records.
 *
 * The `meta` result shape depends on `options.counting`.
 */
async (page: number = 1, pageSize: number = 10) => {
  const result = await createQueryPipeline(query).paginate(page, pageSize);
  console.log(result.items satisfies Person[], result.meta);
};

async (page: number = 1, pageSize: number = 10) => {
  const result = await createQueryPipeline(query).paginate(page, pageSize, {
    counting: false,
  });
  console.log(result.items satisfies Person[], result.meta);
};

/**
 * A pipeline is an async iterable object which may
 * be used in a `for await` loop.
 *
 * It calls the query builder `stream()` method.
 */
async () => {
  for await (const person of createQueryPipeline(query)) {
    console.log(person satisfies Person);
  }
};

/**
 * `.cursor()` is for keyset async iteration over results. Results are fetched
 * in batches (controlled by the `options.batchSize` setting), and yielded as
 * async results.
 */
async () => {
  for await (const person of createQueryPipeline(query).cursor("person.id")) {
    console.log(person satisfies Person);
  }
};
```
