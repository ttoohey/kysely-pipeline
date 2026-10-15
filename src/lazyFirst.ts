import { SelectQueryBuilder } from "kysely";
import { thenable } from "./thenable.js";
import { first } from "./first.js";
import { PipelineState } from "./types.js";

export function lazyFirst<
  TObject extends object,
  DB,
  TB extends keyof DB,
  O,
  T,
  S extends PipelineState,
>(
  object: TObject,
  query: SelectQueryBuilder<DB, TB, O>,
  transformer: (data: O) => T,
  state: S,
): TObject & Promise<S extends true ? T : S extends false ? T | null : never> {
  return thenable(object, first(query, transformer, state)) as any;
}
