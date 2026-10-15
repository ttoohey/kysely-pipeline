# kysely-pipeline: Extending

Extending the pipeline query builder and transforming results.

- use `.extend()` to modify the query builder
- use `.map()` to modify the result transformer
- use `.compose()` to modify the pipeline

These methods can be chained multiple times to create complex pipelines.

```ts
import { Selectable } from "kysely";
import { pipeline } from "kysely-pipeline";
import { Database, db } from "./db.js";

type Person = Selectable<Database["person"]>;
type Aliases = { fn: string; ln: string | null };
type FullName = { full_name: string };

const query = db.selectFrom("person").selectAll();
const findPerson = () => pipeline(query).lazy();

/**
 * `.extend()` allows making changes to the pipeline's query builder
 *
 * It returns a new pipeline with the new query builder.
 */
async () => {
  const person = await findPerson().extend((query) =>
    query.select(["person.first_name as fn", "person.last_name as ln"]),
  );
  console.log(person satisfies (Person & Aliases) | null);
};

/**
 * `.map()` transforms the query builder responses
 *
 * It returns a new pipeline with the new transformer function.
 */
async () => {
  const person = await findPerson().map((data) => ({
    ...data,
    full_name: `${data.first_name} ${data.last_name}`,
  }));
  console.log(person satisfies (Person & FullName) | null);
};

/**
 * `.compose()` allows grouping query builder extensions and result transformers
 * into a single callback.
 */
async () => {
  const person = await findPerson().compose((pipeline) =>
    pipeline
      .extend((query) =>
        query.select(["person.first_name as fn", "person.last_name as ln"]),
      )
      .map((data) => ({
        ...data,
        full_name: `${data.fn} ${data.ln}`,
      })),
  );
  console.log(person satisfies (Person & Aliases & FullName) | null);
};
```
