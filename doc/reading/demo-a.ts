import { Selectable } from "kysely";
import { createQueryPipeline } from "kysely-pipeline";
import { Database, db } from "./db.js";

type Person = Selectable<Database["person"]>;

const query = db.selectFrom("person").selectAll();
const pipeline = () => createQueryPipeline(query);
const lazyPipeline = () => pipeline().lazy();

/**
 * A pipeline is a "thenable" object which resolves
 * to a single record or null.
 *
 * It calls the query builder `executeTakeFirst()` method.
 */
async () => {
  const person = await lazyPipeline();
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
  const person = await lazyPipeline().throwIfNotFound();
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
  const people = await pipeline().list();
  console.log(people satisfies Person[]);
};
async (limit?: number, offset?: number) => {
  const people = await pipeline().list(limit, offset);
  console.log(people satisfies Person[]);
};

/**
 * `.page()` will return an array of results along with pagination meta data
 * using offset pagination.
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
  const result = await pipeline().page(page, pageSize);
  console.log(result.items satisfies Person[], result.meta);
};

async (page: number = 1, pageSize: number = 10) => {
  const result = await pipeline().page(page, pageSize, {
    counting: false,
  });
  console.log(result.items satisfies Person[], result.meta);
};

/**
 * `.seek()` will return an array of results along with pagination meta data
 * using cursor/keyset pagination.
 *
 * It calls the query builder `execute()` method.
 *
 * The cursor index column may be a single column, which should be a unique
 * index (cursor pagination results can be jumbled if it's not).
 *
 * The cursor index may also be a list of columns, and again should define
 * a unique index. The typical way to do this is to put the primary key as
 * the final item in the list.
 *
 * Forward and reverse pagination is supported via `first` and `last` fields
 * and following the `nextCursor` and `previousCursor` values in the returned
 * meta data.
 *
 * If `options.counting` is true it will execute a second query to get the
 * total count of records. (default is false)
 */
async () => {
  const result = await pipeline().seek("person.id", {
    first: 10,
  });
  console.log(result.items satisfies Person[], result.meta);
};

async () => {
  const page1 = await pipeline().seek(["person.created_at", "id"], {
    first: 10,
    direction: ["asc", "desc"],
  });
  if (page1.meta.hasNext) {
    const page2 = await pipeline().seek(["person.created_at", "id"], {
      first: 10,
      direction: ["asc", "desc"],
      cursor: page1.meta.nextCursor,
    });
    console.log(page2.items satisfies Person[]);
  }
};

async (cursor: [Date, number]) => {
  const result = await pipeline().seek(["created_at", "person.id"], {
    first: 10,
    cursor,
    counting: true,
    direction: "desc",
  });
  console.log(
    result.items satisfies Person[],
    result.meta.totalItems satisfies number,
  );
  if (result.meta.hasNext) {
    console.log(result.meta.nextCursor satisfies [Date, number]);
  }
};

/**
 * A pipeline is an async iterable object which may
 * be used in a `for await` loop.
 *
 * It calls the query builder `stream()` method.
 */
async () => {
  for await (const person of lazyPipeline()) {
    console.log(person satisfies Person);
  }
};

/**
 * `.cursor()` is for keyset async iteration over results. Results are fetched
 * in batches (controlled by the `options.batchSize` setting), and yielded as
 * async results.
 */
async () => {
  for await (const person of pipeline().cursor("person.id")) {
    console.log(person satisfies Person);
  }
};

/**
 * `.cursor()` with a composite index.
 */
async () => {
  for await (const person of pipeline().cursor(["created_at", "person.id"])) {
    console.log(person satisfies Person);
  }
};

async () => {
  for await (const person of pipeline().stream()) {
    console.log(person satisfies Person);
  }
};
